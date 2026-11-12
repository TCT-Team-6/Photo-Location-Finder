// Deterministic AI Guide demos. Saved replies and saved results only:
// no live API, no database, no model calls.
import type { GuideFacts } from '@workspace/api-client-react';
import records from './demo-cases.json';
import { assessUrgency, type PersonFactors, type SceneClues, type UrgencyResult } from './urgency';
import { groundActions, type GroundedAction, type ProposedAction, type SavedPlace, type SavedResults } from './guide-grounding';

/** Fixed reference clock so demo urgency is stable. */
export const GUIDE_DEMO_NOW = new Date('2026-11-02T19:00:00.000Z');

type Rec = { imageUrl: string; investigation: { id: string; candidates: { place: string; confidence: number; rationale: string; clues: string[] }[]; analysis?: { search_areas?: { name?: string; latitude?: number; longitude?: number }[] } | null } };

export type GuideDemoStep = { ai: string; question?: boolean; answers: string[] };

export type GuideDemo = {
  slug: 'alex' | 'joe';
  sampleId: string;
  name: string;
  imageUrl: string;
  imageCaption: string;
  opening: string;
  steps: GuideDemoStep[];
  closing: string;
  facts: GuideFacts;
  scene: Omit<SceneClues, 'photoTakenAt'>;
  hoursAgo: number;
  person: PersonFactors;
  proposed: ProposedAction[];
};

function placesFor(id: string): SavedPlace[] {
  const rec = (records as unknown as Rec[]).find((r) => r.investigation.id === id);
  if (!rec) return [];
  const areas = rec.investigation.analysis?.search_areas ?? [];
  return rec.investigation.candidates.flatMap((c, i) => {
    const a = areas.find((s) => s.name === c.place);
    if (a?.latitude === undefined || a.longitude === undefined) return [];
    return [{ sourceId: `place-${i + 1}`, name: c.place, confidence: c.confidence, latitude: a.latitude, longitude: a.longitude, rationale: c.rationale, clues: c.clues }];
  });
}

function imageFor(id: string) {
  const rec = (records as unknown as Rec[]).find((r) => r.investigation.id === id);
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return rec ? `${base}${rec.imageUrl}` : '';
}

const baseFacts: GuideFacts = {
  ageGroup: null, mayWanderOrBeConfused: null, needsMedication: null, limitedMobility: null, nonverbal: null,
  lastSeenTime: null, lastSeenPlace: null, clothing: null, called911: null, safetyReason: null,
  purpose: 'find_missing_person', missingFields: [],
};

