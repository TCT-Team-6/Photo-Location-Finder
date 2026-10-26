import { useEffect, useState } from "react";
import { AlertTriangle, Check, Eye, FileText, ListOrdered, RotateCcw, Search, Upload } from "lucide-react";
import "./analysis-progress.css";
import { VIDEO_PROGRESS_MESSAGE } from "@/lib/video-analysis";
import {
  pipelineLinks,
  pipelineStatuses,
  pipelineSteps,
  pipelineTools,
  pipelineToolNote,
  stageAnnouncement,
  statusText,
  type AnalysisStage,
  type AnalysisDesk,
} from "./analysis-progress-model";

export type { AnalysisStage };

const stepIcons = [Upload, Eye, Search, ListOrdered, FileText];

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Shown while a photo is being uploaded and analyzed (this can take a few minutes). */
export function AnalysisProgress({
  stage,
  startedAt,
  photoCount,
  desk = "original",
  video = false,
}: {
  stage: AnalysisStage;
  startedAt: number;
  photoCount: number;
  desk?: AnalysisDesk;
  video?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const statuses = pipelineStatuses(stage);
  const links = pipelineLinks(stage);
  const tools = pipelineTools(desk);

  return (
    <section
      data-testid="panel-analysis-progress"
      className="ap-root mt-6 rounded-2xl border border-[#d8d1c2] bg-[#fbf9f3] p-5"
    >
      <div className="ap-grid" aria-hidden="true" />
      <p className="ap-sr" role="status" aria-live="polite">{stageAnnouncement(stage)}</p>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-editorial text-2xl text-[#263d36]">
          Looking for clues{photoCount > 1 ? ` in ${photoCount} photos` : ""}…
        </p>
        <span className="font-data text-2xl text-[#263d36]" aria-label={`${elapsed} seconds elapsed`}>
          {formatElapsed(elapsed)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#718078]" data-testid={video ? "text-video-progress" : undefined}>
        {video ? VIDEO_PROGRESS_MESSAGE : "This usually takes 1–3 minutes. Please keep this page open."}
      </p>
      <div className="ap-panel">
        <p className="ap-eyebrow">Pipeline overview</p>
        <p className="ap-note">
          Animation illustrates the workflow; individual backend stages are not reported live.
        </p>
        <ol className="ap-track" aria-label="Pipeline overview">
          {pipelineSteps.map((step, index) => {
            const status = statuses[index];
            const Icon = stepIcons[index];
            return (
              <li
                key={step.id}
                className="ap-step"
                data-status={status}
                data-link={index < links.length ? links[index] : undefined}
                aria-current={status === "active" ? "step" : undefined}
              >
                <span className="ap-node" aria-hidden="true">
                  {status === "done" ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
                </span>
                {index < links.length && (
                  <span className="ap-link" aria-hidden="true"><i /></span>
                )}
                <span className="ap-label">
                  {step.label}
                  <span className="ap-tool">{tools[index].label}</span>
                  <span className="ap-tool-note">{tools[index].detail}</span>
                  <span className="ap-state">{statusText(status)}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="ap-tool-disclosure">{pipelineToolNote(desk)}</p>
      </div>
      {elapsed > 150 && (
        <p className="mt-4 text-xs text-[#718078]">
          Still working — busy times can take longer. If it fails, your photo stays selected so you can try again.
        </p>
      )}
    </section>
  );
}

/** Shown when no photo could be analyzed. Keeps the photo selected so one tap retries. */
export function AnalysisFailed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section
      role="alert"
      data-testid="panel-analysis-failed"
      className="mt-6 rounded-2xl border border-[#dfc6b6] bg-[#f9eee6] p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={22} className="mt-0.5 shrink-0 text-[#875545]" aria-hidden="true" />
        <div>
          <p className="font-editorial text-2xl text-[#704f3d]">That didn’t work this time</p>
          <p className="mt-1 text-sm leading-6 text-[#875545]">{message}</p>
          <p className="mt-1 text-xs text-[#875545]">Your photo is still selected, so you don’t need to choose it again.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        data-testid="button-retry-analysis"
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-sm font-semibold text-[#f4f0e6]"
      >
        <RotateCcw size={16} /> Try again
      </button>
    </section>
  );
}
