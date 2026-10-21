import type { PrivateCaseData } from "@workspace/db";

type ReviewDraft = { observations: string; nextSteps: string; expectedRevision: number };

/** Compare the draft's base version while the caller holds the case row lock. */
export function buildCaseReview(current: PrivateCaseData["review"], draft: ReviewDraft, now = new Date()) {
  const revision = current?.revision ?? 0;
  if (draft.expectedRevision !== revision) return null;
  return {
    observations: draft.observations,
    nextSteps: draft.nextSteps,
    revision: revision + 1,
    updatedAt: now.toISOString(),
  };
}
