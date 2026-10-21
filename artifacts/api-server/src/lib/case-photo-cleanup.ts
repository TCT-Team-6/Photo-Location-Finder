import { casePhotosTable, db } from "@workspace/db";
import { eq, isNull, or } from "drizzle-orm";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const storage = new ObjectStorageService();
let cleaning = false;

export async function cleanupDeletedCasePhotos(): Promise<void> {
  if (cleaning) return;
  cleaning = true;
  try {
    const deleted = await db.select().from(casePhotosTable)
      .where(or(eq(casePhotosTable.active, false), isNull(casePhotosTable.caseId))).limit(50);
    for (const photo of deleted) {
      try {
        try {
          const file = await storage.getObjectEntityFile(photo.objectPath);
          await file.delete({ ignoreNotFound: true });
        } catch (error) {
          if (!(error instanceof ObjectNotFoundError)) throw error;
        }
        await db.delete(casePhotosTable).where(eq(casePhotosTable.objectPath, photo.objectPath));
      } catch {
        // No filenames, case details, or storage credentials in logs.
        logger.warn("Private case photo deletion will be retried.");
      }
    }
  } catch {
    logger.warn("Private case photo cleanup is temporarily unavailable.");
  } finally {
    cleaning = false;
  }
}
