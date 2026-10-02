import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { db, pendingPhotoUploadsTable } from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq, lte } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { ObjectPermission } from "../lib/objectAcl";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { requireUser } from "../middlewares/requireUser";
import { Readable } from "node:stream";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

router.use(requireUser);

router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a supported image under 25 MB." });
      return;
    }

    const { name, size, contentType } = parsed.data;
    if (size > MAX_UPLOAD_BYTES || !contentType.startsWith("image/")) {
      res.status(400).json({ error: "Choose a supported image under 25 MB." });
      return;
    }

    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      await db
        .delete(pendingPhotoUploadsTable)
        .where(lte(pendingPhotoUploadsTable.expiresAt, new Date()));
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      await db.insert(pendingPhotoUploadsTable).values({
        objectPath,
        userId,
        contentType,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      });

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error(
        { message: error instanceof Error ? error.message : "Unknown error" },
        "Could not prepare private photo upload",
      );
      res.status(500).json({ error: "Could not prepare the photo upload." });
    }
  },
);

router.get("/storage/objects/*path", async (req: Request, res: Response): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rawPath = req.params.path;
    const path = Array.isArray(rawPath) ? rawPath.join("/") : rawPath;
    const file = await objectStorageService.getObjectEntityFile(`/objects/${path}`);
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
      "Could not serve private photo",
    );
    res.status(500).json({ error: "Could not serve this photo." });
  }
});

export default router;