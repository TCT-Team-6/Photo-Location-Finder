import { useEffect, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, RotateCcw } from "lucide-react";

export type AnalysisStage = "uploading" | "analyzing";

const steps: { id: AnalysisStage | "saving"; label: string }[] = [
  { id: "uploading", label: "Uploading the photo" },
  { id: "analyzing", label: "Reading clues and matching places" },
  { id: "saving", label: "Saving your report" },
];

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
}: {
  stage: AnalysisStage;
  startedAt: number;
  photoCount: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const activeIndex = steps.findIndex((step) => step.id === stage);

  return (
    <section
      role="status"
      aria-live="polite"
      data-testid="panel-analysis-progress"
      className="mt-6 rounded-2xl border border-[#d8d1c2] bg-[#fbf9f3] p-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-editorial text-2xl text-[#263d36]">
          Looking for clues{photoCount > 1 ? ` in ${photoCount} photos` : ""}…
        </p>
        <span className="font-data text-2xl text-[#263d36]" aria-label={`${elapsed} seconds elapsed`}>
          {formatElapsed(elapsed)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#718078]">
        This usually takes 1–3 minutes. Please keep this page open.
      </p>
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li key={step.id} className="flex items-center gap-3 text-sm">
              <span
                className={`progress-step-dot ${done ? "bg-[#385e51] text-[#f4f0e6]" : active ? "border-2 border-[#385e51] text-[#385e51]" : "border border-[#c9c3b4]"}`}
                aria-hidden="true"
              >
                {done ? <Check size={13} strokeWidth={3} /> : active ? <LoaderCircle size={13} className="animate-spin" /> : null}
              </span>
              <span className={active ? "font-semibold text-[#263d36]" : done ? "text-[#263d36]" : "text-[#718078]"}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
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
