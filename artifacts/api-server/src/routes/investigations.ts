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
]);

router.use(requireUser);

function mapsSearchUrl(candidate: Pick<LocationCandidate, "place" | "region" | "country">): string {
  const query = [candidate.place, candidate.region, candidate.country]
    .filter(Boolean)
    .join(", ");
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  return url.toString();
}

function cleanAnalysis(raw: unknown): {
  summary: string;
  candidates: LocationCandidate[];
  clues: VisualClue[];
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("The analysis response was not an object.");
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.summary !== "string" || !value.summary.trim()) {
    throw new Error("The analysis did not include a summary.");
  }

  const candidates: LocationCandidate[] = Array.isArray(value.candidates)
    ? value.candidates.slice(0, 4).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const candidate = item as Record<string, unknown>;
        if (
          typeof candidate.place !== "string" ||
          !candidate.place.trim() ||
          typeof candidate.rationale !== "string"
        ) {
          return [];
        }
        const base = {
          place: candidate.place.trim().slice(0, 180),
          region:
            typeof candidate.region === "string"
              ? candidate.region.slice(0, 120)
              : null,
          country:
            typeof candidate.country === "string"
              ? candidate.country.slice(0, 120)
              : null,
        };
        const numericConfidence = Number(candidate.confidence);
        return [
          {
            ...base,
            confidence: Number.isFinite(numericConfidence)
              ? Math.max(0, Math.min(1, numericConfidence))
              : 0.25,
            rationale: candidate.rationale.trim().slice(0, 1200),
            clues: Array.isArray(candidate.clues)
              ? candidate.clues
                  .filter((clue): clue is string => typeof clue === "string")
                  .slice(0, 8)
                  .map((clue) => clue.slice(0, 220))
              : [],
            mapsUrl: mapsSearchUrl(base),
          },
        ];
      })
    : [];

  const clues: VisualClue[] = Array.isArray(value.clues)
    ? value.clues.slice(0, 10).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const clue = item as Record<string, unknown>;
        if (
          typeof clue.label !== "string" ||
          typeof clue.observation !== "string" ||
          typeof clue.significance !== "string"
        ) {
          return [];
        }
        return [
          {
            label: clue.label.trim().slice(0, 120),
            observation: clue.observation.trim().slice(0, 500),
            significance: clue.significance.trim().slice(0, 500),
          },
        ];
      })
    : [];

  return {
    summary: value.summary.trim().slice(0, 2000),
    candidates,
    clues,
  };
}

function defaultTitle(originalName: string): string {
  const withoutExtension = originalName.replace(/\.[^.]+$/, "");
  const readable = withoutExtension.replace(/[_-]+/g, " ").trim();
  return (readable || "Untitled investigation").slice(0, 120);
}

async function analyzePhoto(
  client: OpenAI,
  image: Buffer,
  contentType: string,
  context: string | null,
  shotAt: string | null,
): Promise<{ summary: string; candidates: LocationCandidate[]; clues: VisualClue[] }> {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You are a careful visual geolocation assistant. Analyze the photograph and any user-provided background notes and capture date.",
          "Return one JSON object with exactly these keys: summary (string), candidates (array), clues (array).",
          "Each candidate has place, region, country, confidence (0 to 1), rationale, and clues (array of short strings). Use null for unknown region or country.",
          "Each clue has label, observation, and significance. Return no more than 4 candidates and 10 visual clues.",
          "Use visible evidence such as signage, architecture, landscape, vegetation, road markings, and weather together with the supplied context. A date or note is context, not proof.",
          "Be explicit about uncertainty. Do not invent details, claim to have searched the web, or state a precise location when the image does not support one. If there is no credible location lead, return an empty candidates array and explain the limits in the summary.",
          "Do not infer sensitive personal attributes or identify people.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Background notes: ${context?.trim() || "None provided"}\nCapture date: ${shotAt || "Unknown"}\nAnalyze this image for likely geographic location and explain the evidence.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${contentType};base64,${image.toString("base64")}`,
              detail: "high",
            },
          },
        ],
      },
    ],
  });

  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("The analysis service returned an empty response.");
  return cleanAnalysis(JSON.parse(content));
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
      if (!apiKey) {
        throw new Error("Photo analysis is not configured.");
      }
      const openAIClient = new OpenAI({ apiKey });
      const analysis = await analyzePhoto(
        openAIClient,
        buffer,
        contentType,
        context,
        shotAt,
      );
      const candidates = await Promise.all(
        analysis.candidates.map(
          async (candidate): Promise<LocationCandidate> => {
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
      );

      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: userId,
        visibility: "private",
      });
      const [investigation] = await db
        .insert(investigationsTable)
        .values({
          userId,
          title: parsed.data.title?.trim() || defaultTitle(originalName),
          originalName,
          contentType,
          objectPath,
          context,
          shotAt,
          summary: analysis.summary,
          candidates,
          clues: analysis.clues,
        })
        .returning();

      await db
        .delete(pendingPhotoUploadsTable)
        .where(eq(pendingPhotoUploadsTable.objectPath, objectPath));

      res
        .status(201)
        .json(CreateInvestigationResponse.parse(investigation));
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "The uploaded photo could not be found." });
        return;
      }
      const message =
        error instanceof Error ? error.message : "Unknown analysis error";
      req.log.error({ message }, "Photo location analysis failed");
      res.status(502).json({
        error: "We couldn't analyze this photo. Your upload is still available to retry.",
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