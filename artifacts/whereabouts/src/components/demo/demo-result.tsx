import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight } from 'lucide-react';
import type { DemoSample } from '@/lib/demo-samples';
import { searchArea } from '@/lib/demo-search';
import { coordinatesFromMapsUrl } from '@/lib/geographic-confidence';
import { confidencePercent, demoPipeline, supportingClues } from '@/lib/result-insights';
import { RankedPlacesMap } from '@/components/results/ranked-places-map';
import { RankedPlacesList } from '@/components/results/ranked-places-list';
import { PipelineBar } from '@/components/results/pipeline-bar';
import { AnnotatedPhoto, CaseCareRisks, CaseHeader, DecisionTrail, NextStepsChecklist, useNow } from './demo-parts';
import { DemoPrintSummary } from './demo-print-summary';
import '@/styles/ranked-results.css';

export function DemoResult({ sample }: { sample: DemoSample }) {
  const [selected, setSelected] = useState(0);
  const [focusToken, setFocusToken] = useState(0);
  const [scrollToken, setScrollToken] = useState(0);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const now = useNow(60_000);
  const inv = sample.investigation;
  const area = searchArea(sample, now);
  const tags = useMemo(() => sample.annotations.map((a) => a.label), [sample.annotations]);
  const entries = useMemo(() => inv.candidates.map((c, index) => ({ index, place: c.place, position: coordinatesFromMapsUrl(c.mapsUrl), percent: confidencePercent(c.confidence) })), [inv.candidates]);
  const items = useMemo(() => inv.candidates.map((c, index) => ({
    index, place: c.place, region: [c.region, c.country].filter(Boolean).join(', ') || 'Region not specified',
    percent: confidencePercent(c.confidence), clues: supportingClues(c, tags), mapped: Boolean(entries[index].position),
  })), [inv.candidates, tags, entries]);
  const circleCenter = entries[0]?.position ?? null;
  const circle = useMemo(() => circleCenter ? { center: circleCenter, radiusKm: area.radiusKm, label: area.label } : null, [circleCenter, area.radiusKm, area.label]);
  const pipeline = useMemo(() => demoPipeline(sample.decisionTrail ?? []), [sample.decisionTrail]);

  return <div className="space-y-4">
    <CaseHeader sample={sample} onShare={() => setShare(true)} />
    <PipelineBar summary={pipeline} targetId="ai-decision-trail" />
    <section className="rp-top" data-testid="section-demo-search-plan">
      <div className="rp-area-map">
        <RankedPlacesMap entries={entries} selectedIndex={selected} onSelect={(i) => { setSelected(i); setScrollToken((t) => t + 1); }} focusToken={focusToken}
          circle={circle} supportKm={Math.max(area.radiusKm * 1.4, 14)} focusZoom={11} title="Where the clues point" subtitle={`Dashed circle: walking distance ${area.label}. Not a tracked location.`} />
      </div>
      <div className="rp-area-list" data-testid="section-demo-candidates">
        <RankedPlacesList items={items} selectedIndex={selected} onSelect={(i) => { setSelected(i); setFocusToken((t) => t + 1); }} scrollToken={scrollToken} activeTag={activeTag} onClueFocus={setActiveTag} testId="list-demo-candidates"
          renderDetails={(i) => { const c = inv.candidates[i]; const pos = entries[i].position; return <div className="rp-item-details" data-testid={`panel-demo-candidate-details-${i}`}>
            <p>{c.rationale}</p>
            <p className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]"><span data-testid={`text-demo-candidate-coordinates-${i}`}>Coordinates {pos?.map((v) => v.toFixed(4)).join(', ') ?? 'unavailable'}</span><a href={c.mapsUrl} target="_blank" rel="noreferrer" data-testid={`link-demo-candidate-map-${i}`}>Open map <ArrowUpRight size={11} className="inline" /></a></p>
          </div>; }} />
      </div>
      <div className="rp-area-photo rp-photo" data-testid="panel-demo-photo">
        <AnnotatedPhoto sample={sample} compact activeTag={activeTag} />
      </div>
    </section>
    <CaseCareRisks sample={sample} />
    <div className="rp-below rp-below-2">
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
