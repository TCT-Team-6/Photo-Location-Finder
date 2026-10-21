import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, gte } from "drizzle-orm";
import { GetMissingPersonCaseParams, GetMissingPersonCaseResponse, ListMissingPersonCasesResponse, ReviewCaseLeadBody, SaveCaseReviewBody } from "@workspace/api-zod";
import { caseLeadsTable, casePhotosTable, db, pendingPhotoUploadsTable, privateCasesTable, type CasePhotoData } from "@workspace/db";
import { requireUser } from "../middlewares/requireUser";
import { ObjectStorageService } from "../lib/objectStorage";
import { privateCaseInput, caseLeadInput } from "../lib/case-validation";
import { cleanupDeletedCasePhotos } from "../lib/case-photo-cleanup";
import { buildCaseReview } from "../lib/case-review";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const uuid = GetMissingPersonCaseParams.shape.id;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class InputError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// This router is deliberately scoped; it cannot expose other router paths.
router.use("/cases", requireUser, (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
router.use("/cases/:id", (req, res, next) => {
  if (!uuid.safeParse(req.params.id).success) {
    res.status(400).json({ error: "Invalid case reference." });
    return;
  }
  next();
});

function action(handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof InputError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      req.log.error("Private case operation failed.");
      res.status(500).json({ error: "Could not save or load this case. Your form has not been cleared; please try again." });
    }
  };
}

async function ownedCase(id: string, userId: string, tx: Transaction | typeof db = db) {
  const [item] = await tx.select().from(privateCasesTable)
    .where(and(eq(privateCasesTable.id, id), eq(privateCasesTable.userId, userId))).limit(1);
  if (!item) throw new InputError(404, "Case not found.");
  return item;
}

async function caseResponse(id: string, userId: string) {
  const item = await ownedCase(id, userId);
  const leads = await db.select().from(caseLeadsTable).where(eq(caseLeadsTable.caseId, id)).orderBy(desc(caseLeadsTable.createdAt));
  return GetMissingPersonCaseResponse.parse({
    ...item.data, id: item.id, createdAt: item.createdAt, updatedAt: item.updatedAt,
    leads: leads.map((lead) => ({ ...lead.data, id: lead.id, reviewStatus: lead.reviewStatus, createdAt: lead.createdAt })),
  });
}

async function lockCase(tx: Transaction, id: string, userId: string) {
  const [item] = await tx.select().from(privateCasesTable)
    .where(and(eq(privateCasesTable.id, id), eq(privateCasesTable.userId, userId))).for("update");
  if (!item) throw new InputError(404, "Case not found.");
  return item;
}

async function claimPhoto(tx: Transaction, photo: CasePhotoData, caseId: string, userId: string): Promise<void> {
  const [pending] = await tx.select().from(pendingPhotoUploadsTable)
    .where(and(eq(pendingPhotoUploadsTable.objectPath, photo.objectPath), eq(pendingPhotoUploadsTable.userId, userId), gte(pendingPhotoUploadsTable.expiresAt, new Date()))).for("update");
  if (!pending || pending.contentType !== photo.contentType) {
    throw new InputError(400, "This photo upload is expired or already used. Select the photo again.");
  }
  const file = await storage.getObjectEntityFile(photo.objectPath);
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (metadata.contentType !== photo.contentType || size < 1 || size > 25 * 1024 * 1024 || !Number.isFinite(size)) {
    throw new InputError(400, "Choose a JPEG, PNG, or WebP image under 25 MB.");
  }
  const [header] = await file.download({ start: 0, end: 11 });
  const valid = photo.contentType === "image/jpeg" ? header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : photo.contentType === "image/png" ? header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new InputError(400, "The file content does not match the selected image type.");
  await tx.insert(casePhotosTable).values({ objectPath: photo.objectPath, caseId, userId });
  await storage.trySetObjectEntityAclPolicy(photo.objectPath, { owner: userId, visibility: "private" });
  await tx.delete(pendingPhotoUploadsTable).where(eq(pendingPhotoUploadsTable.objectPath, photo.objectPath));
}

function parseCase(body: unknown) {
  const parsed = privateCaseInput.safeParse(body);
  if (!parsed.success) throw new InputError(400, parsed.error.issues[0]?.message || "Check the case details and privacy acknowledgement.");
  return { ...parsed.data, firstName: parsed.data.firstName.trim() };
}

router.get("/cases", action(async (_req, res) => {
  const userId: string = res.locals.userId;
  const items = await db.select().from(privateCasesTable).where(eq(privateCasesTable.userId, userId)).orderBy(desc(privateCasesTable.createdAt));
  res.json(ListMissingPersonCasesResponse.parse(await Promise.all(items.map((item) => caseResponse(item.id, userId)))));
}));

router.post("/cases", action(async (req, res) => {
  const data = parseCase(req.body);
  const userId: string = res.locals.userId;
  const id = await db.transaction(async (tx) => {
    // The unique key also serializes concurrent retries before consuming uploads.
    const [created] = await tx.insert(privateCasesTable).values({ id: randomUUID(), userId, clientRequestId: data.clientRequestId, data })
      .onConflictDoNothing().returning();
    if (!created) {
      const [existing] = await tx.select().from(privateCasesTable)
        .where(and(eq(privateCasesTable.userId, userId), eq(privateCasesTable.clientRequestId, data.clientRequestId)));
      return existing.id;
    }
    if (data.headshot) await claimPhoto(tx, data.headshot, created.id, userId);
    return created.id;
  });
  res.status(201).json(await caseResponse(id, userId));
}));

