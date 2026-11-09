import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import { db, investigationsTable, type Investigation } from "@workspace/db";
import { analyzeImageLocation, type ImageLocationAnalysis } from "./imageLocationAnalysis";
import { ObjectStorageService } from "./objectStorage";
import { isVideo, mediaValidationError } from "./locatorMedia";
import { logger } from "./logger";

const LEASE_MS = 8 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const storage = new ObjectStorageService();

/** Locked claim prevents duplicate workers; expired leases allow recovery after restarts. */
export async function claimVideoJob(): Promise<Investigation | undefined> {
  return db.transaction(async (tx) => {
    const [job] = await tx.select().from(investigationsTable).where(and(
      eq(investigationsTable.status, "analyzing"),
      eq(investigationsTable.desk, "original"),
      or(isNull(investigationsTable.analysisLeaseUntil),
        lt(investigationsTable.analysisLeaseUntil, new Date())),
    )).orderBy(asc(investigationsTable.updatedAt)).limit(1).for("update", { skipLocked: true });
    if (!job) return undefined;
    if ((job.analysisAttempts ?? 0) >= MAX_ATTEMPTS || !isVideo(job.contentType)) {
      await tx.update(investigationsTable).set({
        status: "failed",
        analysisError: "Video processing was interrupted repeatedly. Your upload is saved; please try again.",
        analysisLeaseUntil: null, analysisLeaseToken: null, updatedAt: new Date(),
      }).where(eq(investigationsTable.id, job.id));
      return undefined;
    }
    const [claimed] = await tx.update(investigationsTable).set({
      analysisAttempts: (job.analysisAttempts ?? 0) + 1,
      analysisLeaseUntil: new Date(Date.now() + LEASE_MS),
      analysisLeaseToken: randomUUID(), updatedAt: new Date(),
    }).where(eq(investigationsTable.id, job.id)).returning();
    return claimed;
  });
}

export function videoReport(analysis: ImageLocationAnalysis, excludePlaces: string[] = []) {
  const excluded = new Set(excludePlaces.map((place) => place.toLocaleLowerCase()));
  const candidates = analysis.candidates.filter((candidate) =>
    !excluded.has(candidate.place.toLocaleLowerCase()));
  if (excluded.size && !candidates.length) {
    throw new Error("The analyzer did not return different locations. Your previous report is unchanged.");
  }
  return {
    summary: excluded.size
      ? `The Image Locator service refreshed the leads. ${candidates[0]!.place} is the strongest new location lead.`
      : analysis.summary,
    candidates,
    clues: analysis.clues,
    analysis: { ...analysis.analysis, media_type: "video" as const },
  };
}

type WorkerServices = {
  load: (job: Investigation) => Promise<Buffer>;
  analyze: typeof analyzeImageLocation;
};
const defaultServices: WorkerServices = {
  load: async (job) => {
    const file = await storage.getObjectEntityFile(job.objectPath);
    const [metadata] = await file.getMetadata();
    const error = mediaValidationError(job.originalName, job.contentType, Number(metadata.size));
    if (error) throw new Error(error);
    if (metadata.contentType !== job.contentType) throw new Error("The saved video has invalid file details.");
    const [bytes] = await file.download();
    return bytes;
  },
  analyze: analyzeImageLocation,
};

export async function runVideoJob(job: Investigation, services = defaultServices): Promise<void> {
  if (!job.analysisLeaseToken) throw new Error("Cannot process an unclaimed video job.");
  const ownedLease = and(
    eq(investigationsTable.id, job.id),
    eq(investigationsTable.status, "analyzing"),
    eq(investigationsTable.analysisLeaseToken, job.analysisLeaseToken),
  );
  try {
    const bytes = await services.load(job);
    const analysis = await services.analyze(bytes, job.contentType, job.originalName);
    const report = videoReport(analysis, job.analysisJob?.excludePlaces);
    await db.update(investigationsTable).set({
      ...report, status: "done", analysisError: null, analysisJob: null,
      analysisLeaseUntil: null, analysisLeaseToken: null, updatedAt: new Date(),
    }).where(ownedLease);
  } catch (error) {
    // Keep the saved video and any earlier report intact. Never persist provider internals or keys.
    const message = error instanceof Error && [
      "This video is larger than 60 MB",
      "We couldn't find clear frames in this video. Try a sharper or longer clip",
      "Video analysis is turned off on the location service right now",
      "The analyzer did not return different locations. Your previous report is unchanged.",
    ].includes(error.message) ? error.message
      : "We couldn't analyze this video. Your upload is saved; please try again.";
    await db.update(investigationsTable).set({
      status: "failed", analysisError: message,
      analysisLeaseUntil: null, analysisLeaseToken: null, updatedAt: new Date(),
    }).where(ownedLease);
    logger.warn({ investigationId: job.id }, "Saved video analysis failed");
  }
}

/** Needs an always-on server in production; a durable queue is not a substitute for compute. */
export function startVideoAnalysisWorker(): () => void {
  let stopped = false;
  let busy = false;
  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const job = await claimVideoJob();
      if (job) await runVideoJob(job);
    } catch {
      logger.error("Video queue worker could not complete its tick; it will retry.");
    } finally { busy = false; }
  };
  const timer = setInterval(() => { void tick(); }, 5000);
  timer.unref();
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
