import { useState } from "react";
import { ArrowUpRight, Check, Copy, MapPin } from "lucide-react";
import { scoreOutOf100 } from "@/lib/lead-summary";

type Lead = {
  place: string;
  region?: string | null;
  country?: string | null;
  confidence: number;
  mapsUrl: string;
};

/** The big "Best guess" panel at the top of a results page. */
export function BestGuessCard({ lead, summaryText }: { lead: Lead; summaryText: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const area = [lead.region, lead.country].filter(Boolean).join(", ");
  const score = scoreOutOf100(lead.confidence);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2500);
  };

  return (
    <section className="best-guess-card mb-5 overflow-hidden rounded-2xl p-5 text-white shadow-lg" data-testid="panel-best-guess">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-data text-[10px] uppercase tracking-[.18em] text-[#ffb070]">
          <MapPin size={14} aria-hidden="true" /> Best guess
        </p>
        <p className="font-data text-[10px] uppercase tracking-[.12em] text-white/80">Model score {score} / 100</p>
      </div>
      <h2 className="mt-3 font-editorial text-4xl leading-tight" data-testid="text-best-guess-place">{lead.place}</h2>
      {area && <p className="mt-1 text-sm text-white/80">{area}</p>}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
        <div className="h-full rounded-full bg-[#ff7a1a]" style={{ width: `${Math.max(score, 4)}%` }} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <a
          href={lead.mapsUrl}
          target="_blank"
          rel="noreferrer"
          data-testid="link-best-guess-map"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ff7a1a] px-5 text-sm font-semibold text-[#0b1a2e] transition hover:bg-[#ff9142]"
        >
          Open in Google Maps <ArrowUpRight size={16} />
        </a>
        <button
          type="button"
          onClick={copySummary}
          data-testid="button-copy-summary"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/40 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          {copyState === "copied" ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy summary</>}
        </button>
      </div>
      <p role="status" className="sr-only">{copyState === "copied" ? "Summary copied to the clipboard." : copyState === "failed" ? "Copy failed." : ""}</p>
      {copyState === "failed" && <p className="mt-2 text-xs text-[#ffb070]">Your browser blocked copying. Select the text in the report instead.</p>}
      <p className="mt-4 text-xs leading-5 text-white/75">A lead to check, not a confirmed location.</p>
    </section>
  );
}
