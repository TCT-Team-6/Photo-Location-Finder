import type { GuideFacts, GuideState, GuideLogEntry } from '@workspace/api-client-react';
import type { PersonFactors } from './urgency';

export const SAMPLE_LABEL = 'Sample case, fictional data';
export const CALL_911_NOW = 'Please call 911 now.';
export const MAX_REQUIRED_QUESTIONS = 3;
export const REGULAR_FORM_LINK = 'Sign in to use the form';

export const optionalQuestions = [
  { id: 'clothing', prompt: 'What were they wearing when last seen?', prefix: 'Clothing' },
  { id: 'places', prompt: 'Are there familiar places they might go?', prefix: 'Familiar places' },
  { id: 'phone', prompt: 'Is their phone on, or does it ring?', prefix: 'Phone' },
] as const;

const ageLabel: Record<string, string> = { child: 'Child', teen: 'Teen', adult: 'Adult', older_adult: 'Older adult' };
const yn = (v: boolean | null | undefined) => (v === true ? 'Yes' : v === false ? 'No' : 'Unknown');

export type FactRow = { key: string; label: string; value: string; known: boolean };

export function factRows(f: GuideFacts): FactRow[] {
  const rows: [string, string, string | null][] = [
    ['ageGroup', 'Age group', f.ageGroup ? ageLabel[f.ageGroup] : null],
    ['lastSeenTime', 'Last seen (time)', f.lastSeenTime],
    ['lastSeenPlace', 'Last seen (place)', f.lastSeenPlace],
    ['mayWanderOrBeConfused', 'May wander or be confused', f.mayWanderOrBeConfused === null ? null : yn(f.mayWanderOrBeConfused)],
    ['needsMedication', 'Needs medication', f.needsMedication === null ? null : yn(f.needsMedication)],
    ['limitedMobility', 'Limited mobility', f.limitedMobility === null ? null : yn(f.limitedMobility)],
    ['nonverbal', 'May not respond verbally', f.nonverbal === null ? null : yn(f.nonverbal)],
    ['clothing', 'Clothing', f.clothing],
    ['called911', 'Called 911', f.called911 === null ? null : yn(f.called911)],
    ['safetyReason', 'Reason for concern', f.safetyReason],
  ];
  return rows.map(([key, label, value]) => ({ key, label, value: value ?? 'Unknown', known: value !== null && value !== '' }));
}

export function personFactorsFromFacts(f: GuideFacts): PersonFactors {
  const p: PersonFactors = {};
  if (f.ageGroup) p.ageGroup = f.ageGroup;
  if (f.mayWanderOrBeConfused !== null) p.mayWanderOrBeConfused = f.mayWanderOrBeConfused;
  if (f.needsMedication !== null) p.needsMedication = f.needsMedication;
  if (f.limitedMobility !== null) p.limitedMobility = f.limitedMobility;
  if (f.nonverbal !== null) p.nonverbal = f.nonverbal;
  return p;
}

export function needsCallNow(g: Pick<GuideState, 'emergency' | 'facts'>) {
  return g.emergency && g.facts.called911 !== true;
}

/** True when a question reads as a yes/no question. */
export function isYesNoQuestion(q: string | null | undefined) {
  if (!q) return false;
  return /^(is|are|do|does|did|has|have|can|could|was|were|will|would|should)\b/i.test(q.trim());
}

export type ChatMessage = { id: string; role: 'user' | 'assistant' | 'gate' | 'note'; text: string; at?: string };

/** Convert the backend log to chat messages, prepending the emergency line if missing. */
export function chatFromGuide(g: GuideState): ChatMessage[] {
  const msgs: ChatMessage[] = g.log.map((e: GuideLogEntry, i) => ({ id: `log-${i}`, role: e.role, text: e.text, at: e.at }));
  if (needsCallNow(g) && !msgs.some((m) => m.role !== 'user' && m.text.includes(CALL_911_NOW))) {
    const firstAi = msgs.findIndex((m) => m.role !== 'user');
    const call: ChatMessage = { id: 'call-now', role: 'assistant', text: CALL_911_NOW };
    if (firstAi === -1) msgs.push(call); else msgs.splice(firstAi, 0, call);
  }
  const question = g.question?.trim();
  if (question && !msgs.some((m) => (m.role === 'assistant' || m.role === 'gate') && m.text.trim().includes(question))) {
    msgs.push({ id: 'question', role: 'assistant', text: question });
  }
  return msgs;
}

export function hasOpenQuestion(g: GuideState | undefined | null) {
  return !!g && !!g.question?.trim() && g.gate !== 'blocked';
}

export function canPlan(g: GuideState | undefined | null) {
  return !!g && g.gate === 'allowed';
}

export function questionNumber(g: GuideState) {
  return Math.min(Math.max(g.questionsAsked, 1), MAX_REQUIRED_QUESTIONS);
}

export type SummaryInput = {
  name: string;
  facts: GuideFacts;
  notes?: string[];
  planSummary?: string;
  sample?: boolean;
  extra?: string[];
};

/** Plain-text responder summary. All facts labelled as reported and unverified. */
export function buildResponderSummary(s: SummaryInput) {
  const lines: string[] = [];
  if (s.sample) lines.push(SAMPLE_LABEL, '');
  lines.push(`Responder summary: ${s.name}`);
  lines.push('All information is user-reported and unverified. Whereabouts does not confirm any person\'s location.');
  lines.push('');
  lines.push('Reported facts:');
  for (const r of factRows(s.facts)) lines.push(`- ${r.label}: ${r.value}${r.known ? ' (user-reported)' : ''}`);
  if (s.notes?.length) { lines.push('', 'Family notes (user-reported):'); for (const n of s.notes) lines.push(`- ${n}`); }
  if (s.extra?.length) { lines.push(''); lines.push(...s.extra); }
  if (s.planSummary) { lines.push('', 'Guide summary:', s.planSummary); }
  lines.push('', 'If someone may be in danger, call 911 first.');
  return lines.join('\n');
}

export const guideExamples = [
  'My grandpa has dementia and walked out 2 hours ago.',
  'My 9-year-old was separated from us at the beach 30 minutes ago.',
  'My friend went hiking alone and stopped answering 5 hours ago.',
];
