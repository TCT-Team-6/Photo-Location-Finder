import { useEffect, useId, useState } from "react";
import { Clock3, ShieldAlert } from "lucide-react";
import type { Investigation } from "@workspace/api-client-react";
import { assessUrgency, type PersonFactors, type SceneClues, type UrgencyLevel, type UrgencyResult } from "../lib/urgency";
import { urgencyInputsFromInvestigation } from "../lib/urgency-inputs";

export type StoredUrgencyAssessment = {
  assessedAt: string;
  inputs: {
    scene: Omit<SceneClues, "photoTakenAt"> & { photoTakenAt?: string };
    person: PersonFactors;
  };
  result: UrgencyResult;
};

const badgeStyles: Record<UrgencyLevel, { backgroundColor: string; color: string; borderColor: string }> = {
  Low: { backgroundColor: "#e8f5e9", color: "#14532d", borderColor: "#86b99a" },
  Moderate: { backgroundColor: "#fef9c3", color: "#713f12", borderColor: "#d9bc44" },
  High: { backgroundColor: "#ffedd5", color: "#9a3412", borderColor: "#e7a467" },
  Critical: { backgroundColor: "#fee2e2", color: "#991b1b", borderColor: "#e59a9a" },
};

export function HealthUrgencyCard({ investigation, stored, person }: {
  investigation: Investigation;
  stored?: StoredUrgencyAssessment;
  person?: PersonFactors;
}) {
  const headingId = useId();
  const [now, setNow] = useState(() => new Date());
  const isStored = Boolean(stored);
  useEffect(() => {
    if (isStored) return;
    // Photo age can cross a rule threshold while a saved report is open.
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [isStored, investigation.id]);
  const liveInputs = urgencyInputsFromInvestigation(investigation, person, now);
  const inputs = stored?.inputs ?? liveInputs;
  const scene = inputs.scene;
  const result = stored?.result ?? assessUrgency(liveInputs.scene, liveInputs.person, now);
  const pending = investigation.status === "analyzing" || investigation.status === "failed";
  const sourceTimestamp = investigation.analysis?.details?.exif?.timestamp;
  const fields = [
    ["Setting", scene.setting ?? "Unknown"],
    ["Terrain", scene.terrain ?? "Unknown"],
    ["Water nearby", scene.nearWater === undefined ? "Unknown" : scene.nearWater ? "Reported in photo" : "Not reported nearby"],
    ["Weather", scene.weather?.join(", ") || "Unknown"],
    ["Photo lighting", scene.timeOfDay ?? "Unknown"],
    ["Temperature", scene.temperatureC === undefined ? "Unknown — not supplied" : `${scene.temperatureC}°C`],
  ];
  const knownPerson = Object.entries(inputs.person).filter(([, value]) => value !== undefined);

  return <section aria-labelledby={headingId} data-testid="card-health-urgency" className="my-6 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="inline-flex items-center gap-2 font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]"><ShieldAlert size={15} aria-hidden="true" />Safety summary</p>
        <h2 id={headingId} className="mt-2 font-editorial text-3xl tracking-[-.03em]">Health risk &amp; urgency</h2>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-[#718078]">Scene clues describe the photo, not current conditions or a person's present location.</p>
      </div>
      {pending
        ? <p className="rounded-full border border-[#d8d1c2] px-4 py-2 text-xs font-semibold text-[#596d61]" data-testid="status-urgency-unavailable">Assessment unavailable</p>
        : <span className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold" style={badgeStyles[result.level]} data-testid="status-urgency-level" role="status">{result.level} urgency</span>}
    </div>
    {pending ? <p className="mt-5 text-sm leading-6 text-[#596d61]" data-testid="text-urgency-pending">A completed analysis is needed before scene risks can be assessed. Do not wait for this tool in an emergency.</p> : <>
      {stored && <p className="mt-4 font-data text-[9px] uppercase tracking-[.1em] text-[#9c6d4e]" data-testid="text-urgency-snapshot">Precomputed sample assessment · fixed demonstration, not a live risk update</p>}
      <p className="mt-4 rounded-xl border border-[#ddc6aa] bg-[#f7ecdd] px-4 py-3 text-xs leading-5 text-[#604a37]" data-testid="notice-urgency-limits">Missing information can understate urgency. A Low result does not mean someone is safe. This is not an assessment of the person's medical condition.</p>
      <div className="mt-5 flex items-start gap-2 border-b border-[#e1dbce] pb-4 text-sm text-[#596d61]">
        <Clock3 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div><p data-testid="text-time-since-photo"><strong>Time since photo:</strong> {result.timeSincePhoto ?? "Unknown — usable capture metadata unavailable"}</p>
          <p className="mt-1 text-xs leading-5 text-[#718078]">Photo age is not proof of how long someone has been missing.</p>
          {sourceTimestamp && !scene.photoTakenAt && <p className="mt-1 text-xs leading-5 text-[#718078]" data-testid="text-capture-time-unusable">The capture time cannot be reliably compared with now. A missing timezone, invalid date or future camera clock is not treated as elapsed time.</p>}
        </div>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-editorial text-xl">Detected risk factors</h3>
          {result.risks.length ? <ul className="mt-3 space-y-3">{result.risks.map((risk, index) => <li key={risk.label} className="rounded-xl border border-[#e1dbce] px-4 py-3" data-testid={`item-urgency-risk-${index}`}>
            <p className="text-sm font-semibold text-[#344b42]">{risk.label} <span className="ml-1 font-data text-[9px] font-normal uppercase text-[#718078]">{risk.category}</span></p>
            <p className="mt-1 text-xs leading-5 text-[#596d61]">{risk.reason}</p>
          </li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#718078]" data-testid="text-no-urgency-risks">No rule-based risks were detected in the available inputs. This does not establish safety.</p>}
        </div>
        <div>
          <h3 className="font-editorial text-xl">Suggested next steps</h3>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6 text-[#596d61]">{result.nextSteps.map((step, index) => <li key={step} className="pl-1" data-testid={`item-urgency-step-${index}`}>{step}</li>)}</ol>
        </div>
      </div>
      <details className="mt-5 border-t border-[#e1dbce] pt-4">
        <summary className="cursor-pointer text-xs font-semibold text-[#385e51]" data-testid="button-urgency-inputs">Inputs used and missing information</summary>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label, value]) => <div key={label}><dt className="font-semibold text-[#344b42]">{label}</dt><dd className="mt-1 text-[#718078]">{value}</dd></div>)}</dl>
        <p className="mt-4 break-words text-xs leading-5 text-[#718078]">Capture metadata: {sourceTimestamp || "Not supplied"}. Upload and save dates are not used as the photo's capture time.</p>
        <p className="mt-2 text-xs leading-5 text-[#718078]">Person factors: {knownPerson.length ? knownPerson.map(([key, value]) => `${key}: ${value}`).join("; ") : "Not supplied — no age, diagnosis, medication or mobility assumptions."}</p>
      </details>
      <details className="mt-4 border-t border-[#e1dbce] pt-4">
        <summary className="cursor-pointer text-xs font-semibold text-[#385e51]" data-testid="button-urgency-scoring">How this was scored · {result.score} points</summary>
        <p className="mt-3 text-xs leading-5 text-[#718078]">0–2 points: Low · 3–5: Moderate · 6–8: High · 9 or more: Critical. Only the supplied rule-based scorer assigns points.</p>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-[#596d61]">{result.risks.map((risk) => <li key={risk.label}>{risk.label}: +{risk.points} {risk.points === 1 ? "point" : "points"}</li>)}</ul>
      </details>
    </>}
    <p className="mt-5 border-t border-[#e1dbce] pt-4 text-xs font-semibold leading-5 text-[#604a37]" data-testid="text-urgency-disclaimer">{result.disclaimer}</p>
    <p className="mt-1 text-xs leading-5 text-[#718078]">Always contact emergency services. This tool supports, but never replaces, an emergency response.</p>
  </section>;
}
