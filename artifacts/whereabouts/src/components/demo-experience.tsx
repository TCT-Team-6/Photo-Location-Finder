import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Compass, ImagePlus } from 'lucide-react';
import { Link } from 'wouter';
import { demoSamples, getDemoSample, refreshDemoSample, type DemoSample, type DemoOverrides } from '@/lib/demo-samples';
import { trackEvent } from '@/lib/analytics';
import { DemoResult } from './demo/demo-result';
import { DemoStartFlow, DemoProgressOverlay } from './demo/demo-start-flow';
import { scoreLabel } from './demo/demo-parts';
import './demo/demo.css';

type DemoView = 'overview' | 'investigate' | 'library';

function SampleCard({ sample, onOpen }: { sample: DemoSample; onOpen: (sample: DemoSample) => void }) {
  const lead = sample.investigation.candidates[0];
  return <article className="overflow-hidden rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec]" data-testid={`card-demo-sample-${sample.investigation.id}`}>
    <button type="button" onClick={() => onOpen(sample)} data-testid={`button-open-demo-sample-${sample.investigation.id}`} className="block w-full text-left">
      <div className="relative h-44 overflow-hidden">
        <img src={sample.imageUrl} alt={sample.investigation.title} className="h-full w-full object-cover" loading="lazy" data-testid={`img-demo-sample-${sample.investigation.id}`} />
        <span className="absolute left-3 top-3 rounded-full bg-[#f8f5ec] px-3 py-1 font-data text-[9px] uppercase text-[#385e51]">Sample case</span>
      </div>
      <div className="p-4">
        <p className="font-data text-[9px] uppercase tracking-wider text-[#9c6d4e]">{sample.scenario}</p>
        <h2 className="mt-2 font-editorial text-2xl" data-testid={`text-demo-sample-title-${sample.investigation.id}`}>{sample.caseFile.nickname}</h2>
        <p className="mt-2 text-xs leading-5 text-[#718078]">{sample.caseFile.careNotes}</p>
        {lead && <p className="mt-3 border-t border-[#e1dbce] pt-3 text-xs text-[#385e51]">{lead.place} · Match score {scoreLabel(lead.confidence)}</p>}
      </div>
    </button>
    <button type="button" onClick={() => onOpen(sample)} data-testid={`button-view-result-${sample.investigation.id}`} className="mb-4 ml-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-[#bdc8bb] px-4 text-xs font-semibold text-[#385e51]">Open case file <ArrowRight size={14} /></button>
  </article>;
}

