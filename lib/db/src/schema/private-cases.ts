import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import type { z } from "zod/v4";

export type CasePhotoData = { objectPath: string; originalName: string; contentType: "image/jpeg" | "image/png" | "image/webp" };
export type PrivateCaseData = {
  clientRequestId: string;
  firstName: string;
  lastName?: string;
  nickname?: string;
  ageDescription?: string;
  lastKnownDate?: string | null;
  lastKnownArea?: string;
  responderRole: "family-or-guardian" | "authorized-responder" | "other";
  officialReference?: string;
  notes?: string;
  privacyAcknowledged: true;
  headshot?: CasePhotoData | null;
};
export type CaseLeadData = {
  clientRequestId: string;
  kind: "photo" | "link" | "tip";
  title: string;
  source: string;
  sourceUrl?: string;
  notes?: string;
  reportedTakenOn?: string | null;
  postedOn?: string | null;
  permissionGranted: true;
  photo?: CasePhotoData | null;
};

export const privateCasesTable = pgTable("private_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  clientRequestId: uuid("client_request_id").notNull(),
  data: jsonb("data").$type<PrivateCaseData>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("private_cases_owner_idx").on(table.userId),
  uniqueIndex("private_cases_request_idx").on(table.userId, table.clientRequestId),
]);

export const caseLeadsTable = pgTable("case_leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => privateCasesTable.id, { onDelete: "cascade" }),
  clientRequestId: uuid("client_request_id").notNull(),
  data: jsonb("data").$type<CaseLeadData>().notNull(),
  reviewStatus: text("review_status").$type<"needs-verification" | "relevant" | "unrelated">().notNull().default("needs-verification"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("case_leads_request_idx").on(table.caseId, table.clientRequestId),
]);

// Tombstones remain until physical deletion succeeds, so a failed storage delete
// cannot make an attachment accessible after its case/lead has been removed.
export const casePhotosTable = pgTable("case_photos", {
  objectPath: text("object_path").primaryKey(),
  caseId: uuid("case_id").references(() => privateCasesTable.id, { onDelete: "set null" }),
  userId: text("user_id").notNull(),
  active: boolean("active").notNull().default(true),
}, (table) => [index("case_photos_case_idx").on(table.caseId)]);

export const insertPrivateCaseSchema = createInsertSchema(privateCasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCaseLeadSchema = createInsertSchema(caseLeadsTable).omit({ id: true, createdAt: true });
export type InsertPrivateCase = z.infer<typeof insertPrivateCaseSchema>;
export type InsertCaseLead = z.infer<typeof insertCaseLeadSchema>;
