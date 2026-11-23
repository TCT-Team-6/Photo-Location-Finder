import { coordinatesFromMapsUrl, modelScoreUnit } from "./geographic-confidence";

/** Shared Confidence tiers. Colors are used verbatim by pins, bars and the heat legend. */
export type ConfidenceTierKey = "strong" | "possible" | "weak" | "unavailable";
export type ConfidenceTier = { key: ConfidenceTierKey; label: string; color: string; rgb: [number, number, number] };

export const CONFIDENCE_TIERS: Record<ConfidenceTierKey, ConfidenceTier> = {
  strong: { key: "strong", label: "Strong lead", color: "#2f7550", rgb: [47, 117, 80] },
  possible: { key: "possible", label: "Possible lead", color: "#9a4f14", rgb: [154, 79, 20] },
  weak: { key: "weak", label: "Weak lead", color: "#5f645e", rgb: [95, 100, 94] },
  unavailable: { key: "unavailable", label: "Confidence not supplied", color: "#a8aca5", rgb: [168, 172, 165] },
};

export const CONFIDENCE_DEFINITION = "Confidence = how well the clues in the photo match this place.";

/** Raw API value in, whole 0–100 Confidence out (null when unusable). Scale handled by modelScoreUnit. */
export function confidencePercent(raw: number): number | null {
  const unit = modelScoreUnit(raw);
  return unit === null ? null : Math.round(unit * 100);
}

export function confidenceTier(percent: number | null): ConfidenceTier {
  if (percent === null) return CONFIDENCE_TIERS.unavailable;
  if (percent >= 75) return CONFIDENCE_TIERS.strong;
  if (percent >= 50) return CONFIDENCE_TIERS.possible;
  return CONFIDENCE_TIERS.weak;
}

/** Heat colour for a 0–1 intensity: grey (weak) → orange (possible) → green (strong). */
export function heatColor(intensity: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, intensity));
  const { weak, possible, strong } = CONFIDENCE_TIERS;
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k)) as [number, number, number];
  if (t < 0.5) return mix(weak.rgb, possible.rgb, t / 0.5);
  if (t < 0.75) return mix(possible.rgb, strong.rgb, (t - 0.5) / 0.25);
  return strong.rgb;
}

const STOP = new Set(["with", "from", "that", "this", "near", "into", "over", "under", "along", "their", "there", "which", "visible", "setting"]);
function tokens(value: string) {
  return value.toLocaleLowerCase().replaceAll("_", " ").replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, ""));
}

/** True when two short clue phrases share a meaningful word (simple stem match). */
export function cluesOverlap(a: string, b: string) {
  const ta = tokens(a), tb = new Set(tokens(b));
  return ta.some((w) => tb.has(w));
}

export type SupportingClue = { label: string; photoTag: string | null; source: "lead" | "rationale" };

/**
 * Supporting clues come only from returned evidence: the lead's own clue list, plus photo
 * tags whose wording appears in the lead's rationale. Nothing is invented.
 */
export function supportingClues(lead: { clues: string[]; rationale: string }, photoTags: string[]): SupportingClue[] {
  const out: SupportingClue[] = [];
  const seen = new Set<string>();
  for (const clue of lead.clues) {
    const label = clue.replaceAll("_", " ").trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ label: label[0].toLocaleUpperCase() + label.slice(1), photoTag: photoTags.find((tag) => cluesOverlap(label, tag)) ?? null, source: "lead" });
  }
  if (lead.rationale) {
    const rationale = lead.rationale.toLowerCase();
    for (const tag of photoTags) {
      if (out.some((c) => c.photoTag === tag) || seen.has(tag.toLowerCase())) continue;
      if (rationale.includes(tag.toLowerCase())) { seen.add(tag.toLowerCase()); out.push({ label: tag, photoTag: tag, source: "rationale" }); }
    }
  }
  return out;
}

export const PIPELINE_STAGES = ["Photo check", "Scene reading", "Location ideas", "Map check", "Ranking"] as const;
export type PipelineStage = { name: (typeof PIPELINE_STAGES)[number]; complete: boolean; evidence: string };
export type PipelineSummary = { stages: PipelineStage[]; model: string | null; durationLabel: string | null; sourceLabel: string | null };

type LiveLike = {
  status?: string | null;
  summary?: string;
  clues: unknown[];
  candidates: Array<{ confidence: number; mapsUrl: string }>;
  analysis?: { forensics?: object; details?: { exif?: object }; source?: string; reasoning_trace?: unknown[] } | null;
};

/** Live checks reflect what the saved response actually contains, never elapsed-time guesses. */
export function livePipeline(item: LiveLike): PipelineSummary {
  const a = item.analysis ?? null;
  const photoChecked = Boolean(a?.forensics || a?.details?.exif);
  const mapped = item.candidates.filter((c) => coordinatesFromMapsUrl(c.mapsUrl)).length;
  const scored = item.candidates.filter((c) => modelScoreUnit(c.confidence) !== null).length;
  const stages: PipelineStage[] = [
    { name: "Photo check", complete: photoChecked, evidence: photoChecked ? "Photo metadata or integrity notes were returned." : "No photo-check details in this response." },
    { name: "Scene reading", complete: item.clues.length > 0, evidence: item.clues.length ? `${item.clues.length} visual clue${item.clues.length === 1 ? "" : "s"} returned.` : "No visual clues returned." },
    { name: "Location ideas", complete: item.candidates.length > 0, evidence: item.candidates.length ? `${item.candidates.length} possible place${item.candidates.length === 1 ? "" : "s"} returned.` : "No places returned." },
    { name: "Map check", complete: mapped > 0, evidence: mapped ? `${mapped} place${mapped === 1 ? "" : "s"} with usable map coordinates.` : "No usable map coordinates returned." },
    { name: "Ranking", complete: scored > 0, evidence: scored ? `${scored} place${scored === 1 ? "" : "s"} carry a Confidence value.` : "No Confidence values returned." },
  ];
  // The API exposes no model name or timing; only the provider-level source label, when present.
  return { stages, model: null, durationLabel: null, sourceLabel: a?.source?.trim() || null };
}

/** Demo checks come from the prepared decision trail rows (one per stage, in order). */
export function demoPipeline(trail: Array<{ stage: string; result: string }>): PipelineSummary {
  const stages = PIPELINE_STAGES.map((name, i) => ({ name, complete: Boolean(trail[i]?.result), evidence: trail[i]?.result ?? "No trail entry." }));
  const modelMatch = trail.map((r) => r.stage.match(/^(GPT[\w\s.-]*?)\s+scene reading$/i)?.[1]).find(Boolean);
  return { stages, model: modelMatch ?? null, durationLabel: null, sourceLabel: null };
}
