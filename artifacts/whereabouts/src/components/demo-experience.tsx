import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check, Compass, ImagePlus, LoaderCircle, ShieldAlert } from 'lucide-react';
import { Link } from 'wouter';
import { demoSamples, type DemoSample } from '@/lib/demo-samples';
import { trackEvent } from '@/lib/analytics';
import { coordinatesFromMapsUrl, LeadLocationMap } from '@/components/lead-location-map';

type DemoView = 'overview' | 'investigate' | 'library';

function scoreLabel(score: number) {
  const normalized = score > 1 ? score / 100 : score;
  return Math.round(Math.max(0, Math.min(1, normalized)) * 100);
}

function DemoBoundary({ compact = false }: { compact?: boolean }) {
  return <div className={`flex gap-3 rounded-xl border border-[#ddc6aa] bg-[#f7ecdd] text-[#604a37] ${compact ? 'p-3' : 'p-4'}`} role="note" data-testid="notice-demo-boundary">
    <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[#9d6441]" aria-hidden="true" />
    <p className="text-xs leading-5"><strong className="font-semibold">Fictional scenery-only demo.</strong> These samples do not represent current whereabouts and do not track or identify anyone. Model scores are illustrative comparisons, not probabilities.</p>
  </div>;
}

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" data-testid="link-demo-brand-home" className={`inline-flex items-center gap-3 ${inverse ? 'text-[#f5f0e5]' : 'text-[#263d36]'}`}>
    <span className={`grid h-10 w-10 place-items-center rounded-full font-editorial text-2xl ${inverse ? 'bg-[#d78b5a] text-[#243b34]' : 'bg-[#385e51] text-[#f5f0e6]'}`}>w</span>
    <span className="font-editorial text-[25px] leading-none tracking-[-.04em]">whereabouts</span>
  </Link>;
}

