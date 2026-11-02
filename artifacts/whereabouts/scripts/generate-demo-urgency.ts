import { readFileSync, writeFileSync } from "node:fs";
import type { Investigation } from "@workspace/api-client-react";
import { assessUrgency } from "../src/lib/urgency";
import { urgencyInputsFromInvestigation } from "../src/lib/urgency-inputs";

const fixture = new URL("../src/lib/demo-cases.json", import.meta.url);
const records = JSON.parse(readFileSync(fixture, "utf8")) as Array<{
  investigation: Investigation;
  urgencyAssessedAt: string;
  urgencyInputs?: unknown;
  urgency?: unknown;
}>;

for (const record of records) {
  const now = new Date(record.urgencyAssessedAt);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid sample assessment time");
  const { scene, person } = urgencyInputsFromInvestigation(record.investigation);
  record.urgencyInputs = { scene, person };
  record.urgency = assessUrgency(scene, person, now);
}
writeFileSync(fixture, `${JSON.stringify(records, null, 2)}\n`);
