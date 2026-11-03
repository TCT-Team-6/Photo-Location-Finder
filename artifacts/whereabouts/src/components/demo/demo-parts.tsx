import { useEffect, useState } from 'react';
import { ChevronDown, Clock3, Eye, EyeOff, MapPin } from 'lucide-react';
import type { DemoSample } from '@/lib/demo-samples';
import { missingDuration } from '@/lib/demo-search';
import type { UrgencyLevel } from '@/lib/urgency';

export const ageGroupLabels: Record<string, string> = { child: 'Child', teen: 'Teen', adult: 'Adult', older_adult: 'Older adult' };

const solidBadge: Record<UrgencyLevel, string> = {
  Low: 'border border-[#86b99a] bg-[#e8f5e9] text-[#14532d]',
  Moderate: 'border border-[#d9bc44] bg-[#fef9c3] text-[#713f12]',
  High: 'border border-[#ea6a12] bg-[#ea6a12] text-white',
  Critical: 'border border-[#c62828] bg-[#c62828] text-white',
};

export function scoreLabel(score: number) {
  const normalized = score > 1 ? score / 100 : score;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

export function UrgencyBadge({ level, testId = 'status-demo-urgency-badge' }: { level: UrgencyLevel; testId?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold ${solidBadge[level]}`} data-testid={testId}>{level} urgency</span>;
}

export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatLastSeen(iso?: string) {
  if (!iso) return 'Not supplied';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function AnnotatedPhoto({ sample, compact = false }: { sample: DemoSample; compact?: boolean }) {
  const [show, setShow] = useState(true);
  const boxes = sample.annotations ?? [];
  return <div className="flex flex-col gap-2">
    <div className="relative mx-auto inline-block max-w-full overflow-hidden rounded-xl bg-[#1f302a]" data-testid="panel-demo-annotated-photo">
      <img src={sample.imageUrl} alt={`Fictional sample photograph: ${sample.investigation.title}`} className={`block h-auto w-auto max-w-full ${compact ? 'max-h-[300px]' : 'max-h-[560px]'}`} data-testid="img-demo-result-original" />
      {show && boxes.map((box, i) => <div key={`${box.label}-${i}`} className="demo-box pointer-events-none absolute rounded-md border-2 border-[#f2c14e] shadow-[0_0_0_1px_rgba(31,48,42,.5)]" style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, animationDelay: `${i * 70}ms` }} data-testid={`box-demo-annotation-${i}`}>
        <span className="absolute -top-px left-[-2px] -translate-y-full whitespace-nowrap rounded-t-md bg-[#f2c14e] px-1.5 py-0.5 font-data text-[9px] font-semibold uppercase tracking-[.06em] text-[#1f302a]">{box.label}</span>
      </div>)}
    </div>
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} data-testid="button-toggle-ai-clues" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#bdc8bb] bg-[#f8f5ec] px-3 text-[11px] font-semibold text-[#385e51] hover:bg-[#e8e4d8]">
        {show ? <EyeOff size={13} /> : <Eye size={13} />}{show ? 'Hide AI clues' : 'Show AI clues'}
      </button>
      <span className="font-data text-[9px] uppercase tracking-[.1em] text-[#829087]">{boxes.length} marked clues</span>
    </div>
  </div>;
}

export function CaseHeader({ sample, onShare }: { sample: DemoSample; onShare: () => void }) {
  const now = useNow();
  const photoAt = sample.urgencyInputs.scene.photoTakenAt;
  const missing = photoAt ? missingDuration(photoAt, now) : null;
  const top = sample.investigation.candidates[0];
  const risks = sample.urgency.risks.slice(0, 2);
  return <section className="grid gap-4 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.95fr)_minmax(0,.9fr)] lg:p-5" data-testid="panel-demo-case-header">
    <div className="min-w-0"><AnnotatedPhoto sample={sample} compact /></div>
    <div className="flex min-w-0 flex-col gap-3 lg:border-l lg:border-[#e1dbce] lg:pl-5">
      <div>
        <p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">Sample case / {sample.scenario}</p>
        <h1 className="mt-1 font-editorial text-[32px] leading-none tracking-[-.04em]" data-testid="text-demo-case-nickname">{sample.caseFile.nickname}</h1>
        <p className="mt-1.5 text-xs text-[#596d61]"><span data-testid="text-demo-case-age">{ageGroupLabels[sample.caseFile.ageGroup ?? ''] ?? 'Age not supplied'}</span> · Last seen <span data-testid="text-demo-last-seen">{formatLastSeen(photoAt)}</span></p>
        {sample.caseFile.careNotes && <p className="mt-1.5 text-xs leading-5 text-[#718078]" data-testid="text-demo-care-notes">Care notes: {sample.caseFile.careNotes}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge level={sample.urgency.level} />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#263d36] px-3 py-1.5 font-data text-[11px] text-[#f4f0e6]" data-testid="text-demo-missing-counter"><span className="demo-pulse h-1.5 w-1.5 rounded-full bg-[#e8875a]" aria-hidden="true" /><Clock3 size={12} aria-hidden="true" />Missing for {missing?.label ?? 'unknown'}</span>
      </div>
      <ul className="space-y-2">{risks.map((risk, i) => <li key={risk.label} className="rounded-lg border-l-2 border-[#d36b3a] bg-[#f1ece0] px-3 py-2" data-testid={`item-demo-header-risk-${i}`}><p className="text-xs font-semibold text-[#344b42]">{risk.label}</p><p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[#66796e]">{risk.reason}</p></li>)}
        {!risks.length && <li className="text-xs text-[#718078]">No rule-based risks in supplied inputs. This does not establish safety.</li>}</ul>
    </div>
    <div className="flex min-w-0 flex-col justify-between gap-3 rounded-xl bg-[#263d36] p-4 text-[#f4f0e6]">
      {top ? <div>
        <p className="font-data text-[9px] uppercase tracking-[.16em] text-[#e8a37c]">Most likely place</p>
        <p className="mt-2 flex items-start gap-1.5 font-editorial text-2xl leading-tight" data-testid="text-demo-top-place"><MapPin size={18} className="mt-1 shrink-0 text-[#e8a37c]" aria-hidden="true" />{top.place}</p>
        <p className="mt-1 text-[11px] text-[#c1cdbf]">{[top.region, top.country].filter(Boolean).join(', ')}</p>
        <p className="mt-4 font-editorial text-5xl leading-none" data-testid="text-demo-top-score">{scoreLabel(top.confidence)}<span className="ml-1 font-data text-xs text-[#c1cdbf]">/ 100 match</span></p>
      </div> : <p className="text-sm">No candidate places in this sample.</p>}
      <button type="button" onClick={onShare} data-testid="button-share-search-team" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#e8875a] px-4 text-xs font-semibold text-[#1f302a] hover:bg-[#f09a6f]">Share with search team</button>
    </div>
  </section>;
}

export function DecisionTrail({ sample }: { sample: DemoSample }) {
  const rows = sample.decisionTrail ?? [];
  return <details open className="group rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec]" data-testid="panel-demo-decision-trail">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5" data-testid="button-toggle-decision-trail">
      <div><p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">AI decision trail</p><h2 className="mt-1 font-editorial text-2xl">How this sample was reached</h2></div>
      <ChevronDown size={18} className="shrink-0 text-[#385e51] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
    </summary>
    <p className="-mt-2 px-5 text-[11px] leading-5 text-[#829087]">Precomputed fictional trail for this sample — illustrative only, not an actual verification run.</p>
    <ol className="mt-3 px-5 pb-5">{rows.map((row, i) => <li key={`${row.stage}-${i}`} className="grid grid-cols-[28px_1fr] gap-3 border-t border-[#e1dbce] py-3" data-testid={`row-demo-trail-${i}`}>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e9ede3] font-data text-[11px] text-[#385e51]">{i + 1}</span>
      <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#344b42]">{row.stage}{row.llm && <span className="rounded-full bg-[#6d4fc2] px-2 py-0.5 font-data text-[9px] font-semibold tracking-[.08em] text-white" data-testid={`chip-demo-trail-llm-${i}`}>LLM</span>}</p><p className="mt-0.5 text-xs leading-5 text-[#66796e]">{row.result}</p></div>
    </li>)}</ol>
  </details>;
}

export function NextStepsChecklist({ steps }: { steps: string[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const count = Object.values(done).filter(Boolean).length;
  return <section className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5" data-testid="panel-demo-checklist">
    <div className="flex items-end justify-between gap-3"><div><p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">Search plan</p><h2 className="mt-1 font-editorial text-2xl">Next steps checklist</h2></div><span className="font-data text-[10px] text-[#718078]" data-testid="text-demo-checklist-count">{count} / {steps.length} done</span></div>
    <ul className="mt-4 space-y-2">{steps.map((step, i) => <li key={step}><label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-5 transition-colors motion-reduce:transition-none ${done[i] ? 'border-[#bdc8bb] bg-[#e9ede3] text-[#829087] line-through' : 'border-[#e1dbce] text-[#344b42] hover:bg-[#f1ece0]'}`}>
      <input type="checkbox" checked={!!done[i]} onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[#385e51]" data-testid={`checkbox-demo-step-${i}`} />{step}
    </label></li>)}</ul>
  </section>;
}