export function DemoExperience() {
  const [view, setView] = useState<DemoView>('overview');
  const [active, setActive] = useState<DemoSample | null>(() => {
    const sample = getDemoSample(new URLSearchParams(window.location.search).get('case'));
    return sample ? refreshDemoSample(sample) : null;
  });
  const [pending, setPending] = useState<{ sample: DemoSample; overrides: DemoOverrides } | null>(null);
  const navigation = [
    { id: 'overview' as const, label: 'Overview', icon: Compass },
    { id: 'investigate' as const, label: 'New investigation', icon: ImagePlus },
    { id: 'library' as const, label: 'My library', icon: BookOpen },
  ];
  const chooseView = (next: DemoView) => { setActive(null); setPending(null); setView(next); };
  const openSample = (sample: DemoSample) => {
    trackEvent('demo_sample_open', { scenario_id: sample.investigation.id });
    setActive(refreshDemoSample(sample));
    window.scrollTo(0, 0);
  };
  const startSimulation = (sample: DemoSample, overrides: DemoOverrides) => {
    trackEvent('demo_sample_run', { scenario_id: sample.investigation.id });
    setPending({ sample, overrides });
  };
  const finish = () => {
    if (!pending) return;
    setActive(refreshDemoSample(pending.sample, new Date(), pending.overrides));
    setPending(null);
    window.scrollTo(0, 0);
  };
  return <div className="demo-app min-h-[100dvh] bg-[#f4f0e6] text-[#263d36] md:flex">
    <aside className="hidden w-[200px] shrink-0 flex-col bg-[#263d36] p-5 text-[#f4f0e6] md:flex">
      <Link href="/" className="font-editorial text-[26px]" data-testid="link-demo-brand-home">whereabouts</Link>
      <nav className="mt-10 space-y-2" aria-label="Demo navigation">{navigation.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => chooseView(id)} aria-current={view === id ? 'page' : undefined} data-testid={`button-demo-nav-${id}`} className={`flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left text-xs ${view === id ? 'bg-[#3b5d50]' : 'text-[#c1cdbf] hover:bg-white/5'}`}><Icon size={16} />{label}</button>)}</nav>
      <p className="mt-auto pt-6 text-xs leading-5 text-[#c1cdbf]">Demo mode · nothing is saved</p>
    </aside>
    <main className="min-w-0 flex-1 px-4 py-4 md:px-7 md:py-5">
      <div className="mb-3 flex items-center justify-between gap-3"><p className="font-data text-[9px] uppercase tracking-wider text-[#829087]">Whereabouts / Demo</p><Link href="/" data-testid="link-demo-home" className="text-xs text-[#62756c]">Back to home</Link></div>
      <p className="mb-4 text-xs leading-5 text-[#718078]" data-testid="notice-demo-boundary">Sample cases with fictional scenarios. Real searches run the full AI pipeline.</p>
      <nav className="mb-4 flex gap-2 overflow-x-auto md:hidden" aria-label="Demo navigation">{navigation.map(({ id, label }) => <button type="button" key={id} onClick={() => chooseView(id)} data-testid={`button-demo-mobile-nav-${id}`} aria-current={view === id ? 'page' : undefined} className={`shrink-0 rounded-full px-3 py-2 text-xs ${view === id ? 'bg-[#385e51] text-white' : 'border border-[#d8d1c2]'}`}>{label}</button>)}</nav>
      {active ? <>
        <button type="button" onClick={() => setActive(null)} data-testid="button-back-from-demo-result" className="mb-3 inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-[#385e51]"><ArrowLeft size={14} />Back to demo</button>
        <DemoResult key={`${active.investigation.id}-${active.urgencyAssessedAt}`} sample={active} />
      </> : view === 'investigate' ? <>
        <h1 className="mb-5 font-editorial text-4xl">Start a search</h1>
        <DemoStartFlow samples={demoSamples} onRun={startSimulation} />
      </> : <>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><p className="font-data text-[9px] uppercase tracking-wider text-[#9c6d4e]">Four search briefings</p><h1 className="mt-2 font-editorial text-5xl tracking-[-.04em]">{view === 'library' ? 'My library.' : 'Sample cases'}</h1><p className="mt-3 text-sm text-[#718078]">Open a case file to explore its clues, likely places and search plan.</p></div>
          <button type="button" onClick={() => chooseView('investigate')} data-testid="button-overview-new-investigation" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#385e51] px-5 text-xs font-semibold text-white">New investigation <ArrowRight size={14} /></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{demoSamples.map((sample) => <SampleCard key={sample.investigation.id} sample={sample} onOpen={openSample} />)}</div>
        {view === 'overview' && <button type="button" onClick={() => chooseView('library')} data-testid="button-overview-open-library" className="mt-5 text-xs font-semibold text-[#385e51]">Browse library →</button>}
      </>}
      <Link href="/sign-in" data-testid="link-demo-sign-in-mobile" className="mt-6 inline-flex text-xs font-semibold text-[#385e51] underline md:hidden">Log in to save your progress</Link>
    </main>
    <Link href="/sign-in" data-testid="link-demo-sign-in" className="fixed bottom-4 right-4 z-30 hidden rounded-full border border-[#d8d1c2] bg-white px-4 py-3 text-xs font-semibold text-[#263d36] shadow-lg md:inline-flex">Log in to save your progress</Link>
    {pending && <DemoProgressOverlay sample={pending.sample} onDone={finish} />}
  </div>;
}
