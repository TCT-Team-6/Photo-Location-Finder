import type { Investigation } from "@workspace/api-client-react";
import type { PersonFactors, SceneClues, UrgencyResult } from "./urgency";
import records from "./demo-cases.json";

export type DemoSample = {
  scenario: string;
  imageUrl: string;
  sourceImageUrl: string;
  sourceName: string;
  licenseUrl: string;
  investigation: Investigation;
  urgencyAssessedAt: string;
  urgencyInputs: {
    scene: Omit<SceneClues, "photoTakenAt"> & { photoTakenAt?: string };
    person: PersonFactors;
  };
  urgency: UrgencyResult;
};

// Static, fictional records: never create investigations or run live analysis.
// Regenerate urgency fields with scripts/generate-demo-urgency.ts after editing clues.
const sampleBasePath = import.meta.env?.BASE_URL ?? "/";
export const demoSamples: DemoSample[] = (records as unknown as DemoSample[]).map(
  (record) => ({ ...record, imageUrl: `${sampleBasePath}${record.imageUrl}` }),
);

export function getDemoSample(id: string | null | undefined) {
  return demoSamples.find((sample) => sample.investigation.id === id);
}
