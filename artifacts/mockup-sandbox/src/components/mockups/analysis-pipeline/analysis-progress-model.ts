export type AnalysisStage = "uploading" | "analyzing";
export type AnalysisDesk = "original" | "recreation" | "fake-news";

export function pipelineTools(desk: AnalysisDesk) {
  const openAI = { label: "OpenAI vision", detail: "Server-configured model" };
  const locator = { label: "Image Locator", detail: "Internal models undisclosed" };
  return [
    { label: "Private storage", detail: "Upload · no AI" },
    desk === "original" ? locator : openAI,
    desk === "original" ? locator : desk === "recreation"
      ? { label: "OpenAI web search", detail: "Source-image lookup" } : openAI,
    desk === "original"
      ? { label: "Image Locator + backend", detail: "Returned scores ordered by server" }
      : { label: "OpenAI response", detail: desk === "recreation" ? "Source-match findings" : "Image-integrity findings" },
    { label: "PostgreSQL", detail: "Private report · no AI" },
  ];
}

export function pipelineToolNote(desk: AnalysisDesk) {
  return desk === "original"
    ? "Image Locator does not expose its internal models. Optional reference-photo lookup also uses OpenAI web search."
    : "OpenAI's exact model depends on the server configuration. These labels describe configured tools, not live tool activity.";
}

/** pending: not reached; active: confirmed in progress; working: illustrative, unconfirmed; awaiting: waiting on the response; done: confirmed. */
export type PipelineStatus = "pending" | "active" | "working" | "awaiting" | "done";

export const pipelineSteps = [
  { id: "upload", label: "Upload photo" },
  { id: "read", label: "Read scene" },
  { id: "compare", label: "Compare clues" },
  { id: "rank", label: "Rank findings" },
  { id: "save", label: "Save report" },
] as const;

export function pipelineStatuses(stage: AnalysisStage): PipelineStatus[] {
  if (stage === "uploading") return ["active", "pending", "pending", "pending", "pending"];
  return ["done", "working", "working", "working", "awaiting"];
}

/** Connector i sits between step i and i+1. */
export function pipelineLinks(stage: AnalysisStage): ("idle" | "done" | "flow")[] {
  if (stage === "uploading") return ["idle", "idle", "idle", "idle"];
  return ["done", "flow", "flow", "idle"];
}

export function statusText(status: PipelineStatus): string {
  switch (status) {
    case "active": return "In progress";
    case "done": return "Complete";
    case "working": return "Working, not confirmed";
    case "awaiting": return "Awaiting response";
    default: return "Not started";
  }
}

export function stageAnnouncement(stage: AnalysisStage): string {
  return stage === "uploading"
    ? "Uploading your photo."
    : "Upload complete. Analyzing your photo; waiting for the response.";
}
