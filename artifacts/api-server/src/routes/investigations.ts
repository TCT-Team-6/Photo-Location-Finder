import OpenAI from "openai";
import {
  CreateInvestigationBody,
  CreateInvestigationResponse,
  DeleteInvestigationParams,
  GetInvestigationParams,
  GetInvestigationResponse,
  GetInvestigationSummaryResponse,
  ListInvestigationsQueryParams,
  ListInvestigationsResponse,
  RefreshInvestigationCandidatesBody,
  RefreshInvestigationCandidatesParams,
  RefreshInvestigationCandidatesResponse,
  UpdateInvestigationBody,
  UpdateInvestigationParams,
  UpdateInvestigationResponse,
} from "@workspace/api-zod";
import {
  db,
  investigationsTable,
  pendingPhotoUploadsTable,
  type LocationCandidate,
  type VisualClue,
} from "@workspace/db";
import { and, count, desc, eq, gte, ilike, or } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectPermission } from "../lib/objectAcl";
import { analyzeImageLocation } from "../lib/imageLocationAnalysis";
import { analyzeDeskImage } from "../lib/deskImageAnalysis";
import { searchLocationPhotoReferences } from "../lib/locationPhotoSearch";
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from "../lib/objectStorage";
import { requireUser } from "../middlewares/requireUser";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/x-tiff",
  "image/heic",
  "image/heif",
]);
const VISUAL_MODEL_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

router.use(requireUser);

function defaultTitle(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^.]+$/, "");
  const readable = withoutExtension.replace(/[_-]+/g, " ").trim();
  return (readable || "Untitled investigation").slice(0, 120);
}

function isProviderQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: unknown; code?: unknown; message?: unknown };
  const message = typeof value.message === "string" ? value.message : "";
  return value.status === 429 &&
    (value.code === "insufficient_quota" || /no credits remaining|insufficient quota/i.test(message));
}

router.get(
  "/investigations",
  async (req: Request, res: Response): Promise<void> => {
    const query = ListInvestigationsQueryParams.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: "Invalid search query." });
      return;
    }
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const search = query.data.query?.trim();
    const where = search
      ? and(
          eq(investigationsTable.userId, userId),
          or(
            ilike(investigationsTable.title, `%${search}%`),
            ilike(investigationsTable.originalName, `%${search}%`),
            ilike(investigationsTable.context, `%${search}%`),
            ilike(investigationsTable.summary, `%${search}%`),
          ),
        )
      : eq(investigationsTable.userId, userId);

    const investigations = await db
      .select()
      .from(investigationsTable)
      .where(where)
      .orderBy(desc(investigationsTable.createdAt))
      .limit(100);
    res.json(ListInvestigationsResponse.parse(investigations));
  },
);

router.get(
  "/investigations/summary",
  async (req: Request, res: Response): Promise<void> => {
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const [allCount] = await db
      .select({ value: count() })
      .from(investigationsTable)
      .where(eq(investigationsTable.userId, userId));
    const [monthCount] = await db
      .select({ value: count() })
      .from(investigationsTable)
      .where(
        and(
          eq(investigationsTable.userId, userId),
          gte(investigationsTable.createdAt, monthStart),
        ),
      );
    const [latest] = await db
      .select()
      .from(investigationsTable)
      .where(eq(investigationsTable.userId, userId))
      .orderBy(desc(investigationsTable.createdAt))
      .limit(1);

    res.json(
      GetInvestigationSummaryResponse.parse({
        total: allCount?.value ?? 0,
        thisMonth: monthCount?.value ?? 0,
        latest: latest ?? null,
      }),
    );
  },
);

