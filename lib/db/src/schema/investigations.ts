import {
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import type { InvestigationAnalysis } from "./investigation-analysis";

export type { InvestigationAnalysis } from "./investigation-analysis";

export type LocationCandidate = {
  place: string;
  region: string | null;
  country: string | null;
  confidence: number;
  rationale: string;
  clues: string[];
  mapsUrl: string;
  photoReferences?: LocationPhotoReference[];
  photoSearchStatus?: LocationPhotoSearchStatus;
};

export type VisualClue = {
  label: string;
  observation: string;
  significance: string;
};

export type LocationPhotoReference = {
  imageUrl: string;
  thumbnailUrl: string | null;
  sourceUrl: string;
  caption: string | null;
};

export type LocationPhotoSearchStatus = "found" | "no_results" | "unavailable";

export const investigationsTable = pgTable(
  "investigations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    desk: text("desk").notNull().default("original"),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    objectPath: text("object_path").notNull(),
    clientRequestId: uuid("client_request_id"),
    context: text("context"),
    shotAt: date("shot_at", { mode: "string" }),
    summary: text("summary").notNull(),
    candidates: jsonb("candidates").$type<LocationCandidate[]>().notNull(),
    clues: jsonb("clues").$type<VisualClue[]>().notNull(),
    analysis: jsonb("analysis").$type<InvestigationAnalysis>(),
    status: text("status").$type<"analyzing" | "done" | "failed">(),
    analysisError: text("analysis_error"),
    analysisLeaseUntil: timestamp("analysis_lease_until", { withTimezone: true }),
    analysisLeaseToken: uuid("analysis_lease_token"),
    analysisAttempts: integer("analysis_attempts"),
    analysisJob: jsonb("analysis_job").$type<{ excludePlaces?: string[] }>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("investigations_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("investigations_user_client_request_idx").on(
      table.userId,
      table.clientRequestId,
    ),
  ],
);

export const pendingPhotoUploadsTable = pgTable(
  "pending_photo_uploads",
  {
    objectPath: text("object_path").primaryKey(),
    userId: text("user_id").notNull(),
    contentType: text("content_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("pending_photo_uploads_owner_idx").on(table.userId)],
);

export const insertInvestigationSchema = createInsertSchema(
  investigationsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvestigation = z.infer<typeof insertInvestigationSchema>;
export type Investigation = typeof investigationsTable.$inferSelect;