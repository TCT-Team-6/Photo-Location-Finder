import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, privateCasesTable, caseLeadsTable } from "@workspace/db";
import { GuideIntakeBody, GuideIntakeResponse, GuideNoteBody, GuidePlanBody, GuidePlanResponse } from "@workspace/api-zod";
import { requireUser } from "../middlewares/requireUser";
import { extractGuideFacts } from "../lib/guide-ai";
import { advanceGuide, readGuide, mapGuideToCase, responderSummary, groundActions, safetyGate, type GuideAction, type GroundingSource } from "../lib/guide";

const router: IRouter = Router();
router.use("/guide", requireUser, (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
class GuideError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function action(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try { await fn(req, res); }
    catch (error) {
      if (error instanceof GuideError) { res.status(error.status).json({ error: error.message }); return; }
      const provider = error as { status?: number; code?: string };
      if (provider.status === 429 && ["credit_balance_exhausted", "insufficient_quota"].includes(provider.code ?? "")) {
        req.log.warn({ providerStatus: 429, providerCode: "insufficient_quota" }, "Guide provider credits unavailable.");
        res.status(503).json({ error: "The AI provider has no available credits for live intake. Your saved case has not been changed. Use the regular form or a fictional sample while the app owner restores provider credits. If someone may be in danger, call 911 now." });
        return;
      }
      req.log.error("Guide operation failed; no private message content logged.");
      res.status(503).json({ error: "The AI Guide is unavailable. Your saved case is unchanged. Retry or use the regular form. If someone may be in danger, call 911 now." });
    }
  };
}
async function owned(id: string, userId: string) {
  const [item] = await db.select().from(privateCasesTable)
    .where(and(eq(privateCasesTable.id, id), eq(privateCasesTable.userId, userId)));
  if (!item) throw new GuideError(404, "Case not found.");
  return item;
}
// One costly AI call per owner at a time, with bounded per-case transcript.
const busy = new Set<string>();
router.post("/guide/intake", action(async (req, res) => {
  const input = GuideIntakeBody.strict().safeParse(req.body);
  if (!input.success || !input.data.text.trim()) throw new GuideError(400, "Enter a message and a valid case revision.");
  const { caseId, text, revision } = input.data;
  const userId: string = res.locals.userId;
  const before = await owned(caseId, userId);
  const previous = readGuide(before.data.guide);
  if ((previous?.revision ?? 0) !== revision) throw new GuideError(409, "This case changed. Reload the saved case before retrying.");
  if ((previous?.log.length ?? 0) >= 90) throw new GuideError(400, "The guide conversation is full. Continue in the regular case form.");
  if (busy.has(userId)) throw new GuideError(429, "An AI reply is already being prepared. Please wait.");
  busy.add(userId);
  try {
    const facts = await extractGuideFacts(text, previous);
    const next = advanceGuide(previous, facts, text, new Date().toISOString());
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(privateCasesTable)
        .where(and(eq(privateCasesTable.id, caseId), eq(privateCasesTable.userId, userId))).for("update");
      if (!current) throw new GuideError(404, "Case not found.");
      if (current.updatedAt.getTime() !== before.updatedAt.getTime() || (readGuide(current.data.guide)?.revision ?? 0) !== revision) {
        throw new GuideError(409, "This case changed while the AI was replying. Reload before retrying; no changes were overwritten.");
      }
      await tx.update(privateCasesTable).set({ data: mapGuideToCase(current.data, next), updatedAt: new Date() }).where(eq(privateCasesTable.id, caseId));
    });
    res.json(GuideIntakeResponse.parse(next));
  } finally { busy.delete(userId); }
}));

router.post("/guide/note", action(async (req, res) => {
  const input = GuideNoteBody.strict().safeParse(req.body);
  if (!input.success || !input.data.text.trim()) throw new GuideError(400, "Enter an optional detail.");
  const { caseId, text, revision } = input.data;
  const result = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(privateCasesTable)
      .where(and(eq(privateCasesTable.id, caseId), eq(privateCasesTable.userId, res.locals.userId))).for("update");
    if (!item) throw new GuideError(404, "Case not found.");
    const state = readGuide(item.data.guide);
    if (!state) throw new GuideError(400, "Start the guide intake first.");
    if (state.revision !== revision) throw new GuideError(409, "This case changed. Reload before retrying.");
    if (state.gate !== "allowed") throw new GuideError(403, "Optional guide notes require a safety concern.");
    if (state.log.length >= 90) throw new GuideError(400, "The guide conversation is full. Continue in the regular case form.");
    state.log.push({ role: "note", text, at: new Date().toISOString() });
    state.revision++;
    await tx.update(privateCasesTable).set({ data: { ...item.data, guide: state }, updatedAt: new Date() }).where(eq(privateCasesTable.id, caseId));
    return state;
  });
  res.json(GuideIntakeResponse.parse(result));
}));

router.post("/guide/plan", action(async (req, res) => {
  const input = GuidePlanBody.strict().safeParse(req.body);
  if (!input.success) throw new GuideError(400, "Choose a saved case.");
  const item = await owned(input.data.caseId, res.locals.userId);
  const state = readGuide(item.data.guide);
  if (!state || state.gate !== "allowed" || safetyGate(state.facts) !== "allowed") {
    throw new GuideError(403, "A genuine safety concern is required. This guide never provides live location results.");
  }
  const leads = await db.select().from(caseLeadsTable).where(eq(caseLeadsTable.caseId, item.id));
  const sources: GroundingSource[] = [
    { id: "safetyReason", label: state.facts.safetyReason!, confidence: null, reason: "This safety concern was reported by you, not independently verified. Contact emergency services if there may be danger." },
  ];
  if (item.data.lastKnownArea) sources.push({ id: "lastSeenPlace", label: item.data.lastKnownArea, confidence: null, reason: "This is your reported last-seen area, not an AI location finding. Give the report to an authorized responder." });
  const source = sources[0];
  const place = sources[1] ?? source;
  const proposals: GuideAction[] = [
    ...(state.emergency ? [{ kind: "call_911" as const, sourceId: source.id, sourceLabel: source.label, confidence: null, reason: source.reason }] : []),
    { kind: "share_report", sourceId: place.id, sourceLabel: place.label, confidence: null, reason: place.reason },
    { kind: "print_summary", sourceId: source.id, sourceLabel: source.label, confidence: null, reason: source.reason },
  ];
  // Live plans are deliberately templated, not speculative GPT location plans.
  res.json(GuidePlanResponse.parse({ summary: responderSummary(item.data, state, leads), actions: groundActions(proposals, sources) }));
}));
export default router;