router.post(
  "/investigations",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateInvestigationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid photo or investigation details." });
      return;
    }
    const { objectPath, originalName, contentType } = parsed.data;
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (
      !objectPath.startsWith("/objects/uploads/") ||
      !SUPPORTED_IMAGE_TYPES.has(contentType)
    ) {
      res.status(400).json({ error: "Unsupported photo upload." });
      return;
    }
    if (
      parsed.data.desk !== "original" &&
      !VISUAL_MODEL_IMAGE_TYPES.has(contentType)
    ) {
      res.status(400).json({
        error:
          "Recreation and Journalism image analysis currently supports JPEG, PNG, WebP, or non-animated GIF files.",
      });
      return;
    }

    const [existingInvestigation] = await db
      .select()
      .from(investigationsTable)
      .where(
        and(
          eq(investigationsTable.userId, userId),
          eq(investigationsTable.clientRequestId, parsed.data.clientRequestId),
        ),
      )
      .limit(1);
    if (existingInvestigation) {
      await db
        .delete(pendingPhotoUploadsTable)
        .where(
          and(
            eq(pendingPhotoUploadsTable.objectPath, objectPath),
            eq(pendingPhotoUploadsTable.userId, userId),
          ),
        );
      res
        .status(200)
        .json(CreateInvestigationResponse.parse(existingInvestigation));
      return;
    }

    const [pendingUpload] = await db
      .select()
      .from(pendingPhotoUploadsTable)
      .where(
        and(
          eq(pendingPhotoUploadsTable.objectPath, objectPath),
          eq(pendingPhotoUploadsTable.userId, userId),
          gte(pendingPhotoUploadsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!pendingUpload || pendingUpload.contentType !== contentType) {
      res.status(404).json({ error: "This photo upload expired. Please upload it again." });
      return;
    }

    try {
      const file = await objectStorageService.getObjectEntityFile(objectPath);
      const [metadata] = await file.getMetadata();
      const fileSize = Number(metadata.size);
      if (
        metadata.contentType !== contentType ||
        !Number.isFinite(fileSize) ||
        fileSize < 1 ||
        fileSize > MAX_UPLOAD_BYTES
      ) {
        res.status(400).json({ error: "The uploaded file did not match its image details." });
        return;
      }

      const [buffer] = await file.download();
      const context = parsed.data.context?.trim() || null;
      const shotAt = parsed.data.shotAt
        ? parsed.data.shotAt.toISOString().slice(0, 10)
        : null;
      const apiKey = process.env.OPENAI_API_KEY;
      let summary: string;
      let clues: VisualClue[];
      let analysisCandidates: LocationCandidate[];
      if (parsed.data.desk === "original") {
        const analysis = await analyzeImageLocation(buffer, contentType, originalName);
        summary = analysis.summary;
        clues = analysis.clues;
        analysisCandidates = analysis.candidates;
      } else {
        if (!apiKey) throw new Error("Image source search and journalism review require an OpenAI connection.");
        const openAIClient = new OpenAI({ apiKey });
        const analysis = await analyzeDeskImage(
          openAIClient,
          buffer,
          contentType,
          parsed.data.desk,
          parsed.data.journalismQuestion,
        );
        summary = analysis.summary;
        clues = analysis.clues;
        analysisCandidates = analysis.candidates;
      }
      const openAIClient = apiKey ? new OpenAI({ apiKey }) : null;
      const candidates = parsed.data.desk === "original"
        ? await Promise.all(
        analysisCandidates.map(
          async (candidate): Promise<LocationCandidate> => {
            if (!openAIClient) {
              return {
                ...candidate,
                photoReferences: [],
                photoSearchStatus: "unavailable",
              };
            }
            try {
              const photoReferences = await searchLocationPhotoReferences(
                openAIClient,
                candidate,
              );
              return {
                ...candidate,
                photoReferences,
                photoSearchStatus: photoReferences.length
                  ? "found"
                  : "no_results",
              };
            } catch (error) {
              req.log.warn(
                {
                  location: candidate.place,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                },
                "Location photo search failed",
              );
              return {
                ...candidate,
                photoReferences: [],
                photoSearchStatus: "unavailable",
              };
            }
          },
        ),
      )
        : analysisCandidates;

      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: userId,
        visibility: "private",
      });
      const [insertedInvestigation] = await db
        .insert(investigationsTable)
        .values({
          userId,
          title: parsed.data.title?.trim() || defaultTitle(originalName),
          desk: parsed.data.desk,
          originalName,
          contentType,
          objectPath,
          clientRequestId: parsed.data.clientRequestId,
          context,
          shotAt,
          summary,
          candidates,
          clues,
        })
        .onConflictDoNothing({
          target: [
            investigationsTable.userId,
            investigationsTable.clientRequestId,
          ],
        })
        .returning();

      const [investigation] = insertedInvestigation
        ? [insertedInvestigation]
        : await db
            .select()
            .from(investigationsTable)
            .where(
              and(
                eq(investigationsTable.userId, userId),
                eq(
                  investigationsTable.clientRequestId,
                  parsed.data.clientRequestId,
                ),
              ),
            )
            .limit(1);
      if (!investigation) {
        throw new Error("Investigation idempotency conflict could not be resolved.");
      }

      await db
        .delete(pendingPhotoUploadsTable)
        .where(
          and(
            eq(pendingPhotoUploadsTable.objectPath, objectPath),
            eq(pendingPhotoUploadsTable.userId, userId),
          ),
        );

      res
        .status(insertedInvestigation ? 201 : 200)
        .json(CreateInvestigationResponse.parse(investigation));
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "The uploaded photo could not be found." });
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown analysis error";
      const quotaExhausted = isProviderQuotaError(error);
      req.log.error({ message, quotaExhausted }, "Photo location analysis failed");
      res.status(quotaExhausted ? 429 : 502).json({
        error: quotaExhausted
          ? "Image analysis is unavailable because the analysis provider has no remaining credits. Your uploaded photo is retained; restore provider credits before retrying."
          : "We couldn't analyze this photo. Your upload is still available to retry.",
      });
    }
  },
);

