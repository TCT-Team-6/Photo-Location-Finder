import { assessUrgency, type PersonFactors, type SceneClues } from "./urgency";

// Fictional family-provided facts, never inferred from the sample photographs.
export const demoScenarios: Record<string, {
  hoursAgo: number;
  scene: Omit<SceneClues, "photoTakenAt">;
  person: PersonFactors;
  familyFacts: string[];
}> = {
  "sample-lost-hiker": {
    hoursAgo: 5,
    scene: { setting: "trail", terrain: "steep", temperatureC: 6, timeOfDay: "afternoon" },
    person: { ageGroup: "adult" },
    familyFacts: ["Photo taken 5 hours ago", "Trail", "Steep terrain", "6°C", "Afternoon", "Adult"],
  },
  "sample-grandparent": {
    hoursAgo: 3,
    scene: { setting: "park", temperatureC: 29, timeOfDay: "evening" },
    person: { ageGroup: "older_adult", mayWanderOrBeConfused: true, needsMedication: true },
    familyFacts: ["Photo taken 3 hours ago", "Park", "29°C", "Evening", "Age 78", "May wander or be confused", "Needs medication"],
  },
  "sample-child-separated": {
    hoursAgo: 0.5,
    scene: { setting: "beach", nearWater: true, temperatureC: 30, timeOfDay: "afternoon" },
    person: { ageGroup: "child" },
    familyFacts: ["Photo taken 30 minutes ago", "Beach", "Water nearby", "30°C", "Afternoon", "Child"],
  },
};

export function assessDemoScenario(id: string, now = new Date()) {
  const scenario = demoScenarios[id];
  if (!scenario) throw new Error(`Missing fictional family scenario: ${id}`);
  const scene: SceneClues = {
    ...scenario.scene,
    photoTakenAt: new Date(now.getTime() - scenario.hoursAgo * 3_600_000),
  };
  const person = { ...scenario.person };
  return {
    familyFacts: [...scenario.familyFacts],
    urgencyAssessedAt: now.toISOString(),
    urgencyInputs: { scene: { ...scene, photoTakenAt: scene.photoTakenAt!.toISOString() }, person },
    urgency: assessUrgency(scene, person, now),
  };
}

export const demoProgressStages = [
  "Checking photo metadata & authenticity",
  "Reading the scene with AI vision",
  "Generating location hypotheses",
  "Ranking likely places",
  "Preparing results & health risk summary",
] as const;
