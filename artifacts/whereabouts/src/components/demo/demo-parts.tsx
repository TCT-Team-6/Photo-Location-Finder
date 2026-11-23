import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Clock3, Eye, EyeOff, Share2 } from 'lucide-react';
import type { DemoSample } from '@/lib/demo-samples';
import { missingDuration } from '@/lib/demo-search';
import type { UrgencyLevel } from '@/lib/urgency';

export const ageGroupLabels: Record<string, string> = { child: 'Child', teen: 'Teen', adult: 'Adult', older_adult: 'Older adult' };

const solidBadge: Record<UrgencyLevel, string> = {
  Low: 'border border-[#86b99a] bg-[#e8f5e9] text-[#14532d]',
  Moderate: 'border border-[#d9bc44] bg-[#fef9c3] text-[#713f12]',
  High: 'border border-[#b6382e] bg-[#b6382e] text-white',
  Critical: 'border border-[#c62828] bg-[#c62828] text-white',
};

export function scoreLabel(score: number) {
  const normalized = score > 1 ? score / 100 : score;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

export function UrgencyBadge({ level, testId = 'status-demo-urgency-badge' }: { level: UrgencyLevel; testId?: string }) {
  return <span className={`urgency-pill inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-semibold ${solidBadge[level]}`} data-level={level} data-testid={testId}>{level} urgency</span>;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatLastSeen(iso?: string, fixedTime?: string) {
  if (fixedTime) return fixedTime;
  if (!iso) return 'Not supplied';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function AnnotatedPhoto({ sample, compact = false, activeTag = null }: { sample: DemoSample; compact?: boolean; activeTag?: string | null }) {
  const [show, setShow] = useState(true);
  const boxes = sample.annotations ?? [];
  return <div className="flex flex-col gap-2">
    <div className="relative mx-auto inline-block max-w-full overflow-hidden rounded-xl bg-[#1f302a]" data-testid="panel-demo-annotated-photo">
      <img src={sample.imageUrl} alt={`Fictional sample photograph: ${sample.investigation.title}`} className={`block h-auto w-auto max-w-full ${compact ? 'max-h-[300px]' : 'max-h-[560px]'}`} data-testid="img-demo-result-original" />
      {show && boxes.map((box, i) => <div key={`${box.label}-${i}`} className={`demo-box pointer-events-none absolute rounded-md border-2 border-[#f2c14e] shadow-[0_0_0_1px_rgba(31,48,42,.5)] transition-opacity ${activeTag ? (activeTag === box.label ? 'is-active' : 'is-dim') : ''}`} data-active={activeTag === box.label || undefined} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, animationDelay: `${i * 70}ms` }} data-testid={`box-demo-annotation-${i}`}>
        <span style={box.x > 60 ? { right: -2 } : { left: -2 }} className="absolute -top-px -translate-y-full whitespace-nowrap rounded-t-md bg-[#f2c14e] px-1.5 py-0.5 font-data text-[13px] font-semibold uppercase tracking-[.06em] text-[#1f302a]">{box.label}</span>
      </div>)}
    </div>
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} data-testid="button-toggle-ai-clues" className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[#bdc8bb] bg-[#f8f5ec] px-3 text-[13px] font-semibold text-[#385e51] hover:bg-[#e8e4d8]">
        {show ? <EyeOff size={13} /> : <Eye size={13} />}{show ? 'Hide AI clues' : 'Show AI clues'}
      </button>
      <span className="font-data text-[13px] uppercase tracking-[.1em] text-[#829087]">{boxes.length} marked clues</span>
    </div>
  </div>;
}

/** Slim first-screen identity bar; urgency details follow the results. */
export function CaseHeader({ sample, onShare }: { sample: DemoSample; onShare: () => void }) {
  const now = useNow();
  const photoAt = sample.urgencyInputs.scene.photoTakenAt;
  const missing = photoAt ? missingDuration(photoAt, now) : null;
  return <section className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] px-4 py-3 lg:px-5" data-testid="panel-demo-case-header">
    <div className="min-w-0">
      <p className="font-data text-[13px] uppercase tracking-[.16em] text-[#9c6d4e]">Sample case / {sample.scenario}</p>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-editorial text-[30px] leading-none tracking-[-.04em]" data-testid="text-demo-case-nickname">{sample.caseFile.nickname}</h1>
        <p className="text-[13px] text-[#596d61]"><span data-testid="text-demo-case-age">{ageGroupLabels[sample.caseFile.ageGroup ?? ''] ?? 'Age not supplied'}</span> · Last seen <span data-testid="text-demo-last-seen">{formatLastSeen(photoAt, sample.lastSeenTime)}</span></p>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#263d36] px-3 py-1.5 font-data text-[13px] text-[#f4f0e6]" data-testid="text-demo-missing-counter"><span className="demo-pulse h-1.5 w-1.5 rounded-full bg-[#e8875a]" aria-hidden="true" /><Clock3 size={12} aria-hidden="true" />Missing for {missing?.label ?? 'unknown'}</span>
      <button type="button" onClick={onShare} data-testid="button-share-search-team" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#e8875a] px-4 text-[13px] font-semibold text-[#1f302a] hover:bg-[#f09a6f]"><Share2 size={13} aria-hidden="true" />Share with search team</button>
    </div>
  </section>;
}