router.get(
  "/investigations/:id",
  async (req: Request, res: Response): Promise<void> => {
    const params = GetInvestigationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid investigation ID." });
      return;
    }
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [investigation] = await db
      .select()
      .from(investigationsTable)
      .where(
        and(
          eq(investigationsTable.id, params.data.id),
          eq(investigationsTable.userId, userId),
        ),
      )
      .limit(1);
    if (!investigation) {
      res.status(404).json({ error: "Investigation not found." });
      return;
    }
    res.json(GetInvestigationResponse.parse(investigation));
  },
);

router.post(
  "/investigations/:id/refresh-candidates",
  async (req: Request, res: Response): Promise<void> => {
    const params = RefreshInvestigationCandidatesParams.safeParse(req.params);
    const body = RefreshInvestigationCandidatesBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid lead refresh request." });
      return;
    }
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [investigation] = await db.select().from(investigationsTable).where(
      and(eq(investigationsTable.id, params.data.id), eq(investigationsTable.userId, userId)),
    ).limit(1);
    if (!investigation) {
      res.status(404).json({ error: "Investigation not found." });
      return;
    }
    try {
      const file = await objectStorageService.getObjectEntityFile(investigation.objectPath);
      const [buffer] = await file.download();
      const analysis = await analyzeImageLocation(buffer, investigation.contentType, investigation.originalName);
      const excluded = new Set([
        ...investigation.candidates.map((candidate) => candidate.place.toLocaleLowerCase()),
        ...body.data.excludePlaces.map((place) => place.toLocaleLowerCase()),
      ]);
      const newLeads = analysis.candidates.filter(
        (candidate) => !excluded.has(candidate.place.toLocaleLowerCase()),
      );
      if (!newLeads.length) {
        res.status(409).json({ error: "The analyzer did not return different locations. Try again later." });
        return;
      }
      const apiKey = process.env.OPENAI_API_KEY;
      const openAIClient = apiKey ? new OpenAI({ apiKey }) : null;
      const candidates = await Promise.all(newLeads.map(async (candidate): Promise<LocationCandidate> => {
        if (!openAIClient) return { ...candidate, photoReferences: [], photoSearchStatus: "unavailable" };
        try {
          const photoReferences = await searchLocationPhotoReferences(openAIClient, candidate);
          return { ...candidate, photoReferences, photoSearchStatus: photoReferences.length ? "found" : "no_results" };
        } catch {
          return { ...candidate, photoReferences: [], photoSearchStatus: "unavailable" };
        }
      }));
      const summary = `The Image Locator service refreshed the leads. ${candidates[0].place} is the strongest new location lead.`;
      const [updated] = await db.update(investigationsTable)
        .set({ candidates, summary, updatedAt: new Date() })
        .where(and(eq(investigationsTable.id, investigation.id), eq(investigationsTable.userId, userId)))
        .returning();
      if (!updated) {
        res.status(404).json({ error: "Investigation not found." });
        return;
      }
      res.json(RefreshInvestigationCandidatesResponse.parse(updated));
    } catch (error) {
      req.log.error({ message: error instanceof Error ? error.message : "Unknown error" }, "Could not refresh investigation leads");
      res.status(502).json({ error: "New location leads could not be generated. Your existing report is unchanged." });
    }
  },
);