export const guideDemos: Record<'alex' | 'joe', GuideDemo> = {
  alex: {
    slug: 'alex', sampleId: 'sample-lost-hiker', name: 'Alex', imageUrl: imageFor('sample-lost-hiker'),
    imageCaption: 'Last trail photo, shared by the hiking group',
    opening: 'My friend Alex went hiking alone and stopped answering 5 hours ago. Their last photo was on a steep trail.',
    steps: [
      { ai: 'Please call 911 now. Someone alone on a steep, cold trail and not answering for 5 hours may need rescue. Have you called 911 yet?', question: true, answers: ['Yes', 'No', 'Not sure'] },
      { ai: 'Noted. Roughly what time was Alex last heard from?', question: true, answers: ['Around 2:00 PM', 'Not sure'] },
      { ai: 'Does Alex have any medical needs or trouble walking?', question: true, answers: ['No', 'Yes', 'Not sure'] },
    ],
    closing: 'I have what I need. The saved sample results are ready below. Each card links to the evidence behind it.',
    facts: { ...baseFacts, ageGroup: 'adult', lastSeenTime: 'About 2:00 PM, 5 hours ago', lastSeenPlace: 'Steep mountain trail (from last photo)', called911: null, safetyReason: 'Hiking alone, not answering for 5 hours' },
    scene: { setting: 'trail', terrain: 'steep', temperatureC: 6, timeOfDay: 'afternoon' },
    hoursAgo: 5,
    person: { ageGroup: 'adult' },
    proposed: [
      { kind: 'call', sourceId: 'risk-1', sourceName: 'Remote terrain', confidence: null },
      { kind: 'map', sourceId: 'place-1', sourceName: 'Tatra National Park', confidence: 0.82 },
      { kind: 'share', sourceId: 'place-1', sourceName: 'Tatra National Park', confidence: 0.82 },
      // Saved model output that does not match any saved result. Grounding drops it.
      { kind: 'map', sourceId: 'place-9', sourceName: 'Mountain hut near the summit', confidence: 0.91, prose: 'Alex is probably at the hut.' },
    ],
  },
  joe: {
    slug: 'joe', sampleId: 'sample-grandparent', name: 'Grandpa Joe', imageUrl: imageFor('sample-grandparent'),
    imageCaption: 'Last photo, by the park pond',
    opening: 'My grandpa Joe is 78, has dementia and takes heart medication. He walked out about 2 hours ago. His last photo was by the park pond.',
    steps: [
      { ai: 'Please call 911 now. A 78-year-old with dementia who needs heart medication is at high risk. Have you called 911?', question: true, answers: ['Yes', 'No', 'Not sure'] },
      { ai: 'Noted. Which park was he last seen near?', question: true, answers: ['The park with the pond near home', 'Not sure'] },
    ],
    closing: 'I have the required facts. The saved sample results are ready below. Nothing here confirms where Joe is.',
    facts: { ...baseFacts, ageGroup: 'older_adult', mayWanderOrBeConfused: true, needsMedication: true, lastSeenTime: 'About 2 hours ago', lastSeenPlace: 'Park, near the pond', called911: null, safetyReason: 'Dementia and heart medication, walked out alone' },
    scene: { setting: 'park', nearWater: true, temperatureC: 29, timeOfDay: 'evening' },
    hoursAgo: 2,
    person: { ageGroup: 'older_adult', mayWanderOrBeConfused: true, needsMedication: true },
    proposed: [
      { kind: 'call', sourceId: 'risk-4', sourceName: 'Needs medication', confidence: null },
      { kind: 'map', sourceId: 'place-1', sourceName: 'Golden Gate Park', confidence: 0.76 },
      { kind: 'share', sourceId: 'place-1', sourceName: 'Golden Gate Park', confidence: 0.76 },
      { kind: 'map', sourceId: 'place-2', sourceName: 'Stanley Park', confidence: 0.99 },
    ],
  },
};

export function getGuideDemo(slug: string | undefined) {
  return slug === 'alex' || slug === 'joe' ? guideDemos[slug] : null;
}

export function demoUrgency(demo: GuideDemo, now = GUIDE_DEMO_NOW): UrgencyResult {
  const scene: SceneClues = { ...demo.scene, photoTakenAt: new Date(now.getTime() - demo.hoursAgo * 3_600_000) };
  return assessUrgency(scene, demo.person, now);
}

/** The first saved step asks about 911; the tapped reply sets called911 in memory. */
export function demoFactsWithAnswers(demo: GuideDemo, answers: string[]): GuideFacts {
  const a = answers[0]?.trim().toLowerCase();
  const called911 = a === 'yes' ? true : a === 'no' ? false : null;
  return { ...demo.facts, called911 };
}

export function demoReportFacts(demo: GuideDemo) {
  return [
    `Last seen: ${demo.facts.lastSeenTime ?? 'Unknown'} (user-reported)`,
    `Place: ${demo.facts.lastSeenPlace ?? 'Unknown'} (user-reported)`,
    `Reason for concern: ${demo.facts.safetyReason ?? 'Unknown'} (user-reported)`,
  ];
}

export function demoResults(demo: GuideDemo, now = GUIDE_DEMO_NOW): SavedResults {
  const u = demoUrgency(demo, now);
  return {
    urgencyLevel: u.level,
    risks: u.risks.map((r, i) => ({ sourceId: `risk-${i + 1}`, name: r.label, confidence: null, reason: r.reason, points: r.points })),
    places: placesFor(demo.sampleId),
    reportFacts: demoReportFacts(demo),
  };
}

export function demoGroundedActions(demo: GuideDemo, now = GUIDE_DEMO_NOW): GroundedAction[] {
  return groundActions(demo.proposed, demoResults(demo, now));
}
