// Builds the plain-text summary that the "Copy summary" button puts on the
// clipboard, so it can be pasted into a text message or email.

export type SummaryLead = {
  place: string;
  region?: string | null;
  country?: string | null;
  confidence: number;
  mapsUrl: string;
};

export type SummaryInvestigation = {
  title: string;
  originalName: string;
  shotAt?: string | null;
  context?: string | null;
};

/** Model scores arrive as 0–1 (or sometimes 0–100); show them as 0–100. */
export function scoreOutOf100(confidence: number): number {
  const normalized = confidence > 1 ? confidence / 100 : confidence;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

export function buildLeadSummary(
  item: SummaryInvestigation,
  rankedLeads: SummaryLead[],
): string {
  const lines = [`Photo location report: ${item.title}`, `Photo: ${item.originalName}`];
  if (item.shotAt) lines.push(`Taken: ${item.shotAt.slice(0, 10)}`);
  if (rankedLeads.length === 0) {
    lines.push("", "No likely places were found.");
  } else {
    lines.push("", "Possible places (highest model score first):");
    rankedLeads.forEach((lead, index) => {
      const area = [lead.region, lead.country].filter(Boolean).join(", ");
      lines.push(
        `${index + 1}. ${lead.place}${area ? ` (${area})` : ""} — score ${scoreOutOf100(lead.confidence)}/100`,
        `   Map: ${lead.mapsUrl}`,
      );
    });
  }
  if (item.context?.trim()) lines.push("", `Notes: ${item.context.trim()}`);
  lines.push("", "These are leads to check, not confirmed locations.");
  return lines.join("\n");
}
