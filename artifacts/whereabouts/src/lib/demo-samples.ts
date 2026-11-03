import type { Investigation } from "@workspace/api-client-react";
import type { PersonFactors, SceneClues, UrgencyResult } from "./urgency";
import records from "./demo-cases.json";
import { assessDemoScenario } from "./demo-scenarios";

export type DemoSample = {
  scenario: string;
  imageUrl: string;
  sourceImageUrl: string;
  sourceName: string;
  licenseUrl: string;
  investigation: Investigation;
  familyFacts: string[];
  urgencyAssessedAt: string;
  urgencyInputs: {
    scene: Omit<SceneClues, "photoTakenAt"> & { photoTakenAt?: string };
    person: PersonFactors;
  };
  urgency: UrgencyResult;
};

// Location reports stay precomputed. Family scenario scores use the unchanged
// scorer and relative timestamps, replacing legacy JSON urgency snapshots.
const sampleBasePath = import.meta.env?.BASE_URL ?? "/";
export const demoSamples: DemoSample[] = (records as unknown as DemoSample[]).map(
  (record) => ({ ...record, ...assessDemoScenario(record.investigation.id), imageUrl: `${sampleBasePath}${record.imageUrl}` }),
);

export function refreshDemoSample(sample: DemoSample, now = new Date()): DemoSample {
  return { ...sample, ...assessDemoScenario(sample.investigation.id, now) };
}

export function getDemoSample(id: string | null | undefined) {
  return demoSamples.find((sample) => sample.investigation.id === id);
}
