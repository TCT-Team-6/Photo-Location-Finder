import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DemoSample } from '@/lib/demo-samples';
import { searchArea } from '@/lib/demo-search';
import { coordinatesFromMapsUrl } from '@/components/lead-location-map';
import { CaseHeader, DecisionTrail, NextStepsChecklist, scoreLabel, useNow } from './demo-parts';
import { DemoSearchMap } from './demo-search-map';
import { DemoPrintSummary } from './demo-print-summary';

export function DemoResult({ sample }: { sample: DemoSample }) {
  const [selected, setSelected] = useState(0);
  const [share, setShare] = useState(false);
  const now = useNow(60_000);
  const inv = sample.investigation;
  const area = searchArea(sample, now);
  const points = useMemo(() => inv.candidates.flatMap((c, index) => {
    const position = coordinatesFromMapsUrl(c.mapsUrl);
    return position ? [{ position, index, label: c.place }] : [];
  }), [inv.candidates]);
  const center = useMemo(() => coordinatesFromMapsUrl(inv.candidates[0]?.mapsUrl ?? ''), [inv.candidates]);
  return <div className="space-y-5">
    <CaseHeader sample={sample} onShare={() => setShare(true)} />
    <section data-testid="section-demo-search-plan">
      <h2 className="mb-3 font-editorial text-2xl">Search plan</h2>
      <div className="grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
        <DemoSearchMap center={center} radiusKm={area.radiusKm} label={area.label} points={points} selectedIndex={selected} onSelect={setSelected} />
        <div className="space-y-2" data-testid="section-demo-candidates">
          <h3 className="font-editorial text-2xl">Likely places</h3>
          {inv.candidates.map((candidate, index) => {
            const coords = coordinatesFromMapsUrl(candidate.mapsUrl);
            return <article key={candidate.place} className={`rounded-xl border p-3 ${selected === index ? 'border-[#718c79] bg-[#e9ede3]' : 'border-[#d8d1c2] bg-[#f8f5ec]'}`} data-testid={`card-demo-candidate-${index}`}>
              <button type="button" onClick={() => setSelected(index)} aria-pressed={selected === index} data-testid={`button-select-demo-candidate-${index}`} className="flex w-full items-start justify-between gap-3 text-left">
                <span><span className="font-editorial text-xl" data-testid={`text-demo-candidate-place-${index}`}>{index + 1}. {candidate.place}</span><span className="mt-1 block text-[11px] text-[#718078]">{candidate.region}, {candidate.country}</span></span>
                <span className="shrink-0 font-data text-[10px] text-[#9c6d4e]" data-testid={`text-demo-candidate-score-${index}`}>Match score {scoreLabel(candidate.confidence)} / 100</span>
              </button>
              <p className="mt-2 text-xs leading-5 text-[#66796e]">{candidate.rationale}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#718078]"><span data-testid={`text-demo-candidate-coordinates-${index}`}>Coordinates {coords?.map((v) => v.toFixed(4)).join(', ') ?? 'unavailable'}</span><a href={candidate.mapsUrl} target="_blank" rel="noreferrer" data-testid={`link-demo-candidate-map-${index}`} className="font-semibold text-[#385e51] underline">Open map</a></div>
            </article>;
          })}
        </div>
      </div>
    </section>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <NextStepsChecklist steps={sample.urgency.nextSteps} />
      <DecisionTrail sample={sample} />
    </div>
    <section className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5" data-testid="panel-demo-family">
      <h2 className="font-editorial text-2xl">What the family told us</h2>
      <p className="mt-2 text-xs text-[#718078]">Scenario facts supplied by the family, not inferred from the photo.</p>
      <ul className="mt-3 flex flex-wrap gap-2">{sample.familyFacts.map((fact) => <li key={fact} className="rounded-full bg-[#e9ede3] px-3 py-2 text-xs text-[#385e51]">{fact}</li>)}</ul>
      {sample.reason && <p className="mt-3 text-xs">Reason: {sample.reason}</p>}
    </section>
    <details className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5">
      <summary className="cursor-pointer font-editorial text-xl">Scene details &amp; all risk factors</summary>
      <h2 className="mt-3 font-editorial text-xl" data-testid="text-demo-result-title">{inv.title}</h2>
      <p className="mt-2 text-sm leading-6" data-testid="text-demo-summary">{inv.summary}</p>
      <p className="mt-2 text-xs leading-5 text-[#718078]" data-testid="panel-demo-summary">{inv.context}</p>
      <ul className="mt-3 space-y-3">{inv.clues.map((clue, i) => <li key={clue.label} className="text-xs leading-5" data-testid={`item-demo-clue-${i}`}><strong>{clue.label}</strong> — {clue.observation}<p className="text-[#718078]">{clue.significance}</p></li>)}</ul>
      <ul className="mt-4 space-y-2">{sample.urgency.risks.map((risk) => <li key={risk.label} className="text-xs leading-5"><strong>{risk.label} (+{risk.points})</strong> — {risk.reason}</li>)}</ul>
      <p className="mt-4 text-[10px] text-[#718078]">{inv.originalName} · <a href={sample.sourceImageUrl} target="_blank" rel="noreferrer" data-testid="link-demo-photo-source" className="underline">{sample.sourceName} source</a> · <a href={sample.licenseUrl} target="_blank" rel="noreferrer" data-testid="link-demo-photo-license" className="underline">License</a></p>
    </details>
    <p className="border-t border-[#e1dbce] pt-3 text-xs font-semibold leading-5 text-[#604a37]" data-testid="text-urgency-disclaimer">{sample.urgency.disclaimer}</p>
    {share && createPortal(<DemoPrintSummary sample={sample} onClose={() => setShare(false)} />, document.body)}
  </div>;
}