/** Below the map and list: care notes, risk cards and urgency detail. */
export function CaseCareRisks({ sample }: { sample: DemoSample }) {
  const risks = sample.urgency.risks;
  return <section className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5" data-testid="panel-demo-care-risks">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="font-data text-[13px] uppercase tracking-[.16em] text-[#9c6d4e]">Care &amp; urgency</p><h2 className="mt-1 font-editorial text-2xl">Why time matters here</h2></div>
      <div className="flex flex-wrap items-center gap-2"><UrgencyBadge level={sample.urgency.level} /><span className="font-data text-[13px] text-[#718078]" data-testid="text-demo-urgency-score">{sample.urgency.score} points</span></div>
    </div>
    {sample.caseFile.careNotes ? <p className="mt-3 rounded-xl border-l-[3px] border-[#385e51] bg-[#e9ede3] px-4 py-3 text-sm leading-6 text-[#344b42]" data-testid="text-demo-care-notes"><strong className="font-semibold">Care notes:</strong> {sample.caseFile.careNotes}</p>
      : <p className="mt-3 text-[13px] text-[#718078]" data-testid="text-demo-care-notes">Care notes: none supplied.</p>}
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">{risks.map((risk, i) => <li key={risk.label} className="rounded-xl border-l-[3px] border-[#d36b3a] bg-[#f1ece0] px-4 py-3" data-testid={`item-demo-header-risk-${i}`}>
      <p className="flex items-center justify-between gap-2 text-sm font-semibold text-[#344b42]"><span className="inline-flex items-center gap-1.5"><AlertTriangle size={13} className="shrink-0 text-[#b6382e]" aria-hidden="true" />{risk.label}</span><span className="font-data text-[13px] font-normal text-[#9c6d4e]">+{risk.points}</span></p>
      <p className="mt-1 text-[13px] leading-5 text-[#66796e]">{risk.reason}</p></li>)}
      {!risks.length && <li className="text-[13px] text-[#718078]">No rule-based risks in supplied inputs. This does not establish safety.</li>}</ul>
  </section>;
}

export function DecisionTrail({ sample }: { sample: DemoSample }) {
  const rows = sample.decisionTrail ?? [];
  return <details open id="ai-decision-trail" className="group scroll-mt-24 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec]" data-testid="panel-demo-decision-trail">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5" data-testid="button-toggle-decision-trail">
      <div><p className="font-data text-[13px] uppercase tracking-[.16em] text-[#9c6d4e]">AI decision trail</p><h2 className="mt-1 font-editorial text-2xl">How this sample was reached</h2></div>
      <ChevronDown size={18} className="shrink-0 text-[#385e51] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
    </summary>
    <ol className="mt-3 px-5 pb-5">{rows.map((row, i) => <li key={`${row.stage}-${i}`} className="grid grid-cols-[28px_1fr] gap-3 border-t border-[#e1dbce] py-3" data-testid={`row-demo-trail-${i}`}>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e9ede3] font-data text-[13px] text-[#385e51]">{i + 1}</span>
      <div className="min-w-0"><p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#344b42]">{row.stage}{row.llm && <span className="llm-chip rounded-full bg-[#6d4fc2] px-2 py-0.5 font-data text-[13px] font-semibold tracking-[.08em] text-white" data-testid={`chip-demo-trail-llm-${i}`}>LLM</span>}</p><p className="mt-0.5 text-[13px] leading-5 text-[#66796e]">{row.result}</p></div>
    </li>)}</ol>
  </details>;
}

export function NextStepsChecklist({ steps }: { steps: string[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const count = Object.values(done).filter(Boolean).length;
  return <section className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5" data-testid="panel-demo-checklist">
    <div className="flex items-end justify-between gap-3"><div><p className="font-data text-[13px] uppercase tracking-[.16em] text-[#9c6d4e]">Search plan</p><h2 className="mt-1 font-editorial text-2xl">Next steps checklist</h2></div><span className="font-data text-[13px] text-[#718078]" data-testid="text-demo-checklist-count">{count} / {steps.length} done</span></div>
    <ul className="mt-4 space-y-2">{steps.map((step, i) => <li key={step}><label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm leading-5 transition-colors motion-reduce:transition-none ${done[i] ? 'border-[#bdc8bb] bg-[#e9ede3] text-[#829087] line-through' : 'border-[#e1dbce] text-[#344b42] hover:bg-[#f1ece0]'}`}>
      <input type="checkbox" checked={!!done[i]} onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-[#385e51]" data-testid={`checkbox-demo-step-${i}`} />{step}
    </label></li>)}</ul>
  </section>;
}
