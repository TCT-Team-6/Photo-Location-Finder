export type AnalysisStage = "uploading" | "analyzing";

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
