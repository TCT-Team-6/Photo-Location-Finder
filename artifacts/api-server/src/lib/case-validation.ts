import { CreateCaseLeadBody, CreateMissingPersonCaseBody } from "@workspace/api-zod";

export function isCalendarDate(value: string | null | undefined): boolean {
  if (!value) return true;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isSafeSourceUrl(value: string | undefined): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const privateCaseInput = CreateMissingPersonCaseBody
  .refine((data) => Boolean(data.firstName.trim()), "Enter a first name.")
  .refine((data) => isCalendarDate(data.lastKnownDate), "Enter a valid last-known date.");

export const caseLeadInput = CreateCaseLeadBody
  .refine((data) => Boolean(data.title.trim() && data.source.trim()), "Enter a title and source.")
  .refine((data) => isSafeSourceUrl(data.sourceUrl), "Use an HTTP or HTTPS source link without embedded credentials.")
  .refine((data) => data.kind !== "link" || Boolean(data.sourceUrl), "Add a source link.")
  .refine((data) => data.kind !== "photo" || Boolean(data.photo), "Upload a photo.")
  .refine((data) => data.kind === "photo" || !data.photo, "Only photo leads can include an upload.")
  .refine((data) => data.kind !== "tip" || Boolean(data.notes?.trim()), "Describe the tip.")
  .refine((data) => isCalendarDate(data.reportedTakenOn) && isCalendarDate(data.postedOn), "Enter valid calendar dates.");