router.get(
  "/investigations/:id/photo",
  async (req: Request, res: Response): Promise<void> => {
    const params = GetInvestigationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid investigation ID." });
      return;
    }
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [investigation] = await db
      .select()
      .from(investigationsTable)
      .where(
        and(
          eq(investigationsTable.id, params.data.id),
          eq(investigationsTable.userId, userId),
        ),
      )
      .limit(1);
    if (!investigation) {
      res.status(404).json({ error: "Photo not found." });
      return;
    }

    try {
      const file = await objectStorageService.getObjectEntityFile(
        investigation.objectPath,
      );
      const permitted = await objectStorageService.canAccessObjectEntity({
        userId,
        objectFile: file,
        requestedPermission: ObjectPermission.READ,
      });
      if (!permitted) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const response = await objectStorageService.downloadObject(file);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const { Readable } = await import("node:stream");
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Photo not found." });
        return;
      }
      req.log.error(
        { message: error instanceof Error ? error.message : "Unknown error" },
        "Could not load investigation photo",
      );
      res.status(500).json({ error: "Could not load this photo." });
    }
  },
);

router.patch(
  "/investigations/:id",
  async (req: Request, res: Response): Promise<void> => {
    const params = UpdateInvestigationParams.safeParse(req.params);
    const parsed = UpdateInvestigationBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid investigation details." });
      return;
    }
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [investigation] = await db
      .update(investigationsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(investigationsTable.id, params.data.id),
          eq(investigationsTable.userId, userId),
        ),
      )
      .returning();
    if (!investigation) {
      res.status(404).json({ error: "Investigation not found." });
      return;
    }
    res.json(UpdateInvestigationResponse.parse(investigation));
  },
);

router.delete(
  "/investigations/:id",
  async (req: Request, res: Response): Promise<void> => {
    const params = DeleteInvestigationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid investigation ID." });
      return;
    }
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const [investigation] = await db
      .select()
      .from(investigationsTable)
      .where(
        and(
          eq(investigationsTable.id, params.data.id),
          eq(investigationsTable.userId, userId),
        ),
      )
      .limit(1);
    if (!investigation) {
      res.status(404).json({ error: "Investigation not found." });
      return;
    }

    await db
      .delete(investigationsTable)
      .where(
        and(
          eq(investigationsTable.id, params.data.id),
          eq(investigationsTable.userId, userId),
        ),
      );
    try {
      const file = await objectStorageService.getObjectEntityFile(
        investigation.objectPath,
      );
      const permitted = await objectStorageService.canAccessObjectEntity({
        userId,
        objectFile: file,
        requestedPermission: ObjectPermission.WRITE,
      });
      if (permitted) await file.delete({ ignoreNotFound: true });
    } catch (error) {
      req.log.warn(
        { message: error instanceof Error ? error.message : "Unknown error" },
        "Investigation removed but photo cleanup failed",
      );
    }
    res.sendStatus(204);
  },
);

export default router;