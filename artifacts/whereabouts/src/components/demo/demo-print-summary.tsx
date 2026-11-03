import { Printer, X } from 'lucide-react';
import type { DemoSample } from '@/lib/demo-samples';
import { missingDuration, searchArea } from '@/lib/demo-search';
import { ageGroupLabels, formatLastSeen, scoreLabel } from './demo-parts';

export function DemoPrintSummary({ sample, onClose }: { sample: DemoSample; onClose: () => void }) {
  const now = new Date();
  const photoAt = sample.urgencyInputs.scene.photoTakenAt;
  const missing = photoAt ? missingDuration(photoAt, now) : null;
  const area = searchArea(sample, now);
  const inv = sample.investigation;
  return <div className="demo-overlay demo-print-backdrop fixed inset-0 z-50 overflow-y-auto bg-[#1f302a]/70 p-4" role="dialog" aria-modal="true" aria-label="Search team summary">
    <div className="demo-print-hide mx-auto mb-3 flex max-w-[800px] justify-end gap-2">
      <button type="button" onClick={() => window.print()} data-testid="button-print-summary" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#e8875a] px-4 text-xs font-semibold text-[#1f302a]"><Printer size={14} />Print or save PDF</button>
      <button type="button" onClick={onClose} data-testid="button-close-summary" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#f8f5ec] px-4 text-xs font-semibold text-[#263d36]"><X size={14} />Close</button>
    </div>
    <article className="demo-print-sheet demo-overlay-card mx-auto max-w-[800px] rounded-xl bg-[#fdfcf8] p-8 text-[#1f302a] shadow-2xl" data-testid="panel-demo-print-summary">
      <header className="flex items-start justify-between gap-4 border-b-2 border-[#1f302a] pb-3">
        <div><p className="font-data text-[9px] uppercase tracking-[.16em]">Whereabouts · search team briefing · fictional sample</p><h1 className="mt-1 font-editorial text-4xl tracking-[-.04em]">{sample.caseFile.nickname}</h1></div>
        <div className="text-right"><p className="text-sm font-bold">{sample.urgency.level} urgency</p><p className="font-data text-[10px]">Missing for {missing?.label ?? 'unknown'}</p></div>
      </header>
      <div className="mt-4 grid grid-cols-[200px_1fr] gap-5">
        <img src={sample.imageUrl} alt="Last photo" className="w-full rounded-md object-contain" />
        <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-2 text-xs">
          <div><dt className="font-semibold">Age group</dt><dd>{ageGroupLabels[sample.caseFile.ageGroup ?? ''] ?? 'Not supplied'}</dd></div>
          <div><dt className="font-semibold">Last seen (photo)</dt><dd>{formatLastSeen(photoAt)}</dd></div>
          <div className="col-span-2"><dt className="font-semibold">Care notes</dt><dd>{sample.caseFile.careNotes || 'None supplied'}</dd></div>
          <div className="col-span-2"><dt className="font-semibold">Possible search area</dt><dd>{area.radiusKm.toFixed(1)} km radius around {inv.candidates[0]?.place ?? 'top place'} ({area.speedKmh} km/h for {area.hours.toFixed(1)}h)</dd></div>
          <div className="col-span-2"><dt className="font-semibold">Top risks</dt><dd>{sample.urgency.risks.slice(0, 3).map((r) => r.label).join('; ') || 'None in supplied inputs'}</dd></div>
        </dl>
      </div>
      <section className="mt-5"><h2 className="font-editorial text-xl">Ranked places</h2>
        <ol className="mt-2 space-y-1 text-xs">{inv.candidates.map((c, i) => <li key={c.place}><strong>{i + 1}. {c.place}</strong>, {[c.region, c.country].filter(Boolean).join(', ')} — match {scoreLabel(c.confidence)}/100</li>)}</ol>
      </section>
      <section className="mt-4"><h2 className="font-editorial text-xl">Next steps</h2>
        <ul className="mt-2 space-y-1 text-xs">{sample.urgency.nextSteps.map((s) => <li key={s} className="flex gap-2"><span className="mt-0.5 inline-block h-3 w-3 shrink-0 border border-[#1f302a]" />{s}</li>)}</ul>
      </section>
      <footer className="mt-5 border-t border-[#1f302a]/30 pt-2 text-[10px] leading-4">Fictional sample case. Search area is an estimate from time and walking pace, not a tracked location. Always work with emergency services.</footer>
    </article>
  </div>;
}
