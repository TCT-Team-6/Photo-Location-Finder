import { GuideIntakeResponse, GuidePlanResponse } from "@workspace/api-zod";
import type { PrivateCaseData } from "@workspace/db";

export type GuideState = ReturnType<typeof GuideIntakeResponse.parse>;
export type GuideFacts = GuideState["facts"];
export type GuideAction = ReturnType<typeof GuidePlanResponse.parse>["actions"][number];

export const factsSchema = GuideIntakeResponse.shape.facts.strict();
export const emptyFacts: GuideFacts = {
  ageGroup: null, mayWanderOrBeConfused: null, needsMedication: null,
  limitedMobility: null, nonverbal: null, lastSeenTime: null, lastSeenPlace: null,
  clothing: null, called911: null, safetyReason: null, purpose: "unclear",
  missingFields: ["safetyReason", "lastSeenTime", "lastSeenPlace"],
};
const questions = {
  safetyReason: "What makes you concerned for this person's safety?",
  lastSeenTime: "When were they last seen? It's okay to say you don't know.",
  lastSeenPlace: "What general area were they last seen in? Please avoid an exact home address.",
};
const unknown = /^(?:unknown|not sure|i (?:do not|don't) know|unsure|n\/a)$/i;
export function normalizeFacts(value: unknown): GuideFacts {
  const facts = factsSchema.parse(value);
  for (const key of ["lastSeenTime", "lastSeenPlace", "clothing", "safetyReason"] as const) {
    facts[key] = facts[key]?.trim() || null;
    if (facts[key] && unknown.test(facts[key]!)) facts[key] = null;
  }
  facts.missingFields = (["safetyReason", "lastSeenTime", "lastSeenPlace"] as const).filter((key) => !facts[key]);
  return facts;
}
export function parseGuideFacts(raw: string): GuideFacts {
  // No substring/code-fence recovery: malformed or additional fields fail closed.
  return normalizeFacts(JSON.parse(raw));
}
export function safetyGate(facts: GuideFacts): GuideState["gate"] {
  if (facts.purpose === "tracking_concern") return "blocked";
  const reason = facts.safetyReason?.trim();
  if (reason && /^(?:none|no(?:ne)?[ .!]*|no (?:real )?(?:safety )?(?:reason|concern|danger)|just curious|curiosity|not applicable)\b/i.test(reason)) return "blocked";
  if (facts.purpose !== "find_missing_person" || !reason || reason.length < 8) return "needs_clarification";
  return "allowed";
}
export function needsEmergency(facts: GuideFacts): boolean {
  return facts.called911 !== true && (facts.mayWanderOrBeConfused === true ||
    facts.needsMedication === true || facts.limitedMobility === true || facts.nonverbal === true ||
    (facts.purpose === "find_missing_person" && Boolean(facts.safetyReason)) ||
    facts.ageGroup === "child");
}
export function readGuide(raw: unknown): GuideState | undefined {
  const result = GuideIntakeResponse.safeParse(raw);
  return result.success ? result.data : undefined;
}
export function advanceGuide(previous: GuideState | undefined, value: GuideFacts, text: string, at: string): GuideState {
  const facts = normalizeFacts(value);
  // Once a case has been flagged for tracking, narrative corrections cannot unlock it.
  if (previous?.facts.purpose === "tracking_concern") facts.purpose = "tracking_concern";
  let gate = safetyGate(facts);
  const asked = previous?.questionsAsked ?? 0;
  const alreadyAsked = new Set(previous?.log.filter((entry) => entry.role === "assistant").map((entry) => entry.text.split("\n").at(-1)));
  const missing = facts.missingFields.find((field) => !alreadyAsked.has(questions[field]));
  const question = gate !== "blocked" && asked < 3 && missing ? questions[missing] : null;
  if (gate === "needs_clarification" && !question) gate = "blocked";
  const emergency = needsEmergency(facts);
  const prefix = emergency ? "Please call 911 now.\n" : "";
  const message = gate === "blocked"
    ? "I can't help track someone or infer their whereabouts. A genuine safety concern is needed for this guide. If someone may be in danger, call 911 or contact authorized responders."
    : question ?? "Your reported facts are saved. You can add optional details or prepare a summary for authorized responders. I won't analyze the photo or infer a location.";
  return {
    facts, gate, emergency, question, questionsAsked: asked + (question ? 1 : 0),
    revision: (previous?.revision ?? 0) + 1,
    log: [...(previous?.log ?? []),
      { role: "user", text, at },
      { role: "gate", text: `Safety gate: ${gate}. No live location analysis permitted.`, at },
      { role: "assistant", text: prefix + message, at }],
  };
}
export function mapGuideToCase(data: PrivateCaseData, guide: GuideState): PrivateCaseData {
  return { ...data, guide,
    lastKnownArea: guide.facts.lastSeenPlace ?? "",
    ageDescription: guide.facts.ageGroup?.replace("_", " ") ?? data.ageDescription,
  };
}
/** Keep both views current without silently overwriting an in-flight AI answer. */
export function syncGuideForm(old: PrivateCaseData, next: PrivateCaseData): PrivateCaseData {
  const guide = readGuide(old.guide);
  if (!guide) return next;
  const facts = { ...guide.facts };
  if (old.lastKnownArea !== next.lastKnownArea) facts.lastSeenPlace = next.lastKnownArea || null;
  if (old.lastKnownDate !== next.lastKnownDate) facts.lastSeenTime = next.lastKnownDate || null;
  if (old.ageDescription !== next.ageDescription) {
    const age = next.ageDescription?.replace(" ", "_");
    facts.ageGroup = ["child", "teen", "adult", "older_adult"].includes(age ?? "") ? age as GuideFacts["ageGroup"] : null;
  }
  return { ...next, guide: { ...guide, facts: normalizeFacts(facts), emergency: needsEmergency(facts),
    revision: guide.revision + 1,
    log: [...guide.log, { role: "note", text: "Regular case form updated. Current form details take precedence over earlier messages.", at: new Date().toISOString() }],
  } };
}

export type GroundingSource = { id: string; label: string; confidence: number | null; reason: string };
/** IDs, labels AND confidence must match. Never display unverified model prose. */
export function groundActions(proposals: GuideAction[], sources: GroundingSource[]): GuideAction[] {
  const seen = new Set<string>();
  return proposals.flatMap((action) => {
    const source = sources.find((item) => item.id === action.sourceId && item.label === action.sourceLabel && item.confidence === action.confidence);
    if (!source || !["call_911", "share_report", "print_summary"].includes(action.kind) || seen.has(action.kind)) return [];
    seen.add(action.kind);
    return [{ ...action, reason: source.reason }];
  }).slice(0, 3);
}
export function responderSummary(data: PrivateCaseData, guide: GuideState, leads: Array<{ data: { title: string; source: string; notes?: string } }>): string {
  const f = guide.facts;
  const answer = (v: boolean | null) => v === null ? "Unknown" : v ? "Yes" : "No";
  return [
    "PRIVATE RESPONDER SUMMARY — user-reported, unverified information",
    `Name: ${[data.firstName, data.lastName].filter(Boolean).join(" ")}`,
    `Age / description: ${data.ageDescription || "Unknown"}`,
    `Last seen (reported): ${f.lastSeenTime || data.lastKnownDate || "Unknown"}`,
    `Last-seen general area (reported, not inferred): ${data.lastKnownArea || "Unknown"}`,
    `Safety concern: ${f.safetyReason || "Unknown"}`,
    `Clothing: ${f.clothing || "Unknown"}`,
    `May wander / be confused: ${answer(f.mayWanderOrBeConfused)}`,
    `Needs medication: ${answer(f.needsMedication)}`,
    `Limited mobility: ${answer(f.limitedMobility)}`,
    `Nonverbal: ${answer(f.nonverbal)}`,
    `911 called: ${answer(f.called911)}`,
    `Private notes: ${data.notes || "None supplied"}`,
    ...guide.log.filter((entry) => entry.role === "note").map((entry) => `Additional note: ${entry.text}`),
    ...leads.map((lead) => `Evidence: ${lead.data.title} — reported source: ${lead.data.source}${lead.data.notes ? `; ${lead.data.notes}` : ""}`),
    "Photos are reference evidence only; no image analysis, face matching or inferred whereabouts.",
    "Estimates only — not medical or emergency advice. If someone may be in danger, call 911 first.",
  ].join("\n");
}