router.get("/cases/:id", action(async (req, res) => {
  res.json(await caseResponse(String(req.params.id), res.locals.userId));
}));

router.put("/cases/:id", action(async (req, res) => {
  const data = parseCase(req.body);
  const id = String(req.params.id);
  const userId: string = res.locals.userId;
  await db.transaction(async (tx) => {
    const old = await lockCase(tx, id, userId);
    const previousPath = old.data.headshot?.objectPath;
    const nextPath = data.headshot?.objectPath;
    if (data.headshot && nextPath !== previousPath) await claimPhoto(tx, data.headshot, id, userId);
    if (previousPath && nextPath !== previousPath) {
      await tx.update(casePhotosTable).set({ active: false }).where(eq(casePhotosTable.objectPath, previousPath));
    }
    await tx.update(privateCasesTable).set({ data: { ...data, clientRequestId: old.clientRequestId, review: old.data.review }, updatedAt: new Date() }).where(eq(privateCasesTable.id, id));
  });
  res.json(await caseResponse(id, userId));
  void cleanupDeletedCasePhotos();
}));

router.patch("/cases/:id/review", action(async (req, res) => {
  const parsed = SaveCaseReviewBody.safeParse(req.body);
  if (!parsed.success) throw new InputError(400, "Enter observations and follow-up notes of at most 10,000 characters each, with a valid review revision.");
  const id = String(req.params.id);
  const userId: string = res.locals.userId;
  await db.transaction(async (tx) => {
    const old = await lockCase(tx, id, userId);
    const review = buildCaseReview(old.data.review, parsed.data);
    if (!review) throw new InputError(409, "A newer review was saved in another tab or session. Your draft is unchanged. Load the latest saved review before merging your changes.");
    await tx.update(privateCasesTable).set({
      data: { ...old.data, review }, updatedAt: new Date(),
    }).where(eq(privateCasesTable.id, id));
  });
  res.json(await caseResponse(id, userId));
}));

router.delete("/cases/:id", action(async (req, res) => {
  const id = String(req.params.id);
  await db.transaction(async (tx) => {
    await lockCase(tx, id, res.locals.userId);
    await tx.update(casePhotosTable).set({ active: false }).where(eq(casePhotosTable.caseId, id));
    await tx.delete(privateCasesTable).where(eq(privateCasesTable.id, id));
  });
  res.sendStatus(204);
  void cleanupDeletedCasePhotos();
}));

router.post("/cases/:id/leads", action(async (req, res) => {
  const parsed = caseLeadInput.safeParse(req.body);
  if (!parsed.success) throw new InputError(400, parsed.error.issues[0]?.message || "Check the source, photo, dates, and permission.");
  const data = { ...parsed.data, title: parsed.data.title.trim(), source: parsed.data.source.trim() };
  const id = String(req.params.id);
  const userId: string = res.locals.userId;
  await db.transaction(async (tx) => {
    await lockCase(tx, id, userId);
    const [existing] = await tx.select().from(caseLeadsTable)
      .where(and(eq(caseLeadsTable.caseId, id), eq(caseLeadsTable.clientRequestId, data.clientRequestId)));
    if (existing) return;
    if (data.photo) await claimPhoto(tx, data.photo, id, userId);
    await tx.insert(caseLeadsTable).values({ caseId: id, clientRequestId: data.clientRequestId, data });
    await tx.update(privateCasesTable).set({ updatedAt: new Date() }).where(eq(privateCasesTable.id, id));
  });
  res.status(201).json(await caseResponse(id, userId));
}));

router.patch("/cases/:id/leads/:leadId", action(async (req, res) => {
  const parsed = ReviewCaseLeadBody.safeParse(req.body);
  if (!parsed.success || !uuid.safeParse(req.params.leadId).success) throw new InputError(400, "Choose a valid review status.");
  const id = String(req.params.id);
  await db.transaction(async (tx) => {
    await lockCase(tx, id, res.locals.userId);
    const [lead] = await tx.update(caseLeadsTable).set(parsed.data)
      .where(and(eq(caseLeadsTable.caseId, id), eq(caseLeadsTable.id, String(req.params.leadId)))).returning();
    if (!lead) throw new InputError(404, "Lead not found.");
    await tx.update(privateCasesTable).set({ updatedAt: new Date() }).where(eq(privateCasesTable.id, id));
  });
  res.json(await caseResponse(id, res.locals.userId));
}));

router.delete("/cases/:id/leads/:leadId", action(async (req, res) => {
  if (!uuid.safeParse(req.params.leadId).success) throw new InputError(400, "Invalid lead reference.");
  const id = String(req.params.id);
  await db.transaction(async (tx) => {
    await lockCase(tx, id, res.locals.userId);
    const [lead] = await tx.delete(caseLeadsTable)
      .where(and(eq(caseLeadsTable.caseId, id), eq(caseLeadsTable.id, String(req.params.leadId)))).returning();
    if (!lead) throw new InputError(404, "Lead not found.");
    if (lead.data.photo) await tx.update(casePhotosTable).set({ active: false }).where(eq(casePhotosTable.objectPath, lead.data.photo.objectPath));
    await tx.update(privateCasesTable).set({ updatedAt: new Date() }).where(eq(privateCasesTable.id, id));
  });
  res.sendStatus(204);
  void cleanupDeletedCasePhotos();
}));

// Failed physical deletions remain inaccessible and are retried while running.
const cleanupInterval = setInterval(() => void cleanupDeletedCasePhotos(), 5 * 60 * 1000);
cleanupInterval.unref();

export default router;
