import { assessUrgency, type PersonFactors, type SceneClues, type UrgencyLevel } from "./urgency";

export type DemoPersonFactors = PersonFactors & { phoneUnreachable?: boolean };

// Fictional family-provided facts, never inferred from the sample photographs.
export const demoScenarios: Record<string, {
  hoursAgo: number;
  lastSeenTime: string;
  scene: Omit<SceneClues, "photoTakenAt">;
  person: DemoPersonFactors;
  familyFacts: string[];
}> = {
  "sample-lost-hiker": {
    hoursAgo: 5,
    lastSeenTime: "2:00 PM",
    scene: { setting: "trail", terrain: "steep", temperatureC: 6, timeOfDay: "afternoon" },
    person: { ageGroup: "adult" },
    familyFacts: ["Photo taken 5 hours ago", "Trail", "Steep terrain", "6°C", "Afternoon", "Adult"],
  },
  "sample-grandparent": {
    hoursAgo: 3,
    lastSeenTime: "6:30 PM",
    scene: { setting: "park", temperatureC: 29, timeOfDay: "evening" },
    person: { ageGroup: "older_adult", mayWanderOrBeConfused: true, needsMedication: true },
    familyFacts: ["Photo taken 3 hours ago", "Park", "29°C", "Evening", "Age 78", "May wander or be confused", "Needs medication"],
  },
  "sample-child-separated": {
    hoursAgo: 0.5,
    lastSeenTime: "1:30 PM",
    scene: { setting: "beach", nearWater: true, temperatureC: 30, timeOfDay: "afternoon" },
    person: { ageGroup: "child" },
    familyFacts: ["Photo taken 30 minutes ago", "Beach", "Water nearby", "30°C", "Afternoon", "Child"],
  },
  "sample-teen-night": {
    hoursAgo: 3,
    lastSeenTime: "10:00 PM",
    scene: { setting: "urban", temperatureC: 12, timeOfDay: "night" },
    person: { ageGroup: "teen", needsMedication: false, mayWanderOrBeConfused: false, phoneUnreachable: true },
    familyFacts: ["Photo taken 3 hours ago", "City / public street", "12°C", "Night", "Teen", "Phone unreachable"],
  },
};

export function assessDemoUrgency(scene: SceneClues, person: DemoPersonFactors, now = new Date()) {
  const { phoneUnreachable, ...scorerPerson } = person;
  const base = assessUrgency(scene, scorerPerson, now);
  if (!phoneUnreachable) return base;

  const score = base.score + 2;
  const level: UrgencyLevel = score >= 9 ? "Critical" : score >= 6 ? "High" : score >= 3 ? "Moderate" : "Low";
  const color = ({ Low: "green", Moderate: "yellow", High: "orange", Critical: "red" } as const)[level];
  const phoneRisk = {
    label: "Phone unreachable — can't call for help",
    reason: "No phone contact is available.",
    points: 2,
    category: "person" as const,
  };
  const risks = [...base.risks, phoneRisk].sort((a, b) => b.points - a.points);
  const nextSteps = [...base.nextSteps];
  if ((level === "High" || level === "Critical") && base.level !== "High" && base.level !== "Critical") {
    nextSteps[0] = "Call 911 now if you haven't already, and share this report with them.";
  }

  return { ...base, score, level, color, risks, nextSteps };
}

export function assessDemoScenario(id: string, now = new Date()) {
  const scenario = demoScenarios[id];
  if (!scenario) throw new Error(`Missing fictional family scenario: ${id}`);
  const scene: SceneClues = {
    ...scenario.scene,
    photoTakenAt: new Date(now.getTime() - scenario.hoursAgo * 3_600_000),
  };
  const person = { ...scenario.person };
  return {
    lastSeenTime: scenario.lastSeenTime,
    familyFacts: [...scenario.familyFacts],
    urgencyAssessedAt: now.toISOString(),
    urgencyInputs: { scene: { ...scene, photoTakenAt: scene.photoTakenAt!.toISOString() }, person },
    urgency: assessDemoUrgency(scene, person, now),
  };
}

export const demoProgressStageDurationMs = 1_000;
export const demoProgressStages = [
  "Checking photo metadata & authenticity",
  "Reading the scene with AI vision",
  "Generating location hypotheses",
  "Ranking likely places",
  "Preparing results & health risk summary",
] as const;
export const demoProgressDurationMs = demoProgressStages.length * demoProgressStageDurationMs;
