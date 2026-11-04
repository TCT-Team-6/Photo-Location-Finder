import type { Investigation } from "@workspace/api-client-react";
import { type PersonFactors, type SceneClues, type UrgencyResult } from "./urgency";
import records from "./demo-cases.json";
import teenRecord from "./demo-teen-case.json";
import caseDetails from "./demo-case-details.json";
import { assessDemoScenario, assessDemoUrgency, type DemoPersonFactors } from "./demo-scenarios";

export type DemoOverrides = {
  nickname: string;
  ageGroup: PersonFactors["ageGroup"];
  careNotes: string;
  reason: string;
};

export type DemoSample = {
  scenario: string;
  imageUrl: string;
  sourceImageUrl: string;
  sourceName: string;
  licenseUrl: string;
  investigation: Investigation;
  caseFile: { nickname: string; ageGroup: PersonFactors["ageGroup"]; careNotes: string };
  annotations: Array<{ label: string; x: number; y: number; width: number; height: number }>;
  decisionTrail: Array<{ stage: string; result: string; llm?: boolean }>;
  lastSeenTime: string;
  reason?: string;
  familyFacts: string[];
  urgencyAssessedAt: string;
  urgencyInputs: {
    scene: Omit<SceneClues, "photoTakenAt"> & { photoTakenAt?: string };
    person: DemoPersonFactors;
  };
  urgency: UrgencyResult;
};

// Location reports stay precomputed. Family scenario scores use the unchanged
// scorer and relative timestamps, replacing legacy JSON urgency snapshots.
const sampleBasePath = import.meta.env?.BASE_URL ?? "/";
export const demoSamples: DemoSample[] = ([...records, teenRecord] as unknown as DemoSample[]).map(
  (record) => {
    const details = caseDetails[record.investigation.id as keyof typeof caseDetails];
    if (!details) throw new Error(`Missing sample case details: ${record.investigation.id}`);
    return { ...record, ...details, caseFile: { ...details.caseFile, ageGroup: details.caseFile.ageGroup as PersonFactors["ageGroup"] }, ...assessDemoScenario(record.investigation.id), imageUrl: `${sampleBasePath}${record.imageUrl}` };
  },
);

export function refreshDemoSample(sample: DemoSample, now = new Date(), overrides?: DemoOverrides): DemoSample {
  const refreshed = { ...sample, ...assessDemoScenario(sample.investigation.id, now) };
  if (!overrides) return refreshed;
  const person = { ...refreshed.urgencyInputs.person, ageGroup: overrides.ageGroup };
  const scene = { ...refreshed.urgencyInputs.scene, photoTakenAt: new Date(refreshed.urgencyInputs.scene.photoTakenAt) };
  return {
    ...refreshed,
    caseFile: { nickname: overrides.nickname, ageGroup: overrides.ageGroup, careNotes: overrides.careNotes },
    reason: overrides.reason,
    familyFacts: [
      ...refreshed.familyFacts.filter((fact) => !["Adult", "Child", "Teen", "Age 78"].includes(fact)),
      ({ child: "Child", teen: "Teen", adult: "Adult", older_adult: "Older adult" } as Record<string, string>)[overrides.ageGroup ?? ""] ?? "Age not supplied",
    ],
    urgencyInputs: { ...refreshed.urgencyInputs, person },
    urgency: assessDemoUrgency(scene, person, now),
  };
}

export function getDemoSample(id: string | null | undefined) {
  return demoSamples.find((sample) => sample.investigation.id === id);
}
