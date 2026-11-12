// Pure grounding for AI Guide action cards. An action proposed by AI prose is
// only shown when it names a saved result whose id, name and confidence match
// exactly. Titles and reasons are rebuilt from canonical evidence, never copied
// from the proposal. Risks come from the unchanged urgency rules and carry no
// confidence (null); places carry their saved match score.

export type GuideActionCardKind = 'call' | 'share' | 'map' | 'print' | 'checked';

export type SavedPlace = {
  sourceId: string;
  name: string;
  confidence: number;
  latitude: number;
  longitude: number;
  rationale: string;
  clues: string[];
};

export type SavedRisk = {
  sourceId: string; // risk-N
  name: string; // risk label from assessUrgency
  confidence: null;
  reason: string;
  points: number;
};

export type SavedResults = {
  urgencyLevel: string;
  risks: SavedRisk[];
  places: SavedPlace[];
  reportFacts: string[];
};

export type ProposedAction = {
  kind: GuideActionCardKind;
  sourceId: string;
  sourceName: string;
  confidence: number | null;
  /** Unchecked AI prose. Never rendered. */
  prose?: string;
};

export type GroundedAction = {
  kind: GuideActionCardKind;
  sourceId: string;
  sourceName: string;
  title: string;
  reason: string;
  evidence: string[];
  mapUrl?: string;
  confidence: number | null;
};

export function mapUrlFor(place: Pick<SavedPlace, 'latitude' | 'longitude'>) {
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return null;
  if (Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.latitude},${place.longitude}`)}`;
}

export function pct(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function groundAction(action: ProposedAction, results: SavedResults): GroundedAction | null {
  if (action.kind === 'call') {
    const risk = results.risks.find((r) => r.sourceId === action.sourceId);
    if (!risk || risk.name !== action.sourceName || action.confidence !== null) return null;
    return {
      kind: 'call', sourceId: risk.sourceId, sourceName: risk.name, confidence: null,
      title: `Call 911: ${risk.name}`,
      reason: `${risk.reason} Overall urgency is ${results.urgencyLevel} (a rules-based estimate, not a probability).`,
      evidence: results.risks.map((r) => `${r.name}: ${r.reason}`),
    };
  }
  const place = results.places.find((p) => p.sourceId === action.sourceId);
  if (!place || place.name !== action.sourceName || place.confidence !== action.confidence) return null;
  const url = mapUrlFor(place);
  if (!url) return null;
  const score = `match score ${pct(place.confidence)}`;
  const evidence = [`Why ${place.name}: ${place.rationale}`, ...place.clues.map((c) => `Clue: ${c}`)];
  const base = { sourceId: place.sourceId, sourceName: place.name, confidence: place.confidence, evidence, mapUrl: url };
  switch (action.kind) {
    case 'map': return { ...base, kind: 'map', title: `Open ${place.name} on a map`, reason: `Top saved search suggestion (${score}). ${place.rationale}` };
    case 'checked': return { ...base, kind: 'checked', title: `${place.name} marked checked`, reason: place.rationale };
    case 'share': return { ...base, kind: 'share', title: 'Share the responder report', reason: `The report lists ${place.name} (${score}) as a saved search suggestion, not a confirmed location. Facts are user-reported and unverified.` };
    case 'print': return { ...base, kind: 'print', title: 'Print the responder summary', reason: `Includes ${place.name} (${score}) as a search suggestion.` };
  }
}

export function groundActions(actions: ProposedAction[], results: SavedResults): GroundedAction[] {
  const seen = new Set<string>();
  const out: GroundedAction[] = [];
  for (const a of actions) {
    const g = groundAction(a, results);
    if (!g) continue;
    const key = `${g.kind}:${g.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
  }
  return out;
}

/** Unchecked places first in saved rank order, then checked ones. */
export function orderPlaces(places: SavedPlace[], checked: ReadonlySet<string>) {
  return [...places.filter((p) => !checked.has(p.sourceId)), ...places.filter((p) => checked.has(p.sourceId))];
}

export function nextUncheckedPlace(places: SavedPlace[], checked: ReadonlySet<string>) {
  return places.find((p) => !checked.has(p.sourceId)) ?? null;
}