function SampleCard({ sample, onOpen, actionLabel = 'Open sample result' }: {
  sample: DemoSample;
  onOpen: (sample: DemoSample) => void;
  actionLabel?: string;
}) {
  const lead = sample.investigation.candidates[0];
  return <article className="group overflow-hidden rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] transition-transform duration-200 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none" data-testid={`card-demo-sample-${sample.investigation.id}`}>
    <button type="button" onClick={() => onOpen(sample)} data-testid={`button-open-demo-sample-${sample.investigation.id}`} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#385e51]">
      <div className="relative h-48 overflow-hidden bg-[#d9ddcf]">
        <img src={sample.imageUrl} alt={`Fictional scenery sample: ${sample.investigation.title}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transform-none motion-reduce:transition-none" data-testid={`img-demo-sample-${sample.investigation.id}`} />
        <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-[#f8f5ec]/95 px-3 py-1 font-data text-[9px] uppercase tracking-[.13em] text-[#385e51]">Illustrative sample</span>
        <span className="absolute bottom-3 left-3 rounded-full bg-[#263d36]/85 px-3 py-1 font-data text-[9px] uppercase tracking-[.12em] text-[#f4f0e6]">{sample.scenario}</span>
      </div>
      <div className="p-5">
        <p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">Saved scenery study</p>
        <h3 className="mt-2 font-editorial text-2xl tracking-[-.025em]" data-testid={`text-demo-sample-title-${sample.investigation.id}`}>{sample.investigation.title}</h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-[#718078]">{sample.investigation.summary}</p>
        {lead && <p className="mt-4 border-t border-[#e1dbce] pt-3 text-xs text-[#66796e]">Top comparison <span className="font-semibold text-[#263d36]">{lead.place}</span><span className="ml-2 font-data text-[10px]">score {scoreLabel(lead.confidence)} / 100</span></p>}
      </div>
    </button>
    <div className="px-5 pb-5">
      <button type="button" onClick={() => onOpen(sample)} data-testid={`button-view-result-${sample.investigation.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#bdc8bb] px-4 text-xs font-semibold text-[#385e51] transition hover:bg-[#e8e4d8] motion-reduce:transition-none">{actionLabel}<ArrowUpRight size={14} /></button>
    </div>
  </article>;
}

function ResultView({ sample, onBack }: { sample: DemoSample; onBack: () => void }) {
  const investigation = sample.investigation;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openedLead, setOpenedLead] = useState<number | null>(null);
  const topLead = investigation.candidates[selectedIndex] ?? investigation.candidates[0];

  return <div className="fade-up">
    <button type="button" onClick={onBack} data-testid="button-back-from-demo-result" className="mb-6 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#c9c2b3] px-4 text-xs font-semibold text-[#385e51] transition hover:bg-[#e8e4d8] motion-reduce:transition-none"><ArrowLeft size={15} />Back to demo</button>
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">{sample.scenario} / illustrative result</p><h1 className="mt-3 font-editorial text-4xl tracking-[-.05em] md:text-5xl" data-testid="text-demo-result-title">{investigation.title}</h1></div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#cbd3c5] bg-[#e8eee4] px-3 py-2 font-data text-[9px] uppercase tracking-[.1em] text-[#385e51]"><Check size={13} />Precomputed sample</span>
    </div>
    <DemoBoundary />
    <div className="mt-6 grid gap-6 lg:grid-cols-[.92fr_1.08fr]">
      <section className="overflow-hidden rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec]" data-testid="panel-demo-original-photo">
        <img src={sample.imageUrl} alt={`Original fictional scenery photograph: ${investigation.title}`} className="max-h-[520px] min-h-[250px] w-full object-cover" data-testid="img-demo-result-original" />
        <div className="p-4"><p className="font-data text-[9px] uppercase tracking-[.15em] text-[#9c6d4e]">Original sample photograph</p><p className="mt-1 text-xs text-[#718078]">{investigation.originalName}</p><p className="mt-2 text-[10px] text-[#829087]">Photo: <a href={sample.sourceImageUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[#385e51]" data-testid="link-demo-photo-source">{sample.sourceName} source</a> · <a href={sample.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[#385e51]" data-testid="link-demo-photo-license">{sample.sourceName} License</a></p></div>
      </section>
      <div className="space-y-5">
        <section className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5" data-testid="panel-demo-summary">
          <p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">Scene summary</p>
          <p className="mt-3 font-editorial text-2xl leading-snug text-[#263d36]" data-testid="text-demo-summary">{investigation.summary}</p>
          <p className="mt-4 border-t border-[#e1dbce] pt-3 text-xs leading-5 text-[#718078]">{investigation.context}</p>
        </section>
        <section className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5" data-testid="panel-demo-scene-clues">
          <div className="flex items-center justify-between gap-3"><div><p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">Scene clues</p><h2 className="mt-1 font-editorial text-2xl">What the sample shows</h2></div><span className="font-data text-[9px] text-[#829087]">{investigation.clues.length} observations</span></div>
          <div className="mt-4 space-y-4">{investigation.clues.map((clue, index) => <article key={clue.label} className="border-t border-[#e1dbce] pt-3" data-testid={`item-demo-clue-${index}`}>
            <h3 className="text-sm font-semibold text-[#344b42]">{clue.label}</h3><p className="mt-1 text-xs leading-5 text-[#718078]">{clue.observation}</p><p className="mt-2 text-xs leading-5 text-[#9c6d4e]">{clue.significance}</p>
          </article>)}</div>
        </section>
      </div>
    </div>
    <section className="mt-8" data-testid="section-demo-candidates">
      <div className="mb-4"><p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">Candidate places</p><h2 className="mt-1 font-editorial text-3xl">Scenery comparisons</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[#718078]">The supplied model scores are comparative sample values. They are not probabilities, certainty, or evidence that anyone was at a place.</p></div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="space-y-3">
          {investigation.candidates.map((candidate, index) => {
            const coords = coordinatesFromMapsUrl(candidate.mapsUrl);
            const active = selectedIndex === index;
            return <article key={`${candidate.place}-${candidate.country}`} className={`rounded-2xl border bg-[#f8f5ec] p-4 transition-colors motion-reduce:transition-none ${active ? 'border-[#718c79] ring-1 ring-[#718c79]/20' : 'border-[#d8d1c2]'}`} data-testid={`card-demo-candidate-${index}`}>
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => { setSelectedIndex(index); setOpenedLead(index); }} data-testid={`button-select-demo-candidate-${index}`} aria-pressed={active} className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-data text-xs ${active ? 'bg-[#385e51] text-white' : 'bg-[#e8e4d8] text-[#385e51]'}`}>{index + 1}</button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-editorial text-xl" data-testid={`text-demo-candidate-place-${index}`}>{candidate.place}</h3><span className="font-data text-[10px] text-[#9c6d4e]" data-testid={`text-demo-candidate-score-${index}`}>Model score {scoreLabel(candidate.confidence)} / 100</span></div>
                  <p className="mt-1 text-xs text-[#718078]">{[candidate.region, candidate.country].filter(Boolean).join(', ')}</p>
                  <p className="mt-3 text-xs leading-5 text-[#66796e]">{candidate.rationale}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{candidate.clues.map((clue) => <span key={clue} className="rounded-full bg-[#e9ede3] px-2.5 py-1 text-[10px] text-[#557363]">{clue}</span>)}</div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1dbce] pt-3">
                    <p className="font-data text-[9px] text-[#829087]" data-testid={`text-demo-candidate-coordinates-${index}`}>{coords ? `Sample coordinates ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}` : 'Coordinates unavailable'}</p>
                    <a href={candidate.mapsUrl} target="_blank" rel="noreferrer" data-testid={`link-demo-candidate-map-${index}`} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#bdc8bb] px-3 text-[10px] font-semibold text-[#385e51] hover:bg-[#e8e4d8]">Open map <ArrowUpRight size={12} /></a>
                  </div>
                </div>
              </div>
            </article>;
          })}
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <LeadLocationMap candidates={investigation.candidates} selectedIndex={selectedIndex} onSelect={setSelectedIndex} onOpenLead={setOpenedLead} popupActionLabel="Click marker to select this sample lead" />
          <p className="mt-2 text-[10px] leading-4 text-[#829087]" data-testid="text-demo-map-note">{openedLead === null ? `Map points use the sample coordinates for ${topLead?.place ?? 'the selected candidate'}.` : `Selected map lead ${openedLead + 1}: ${investigation.candidates[openedLead]?.place}.`}</p>
        </div>
      </div>
    </section>
  </div>;
}

export function DemoExperience() {
  const [view, setView] = useState<DemoView>('overview');
  const [activeSample, setActiveSample] = useState<DemoSample | null>(null);
  const [progressSample, setProgressSample] = useState<DemoSample | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState(demoSamples[0]?.investigation.id ?? '');

  useEffect(() => {
    if (!isSimulating || !progressSample) return;
    const timer = window.setTimeout(() => {
      setActiveSample(progressSample);
      setProgressSample(null);
      setIsSimulating(false);
    }, 1150);
    return () => window.clearTimeout(timer);
  }, [isSimulating, progressSample]);

  const navigation = [
    { id: 'overview' as const, label: 'Overview', icon: <Compass size={17} /> },
    { id: 'investigate' as const, label: 'New investigation', icon: <ImagePlus size={17} /> },
    { id: 'library' as const, label: 'My library', icon: <BookOpen size={17} /> },
  ];
  const openSample = (sample: DemoSample) => {
    trackEvent('demo_sample_open', { scenario_id: sample.investigation.id });
    setActiveSample(sample);
    setProgressSample(null);
    setIsSimulating(false);
  };
  const chooseView = (next: DemoView) => {
    setActiveSample(null);
    setIsSimulating(false);
    setProgressSample(null);
    setView(next);
  };
  const startSimulation = () => {
    const sample = demoSamples.find((item) => item.investigation.id === selectedSampleId);
    if (!sample) return;
    trackEvent('demo_sample_run', { scenario_id: sample.investigation.id });
    setProgressSample(sample);
    setIsSimulating(true);
  };

  return <div className="min-h-[100dvh] bg-[#f4f0e6] text-[#263d36] md:flex">
    <aside className="hidden w-[252px] shrink-0 flex-col bg-[#263d36] p-5 text-[#f4f0e6] md:flex">
      <BrandMark inverse />
      <nav className="mt-12 space-y-1" aria-label="Demo navigation">{navigation.map((item) => <button key={item.id} type="button" onClick={() => chooseView(item.id)} aria-current={view === item.id ? 'page' : undefined} data-testid={`button-demo-nav-${item.id}`} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors motion-reduce:transition-none ${view === item.id ? 'bg-[#3b5d50] text-white' : 'text-[#c1cdbf] hover:bg-white/5'}`}>{item.icon}{item.label}</button>)}</nav>
      <div className="mt-auto border-t border-[#52695d] pt-5"><p className="font-data text-[9px] uppercase tracking-[.14em] text-[#d78b5a]">Demo mode</p><p className="mt-2 text-xs leading-5 text-[#c1cdbf]">No uploads, account changes, or saved activity.</p></div>
    </aside>
    <main className="min-w-0 flex-1 px-5 py-6 md:px-10 md:py-8">
      <div className="mb-7 flex items-center justify-between gap-4"><p className="font-data text-[9px] uppercase tracking-[.16em] text-[#829087]">Personal field notes / Demo</p><Link href="/" data-testid="link-demo-home" className="text-xs text-[#62756c] hover:text-[#385e51]">Back to home</Link></div>
      <nav className="mb-6 flex gap-2 overflow-x-auto md:hidden" aria-label="Demo navigation">{navigation.map((item) => <button type="button" key={item.id} onClick={() => chooseView(item.id)} aria-current={view === item.id ? 'page' : undefined} data-testid={`button-demo-mobile-nav-${item.id}`} className={`shrink-0 rounded-full px-4 py-2.5 text-xs ${view === item.id ? 'bg-[#3b5d50] text-white' : 'border border-[#d8d1c2] bg-[#f8f5ec]'}`}>{item.label}</button>)}</nav>
      <div className="mb-6 flex justify-end md:hidden"><Link href="/sign-in" data-testid="link-demo-sign-in-mobile" className="text-xs font-semibold text-[#385e51] underline underline-offset-4">Log in to save your progress</Link></div>
      {activeSample ? <ResultView sample={activeSample} onBack={() => setActiveSample(null)} /> : <>
        {view === 'overview' && <div className="fade-up">
          <div className="mb-7 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
            <div><p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">Personal archive / overview</p><h1 className="mt-3 font-editorial text-5xl tracking-[-.05em] md:text-6xl">A field desk, in miniature.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#718078]">Explore three complete, precomputed scenery examples. Open a result directly, or pick one to walk through the short illustrative demo flow.</p></div>
            <div className="rounded-2xl bg-[#263d36] p-5 text-[#f4f0e6]"><p className="font-data text-[9px] uppercase tracking-[.16em] text-[#d78b5a]">Three sample records</p><p className="mt-2 font-editorial text-3xl">No live search</p><p className="mt-2 text-xs leading-5 text-[#c1cdbf]">Everything you see is precomputed and stays in this page session only.</p></div>
          </div>
          <div className="mb-6"><DemoBoundary /></div>
          <div className="mb-4 flex items-end justify-between border-b border-[#d8d1c2] pb-3"><div><p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">Sample archive</p><h2 className="mt-1 font-editorial text-3xl">Three scenery studies</h2></div><button type="button" onClick={() => chooseView('library')} data-testid="button-overview-open-library" className="hidden items-center gap-2 text-xs font-semibold text-[#385e51] sm:inline-flex">Browse library <ArrowRight size={14} /></button></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{demoSamples.map((sample) => <SampleCard key={sample.investigation.id} sample={sample} onOpen={openSample} />)}</div>
          <div className="mt-8 rounded-2xl border border-[#d8d1c2] bg-[#eee9dc] p-5 sm:flex sm:items-center sm:justify-between sm:gap-5"><div><p className="font-data text-[9px] uppercase tracking-[.15em] text-[#9c6d4e]">Try the interaction</p><p className="mt-2 font-editorial text-2xl">Choose a sample, then follow its stored result.</p><p className="mt-1 text-xs leading-5 text-[#718078]">The brief progress screen is explicitly simulated; it does not run analysis.</p></div><button type="button" onClick={() => chooseView('investigate')} data-testid="button-overview-new-investigation" className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#385e51] px-5 text-xs font-semibold text-[#f4f0e6] transition hover:bg-[#2e5044] sm:mt-0 motion-reduce:transition-none">New investigation <ArrowRight size={15} /></button></div>
        </div>}
        {view === 'library' && <div className="fade-up">
          <div className="mb-7"><p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">Personal archive / index</p><h1 className="mt-3 font-editorial text-5xl tracking-[-.05em] md:text-6xl">My library.</h1><p className="mt-3 text-sm text-[#718078]">Every result below is a fixed fictional sample, available to open without signing in.</p></div>
          <div className="mb-6"><DemoBoundary compact /></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{demoSamples.map((sample) => <SampleCard key={sample.investigation.id} sample={sample} onOpen={openSample} actionLabel="Open complete result" />)}</div>
        </div>}
        {view === 'investigate' && <div className="fade-up">
          <div className="mb-7"><p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">New investigation / demo</p><h1 className="mt-3 font-editorial text-5xl tracking-[-.05em] md:text-6xl">Choose a sample.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#718078]">A real photo analysis is not available here. Select one precomputed record to see its complete illustrative result.</p></div>
          <div className="mb-6"><DemoBoundary /></div>
          <section className="max-w-3xl rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5 sm:p-7" data-testid="panel-demo-sample-picker">
            <label htmlFor="demo-sample-choice" className="block font-editorial text-2xl">Select a scenery study</label>
            <p className="mt-1 text-xs leading-5 text-[#718078]">Choosing a sample only changes this in-memory demo view.</p>
            <select id="demo-sample-choice" value={selectedSampleId} onChange={(event) => setSelectedSampleId(event.target.value)} data-testid="select-demo-sample" className="mt-4 h-12 w-full rounded-xl border border-[#c9c2b3] bg-[#fbf9f3] px-4 text-sm text-[#263d36] focus:outline-none focus:ring-2 focus:ring-[#385e51]/25">
              {demoSamples.map((sample) => <option key={sample.investigation.id} value={sample.investigation.id}>{sample.scenario} — {sample.investigation.title}</option>)}
            </select>
            {selectedSampleId && <div className="mt-5 grid gap-4 sm:grid-cols-[180px_1fr]">
              <img src={demoSamples.find((sample) => sample.investigation.id === selectedSampleId)?.imageUrl} alt="Selected fictional scenery sample" className="h-36 w-full rounded-xl object-cover sm:h-32" data-testid="img-selected-demo-sample" />
              <div><p className="font-data text-[9px] uppercase tracking-[.15em] text-[#9c6d4e]">Stored sample</p><p className="mt-2 font-editorial text-2xl">{demoSamples.find((sample) => sample.investigation.id === selectedSampleId)?.investigation.title}</p><p className="mt-1 text-xs leading-5 text-[#718078]">{demoSamples.find((sample) => sample.investigation.id === selectedSampleId)?.investigation.summary}</p></div>
            </div>}
            <button type="button" onClick={startSimulation} disabled={isSimulating || !selectedSampleId} data-testid="button-run-demo-sample" className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#385e51] px-6 text-sm font-semibold text-[#f4f0e6] transition hover:bg-[#2e5044] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"><ImagePlus size={16} />Run illustrative demo <ArrowRight size={16} /></button>
          </section>
          {isSimulating && progressSample && <section className="mt-5 max-w-3xl rounded-2xl border border-[#bdc8bb] bg-[#e9ede3] p-5" role="status" aria-live="polite" data-testid="status-demo-simulated-progress">
            <div className="flex items-start gap-3"><LoaderCircle size={18} className="mt-1 shrink-0 animate-spin text-[#385e51] motion-reduce:animate-none" aria-hidden="true" /><div><p className="font-editorial text-xl">Simulated demo step</p><p className="mt-1 text-sm leading-6 text-[#596d61]">No live pipeline is running. This short pause is illustrative; opening the existing precomputed result for <strong>{progressSample.investigation.title}</strong>.</p></div></div>
          </section>}
          <div className="mt-8 grid gap-3 md:grid-cols-3">{demoSamples.map((sample) => <button key={sample.investigation.id} type="button" onClick={() => setSelectedSampleId(sample.investigation.id)} aria-pressed={selectedSampleId === sample.investigation.id} data-testid={`button-choose-sample-${sample.investigation.id}`} className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition-colors motion-reduce:transition-none ${selectedSampleId === sample.investigation.id ? 'border-[#718c79] bg-[#e8eee4]' : 'border-[#d8d1c2] bg-[#f8f5ec] hover:bg-[#eee9dc]'}`}><img src={sample.imageUrl} alt="" className="h-14 w-16 rounded-lg object-cover" /><span><span className="block font-data text-[9px] uppercase tracking-[.12em] text-[#9c6d4e]">{sample.scenario}</span><span className="mt-1 block font-editorial text-lg">{sample.investigation.title}</span></span></button>)}</div>
        </div>}
      </>}
    </main>
    <Link href="/sign-in" data-testid="link-demo-sign-in" className="fixed bottom-5 right-5 z-30 hidden rounded-full border border-[#d8d1c2] bg-white px-4 py-3 text-xs font-semibold text-[#263d36] shadow-lg md:inline-flex">← Log in to save your progress</Link>
  </div>;
}
