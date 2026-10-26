import { useState, type RefObject } from "react";
import { AlertTriangle, Film, MapPin, Play, RotateCcw } from "lucide-react";
import type { Investigation } from "@workspace/api-client-react";
import { AnalysisProgress } from "@/components/analysis-status";
import { embeddedGps, investigationMediaUrl, keyMoments } from "@/lib/video-analysis";

export function VideoPlayer({ id, name, playerRef }: { id: string; name: string; playerRef: RefObject<HTMLVideoElement | null> }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className="px-6 text-center text-sm text-[#7c8378]" data-testid="status-video-error"><Film size={26} className="mx-auto mb-3 text-[#a06d4b]" />The saved video is temporarily unavailable.</div>;
  }
  return <video ref={playerRef} src={investigationMediaUrl(id)} controls preload="metadata" playsInline onError={() => setFailed(true)} aria-label={`Saved video: ${name}`} className="max-h-[620px] w-full rounded-2xl bg-[#1f3029] object-contain" data-testid="video-investigation-player" />;
}

export function EmbeddedGpsNotice({ analysis }: { analysis: Investigation["analysis"] }) {
  const gps = embeddedGps(analysis);
  if (!gps) return null;
  return (
    <section className="mb-6 flex flex-col gap-3 rounded-2xl border border-[#b9c9b8] bg-[#edf1e7] p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="panel-video-gps">
      <div className="flex items-start gap-3">
        <MapPin size={20} className="mt-0.5 shrink-0 text-[#385e51]" aria-hidden="true" />
        <div>
          <p className="font-editorial text-2xl text-[#263d36]">GPS found in the video file</p>
          <p className="mt-1 font-data text-xs text-[#53685d]" data-testid="text-video-gps">{gps.label}</p>
        </div>
      </div>
      <a href={gps.mapsUrl} target="_blank" rel="noreferrer" data-testid="link-video-gps-map" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#9aaf9d] px-5 text-xs font-semibold text-[#385e51] hover:bg-[#e2e9db]">Open in Google Maps</a>
    </section>
  );
}

export function KeyMoments({ analysis, onSeek }: { analysis: Investigation["analysis"]; onSeek: (seconds: number) => void }) {
  const moments = keyMoments(analysis);
  if (!moments.length) return null;
  return (
    <section className="mt-7 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-6" data-testid="panel-key-moments">
      <p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">Key moments</p>
      <ul className="mt-4 divide-y divide-[#e1dbce]">
        {moments.map((moment, position) => (
          <li key={`${moment.index}-${position}`} className="flex items-start gap-3 py-3">
            <button type="button" onClick={() => onSeek(moment.timestamp)} aria-label={`Jump to ${moment.label}`} data-testid={`button-key-moment-${position}`} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#b9c4b5] px-3 font-data text-xs text-[#385e51] hover:bg-[#e8e4d8]"><Play size={11} />{moment.label}</button>
            <p className="pt-2 text-xs leading-5 text-[#53685d]">{moment.places.length ? moment.places.join(" · ") : moment.cluesFound === true ? "Clues noted in this frame" : moment.cluesFound === false ? "No clear clues in this frame" : "Frame selected for analysis"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Progress while a saved video is analyzing, or a failure with a retry that resumes polling. */
export function VideoAnalysisStatus({ item, retrying, retryError, onRetry }: { item: Investigation; retrying: boolean; retryError: string; onRetry: () => void }) {
  if (item.status === "analyzing") {
    return <div data-testid="status-video-analyzing"><AnalysisProgress stage="analyzing" startedAt={new Date(item.updatedAt).getTime() || Date.now()} photoCount={1} desk="original" video /></div>;
  }
  if (item.status !== "failed") return null;
  return (
    <section role="alert" data-testid="panel-video-analysis-failed" className="mb-6 rounded-2xl border border-[#dfc6b6] bg-[#f9eee6] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle size={22} className="mt-0.5 shrink-0 text-[#875545]" aria-hidden="true" />
        <div>
          <p className="font-editorial text-2xl text-[#704f3d]">The video could not be analyzed</p>
          <p className="mt-1 text-sm leading-6 text-[#875545]" data-testid="text-video-analysis-error">{item.analysisError || "The location service could not finish. This is usually temporary."}</p>
          <p className="mt-1 text-xs text-[#875545]">Your video is saved, so you don’t need to upload it again.</p>
          {retryError && <p className="mt-2 text-xs font-semibold text-[#875545]">{retryError}</p>}
        </div>
      </div>
      <button type="button" onClick={onRetry} disabled={retrying} data-testid="button-retry-video-analysis" className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-sm font-semibold text-[#f4f0e6] disabled:opacity-60"><RotateCcw size={16} />{retrying ? "Starting again…" : "Try again"}</button>
    </section>
  );
}
