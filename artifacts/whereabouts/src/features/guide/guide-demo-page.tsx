import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DeskHeadline, DeskRuler, FieldSheet } from '@/components/field-desk';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Check, ChevronDown, CircleCheck, FileImage, MapPin, Printer, Share2 } from 'lucide-react';
import { demoFactsWithAnswers, demoGroundedActions, demoResults, demoUrgency, getGuideDemo, GUIDE_DEMO_NOW, type GuideDemo } from '@/lib/guide-demos';
import { buildResponderSummary, optionalQuestions, type ChatMessage } from '@/lib/guide-state';
import { groundAction, nextUncheckedPlace, orderPlaces, pct, type GroundedAction } from '@/lib/guide-grounding';
import { demoProgressStages, demoProgressStageDurationMs } from '@/lib/demo-scenarios';
import { getDemoSample, refreshDemoSample } from '@/lib/demo-samples';
import { DemoResult } from '@/components/demo/demo-result';
import NotFound from '@/pages/not-found';
import { GuideChat, ReplyChips } from './guide-chat';
import { ResponderSummary } from './responder-summary';
import type { GuideFacts } from '@workspace/api-client-react';
import { Disclaimer, EmergencyBar, SampleLabel, SimulatedCallButton, guideGhost, guidePrimary } from './guide-ui';
import '@/components/demo/demo.css';

export default function GuideDemoPage() {
  const { sample } = useParams<{ sample: string }>();
  const demo = getGuideDemo(sample);
  if (!demo) return <NotFound />;
  return <GuideDemo key={demo.slug} demo={demo} />;
}

type Phase = 'chat' | 'running' | 'results';

function GuideDemo({ demo }: { demo: GuideDemo }) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('chat');
  const [stage, setStage] = useState(0);
  const [optional, setOptional] = useState<Record<string, string>>({});
  const [accepted, setAccepted] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const step = demo.steps[answers.length];
  const facts = useMemo(() => demoFactsWithAnswers(demo, answers), [demo, answers]);

  const messages = useMemo(() => {
    const m: ChatMessage[] = [{ id: 'u0', role: 'user', text: demo.opening }];
    demo.steps.forEach((s, i) => {
      if (i > answers.length) return;
      m.push({ id: `a${i}`, role: 'assistant', text: s.ai });
      if (answers[i] !== undefined) m.push({ id: `u${i + 1}`, role: 'user', text: answers[i] });
    });
    if (answers.length >= demo.steps.length) m.push({ id: 'close', role: 'assistant', text: phase === 'chat' ? 'Thank you. I have the required facts. Tap below to open the saved sample results.' : demo.closing });
    accepted.forEach((a, i) => m.push({ id: `n${i}`, role: 'note', text: a }));
    return m;
  }, [demo, answers, phase, accepted]);

  useEffect(() => {
    if (phase !== 'running') return;
    const iv = window.setInterval(() => setStage((s) => {
      if (s >= demoProgressStages.length - 1) { window.clearInterval(iv); setPhase('results'); return s; }
      return s + 1;
    }), demoProgressStageDurationMs);
    return () => window.clearInterval(iv);
  }, [phase]);

  function answer(v: string) { if (step) { setAnswers((p) => [...p, v]); setTyped(''); } }
  function acceptOptional(id: string, prefix: string) {
    const v = optional[id]?.trim(); if (!v) return;
    setAccepted((p) => [...p.filter((x) => !x.startsWith(`${prefix}:`)), `${prefix}: ${v}`]);
  }

  return <div className="demo-app min-h-[100dvh] bg-[#f4f0e6] text-[#263d36]">
    <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 pt-4">
      <Link href="/demo" className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#62756c]" data-testid="link-guide-demo-back"><ArrowLeft size={14} />All samples</Link>
      <SampleLabel />
    </header>
    <DeskRuler/>
    <main className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-4">
      <FieldSheet code="05 / GUIDE SAMPLE" className="fd-flow">
      <div><p className="font-data text-[10px] uppercase tracking-[.18em] text-[#9c6d4e]">AI Guide walkthrough · saved replies, nothing is sent</p><DeskHeadline className="mt-2 text-4xl sm:text-5xl">{demo.name}</DeskHeadline></div>
      <EmergencyBar urgent={facts.called911 !== true} sample />
      <figure className="overflow-hidden rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec]">
        <img src={demo.imageUrl} alt={demo.imageCaption} className="h-44 w-full object-cover sm:h-56" data-testid="img-guide-demo" />
        <figcaption className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-[#718078]"><span>{demo.imageCaption} · reference only</span><span className="font-data text-[9px] uppercase tracking-[.12em] text-[#874d34]">Sample case, fictional data</span></figcaption>
      </figure>
      <section className="rounded-2xl border border-[#d8d1c2] bg-[#f4f0e6] p-3 sm:p-4" aria-label="Sample guide conversation">
        <GuideChat messages={messages} />
        {phase === 'chat' && step && <div className="mt-4 space-y-2">
          <ReplyChips options={step.answers} onPick={answer} />
          <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) answer(typed.trim()); }} className="flex gap-2"><label htmlFor="demo-reply" className="sr-only">Type a reply</label><input id="demo-reply" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type a reply (sample uses saved responses)" className="min-h-11 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 text-sm" data-testid="input-guide-demo-reply" /><button type="submit" className={guideGhost} data-testid="button-guide-demo-send">Send</button></form>
          <p className="font-data text-[10px] uppercase tracking-[.14em] text-[#718078]">Question {answers.length + 1} of {demo.steps.length}</p>
        </div>}
        {phase === 'chat' && !step && <button type="button" onClick={() => { setStage(0); setPhase('running'); }} className={`${guidePrimary} mt-4 w-full sm:w-auto`} data-testid="button-guide-demo-run">Open saved sample results</button>}
      </section>

      {phase === 'running' && <section className="grid gap-4 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4 sm:grid-cols-2" aria-label="Sample walkthrough progress">
        <div role="status" aria-live="polite" data-testid="status-guide-demo-progress">
          <SampleLabel className="mb-2" />
          <p className="text-xs text-[#718078]">Replaying the saved sample pipeline. No photo is uploaded or analyzed.</p>
          <ol className="mt-3 space-y-1">{demoProgressStages.map((s, i) => <li key={s} aria-current={i === stage ? 'step' : undefined} className={`flex items-center gap-2 text-xs ${i === stage ? 'font-semibold text-[#263d36]' : i < stage ? 'text-[#718078]' : 'text-[#aab3ac]'}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < stage ? 'bg-[#385e51] text-white' : 'border border-[#d8d1c2]'}`}>{i < stage ? <Check size={11} /> : i + 1}</span>{s}</li>)}</ol>
        </div>
        <div className="space-y-3"><p className="text-sm font-semibold">While you wait (optional)</p>
          {optionalQuestions.map((oq) => <div key={oq.id}><label htmlFor={`demo-opt-${oq.id}`} className="mb-1 block text-xs font-semibold text-[#344b42]">{oq.prompt}</label><div className="flex gap-2"><input id={`demo-opt-${oq.id}`} value={optional[oq.id] ?? ''} onChange={(e) => setOptional((p) => ({ ...p, [oq.id]: e.target.value }))} className="min-h-11 w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-3 text-sm" data-testid={`input-demo-optional-${oq.id}`} /><button type="button" onClick={() => acceptOptional(oq.id, oq.prefix)} className={guideGhost} data-testid={`button-demo-optional-${oq.id}`}>Add</button></div></div>)}
        </div>
      </section>}

      {phase === 'results' && <DemoResults demo={demo} facts={facts} notes={accepted} />}
      <Disclaimer />
      </FieldSheet>
    </main>
  </div>;
}

function DemoResults({ demo, facts, notes }: { demo: GuideDemo; facts: GuideFacts; notes: string[] }) {
  const results = useMemo(() => demoResults(demo), [demo]);
  const actions = useMemo(() => demoGroundedActions(demo), [demo]);
  const urgency = useMemo(() => demoUrgency(demo), [demo]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [mapOpened, setMapOpened] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showFlyer, setShowFlyer] = useState(false);
  const fallback = useMemo(() => { const s = getDemoSample(demo.sampleId); return s ? refreshDemoSample(s, GUIDE_DEMO_NOW) : null; }, [demo]);
  const summary = buildResponderSummary({ name: demo.name, facts, notes, sample: true, extra: [`Urgency (scored estimate): ${urgency.level}`, ...results.places.map((p) => `Saved sample place: ${p.name}, match score ${pct(p.confidence)}${checked.has(p.sourceId) ? ' (checked)' : ''}`)] });

  if (actions.length === 0) return fallback ? <section><SampleLabel className="mb-3" /><p className="mb-3 text-sm text-[#718078]">No grounded guide actions. Showing the regular sample results.</p><DemoResult sample={fallback} /></section> : null;

  const top = nextUncheckedPlace(results.places, checked);
  return <section className="space-y-4" aria-labelledby="demo-actions-h">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="demo-actions-h" className="font-editorial text-3xl tracking-[-.03em]">Next steps</h2><SampleLabel /></div>
    <p className="text-xs text-[#718078]">Each card is built only from saved results. Places are search suggestions, never a confirmed location.</p>
    <ul className="grid gap-3">
      {actions.map((a) => {
        if (a.kind === 'map' || a.kind === 'checked') {
          if (!top) return <li key={a.sourceId} className="rounded-2xl border border-[#bdcbbd] bg-[#e9ede3] p-4 text-sm" data-testid="card-demo-all-checked"><CircleCheck size={16} className="mr-2 inline" />All saved sample places are marked checked.</li>;
          const place = groundAction({ kind: 'map', sourceId: top.sourceId, sourceName: top.name, confidence: top.confidence }, results);
          if (!place) return null;
          const opened = mapOpened === top.sourceId;
          return <ActionCard key="map" a={{ ...place, kind: opened ? 'checked' : 'map' }} badge={`Match score ${pct(top.confidence)}`}>
            {opened ? <button type="button" onClick={() => { setChecked((p) => new Set(p).add(top.sourceId)); setMapOpened(null); }} className={guidePrimary} data-testid="button-demo-mark-checked"><Check size={15} />Mark {top.name} checked</button>
              : <a href={place.mapUrl} target="_blank" rel="noopener noreferrer" onClick={() => setMapOpened(top.sourceId)} className={guidePrimary} data-testid="link-demo-open-map"><MapPin size={15} />Open map</a>}
          </ActionCard>;
        }
        if (a.kind === 'call') return <ActionCard key="call" a={a} badge={`Risk from rules · urgency ${urgency.level}`}><SimulatedCallButton /></ActionCard>;
        return <ActionCard key={a.kind} a={a} badge={a.confidence !== null ? `${a.sourceName} · match score ${pct(a.confidence)}` : undefined}><button type="button" onClick={() => setShowSummary(true)} className={guidePrimary} data-testid="button-demo-share"><Share2 size={15} />Preview and share</button></ActionCard>;
      })}
    </ul>
    <div className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4"><p className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">Saved sample places</p>
      <ol className="mt-2 space-y-1">{orderPlaces(results.places, checked).map((p) => <li key={p.sourceId} className="flex min-h-11 items-center justify-between gap-2 border-b border-[#e1dbce] text-sm last:border-0" data-testid={`row-demo-place-${p.sourceId}`}><span className={checked.has(p.sourceId) ? 'text-[#89948a] line-through' : ''}>{p.name}</span><span className="font-data text-[10px] text-[#718078]">{checked.has(p.sourceId) ? 'Checked' : pct(p.confidence)}</span></li>)}</ol>
    </div>
    <div className="flex flex-wrap gap-2">
      {!showSummary && <button type="button" onClick={() => setShowSummary(true)} className={guideGhost} data-testid="button-demo-print"><Printer size={15} />Prepare responder summary to print</button>}
      <button type="button" onClick={() => setShowFlyer(true)} className={guideGhost} data-testid="button-demo-flyer"><FileImage size={15} />Print a flyer</button>
    </div>
    {showFlyer && <DemoFlyer demo={demo} facts={facts} onClose={() => setShowFlyer(false)} />}
    {showSummary && <ResponderSummary text={summary} filename={`sample-${demo.slug}-responder-summary.txt`} sample />}
  </section>;
}

function ActionCard({ a, badge, children }: { a: GroundedAction; badge?: string; children: ReactNode }) {
  const [why, setWhy] = useState(false);
  return <li className={`rounded-2xl border p-4 ${a.kind === 'call' ? 'border-[#d9a596] bg-[#fbefeb]' : a.kind === 'checked' ? 'border-[#bdcbbd] bg-[#e9ede3]' : 'border-[#d8d1c2] bg-[#fbf9f3]'}`} data-testid={`card-demo-action-${a.kind}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-editorial text-2xl">{a.kind === 'checked' ? 'Map opened. Mark it checked when done.' : a.title}</h3>{badge && <span className="font-data text-[10px] uppercase tracking-[.12em] text-[#9c6d4e]">{badge}</span>}</div>
    <p className="mt-1 text-sm leading-6 text-[#465c50]">{a.reason}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2">{children}
      <button type="button" aria-expanded={why} onClick={() => setWhy((v) => !v)} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-[#385e51]" data-testid={`button-why-${a.kind}`}>Why this <ChevronDown size={14} className={why ? 'rotate-180' : ''} /></button></div>
    {why && <ul className="mt-2 space-y-1 rounded-xl bg-[#f4f0e6] p-3 text-xs leading-5 text-[#465c50]" data-testid={`list-why-${a.kind}`}>{a.evidence.map((e) => <li key={e}>{e}</li>)}</ul>}
  </li>;
}

function DemoFlyer({ demo, facts, onClose }: { demo: GuideDemo; facts: GuideFacts; onClose: () => void }) {
  function print() {
    document.body.classList.add('guide-printing');
    const done = () => { document.body.classList.remove('guide-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    window.setTimeout(done, 1500);
  }
  return <section className="rounded-2xl border border-[#d8d1c2] bg-[#fbf9f3] p-4" aria-labelledby="flyer-h" data-testid="panel-demo-flyer">
    <div className="guide-print mx-auto max-w-md rounded-xl border-2 border-[#263d36] bg-[#fdfcf8] p-5 text-center text-[#1f302a]">
      <p className="font-data text-[11px] font-semibold uppercase tracking-[.14em] text-[#874d34]" data-testid="label-sample-case-flyer">Sample case, fictional data</p>
      <h3 id="flyer-h" className="mt-2 font-editorial text-5xl tracking-[-.04em]">Missing</h3>
      <p className="mt-1 font-editorial text-3xl">{demo.name}</p>
      <img src={demo.imageUrl} alt={`${demo.imageCaption} (scene, not a portrait)`} className="mx-auto mt-3 h-40 w-full rounded-lg object-cover" />
      <p className="mt-1 text-[11px] text-[#62756c]">Last scene photo, not a portrait</p>
      <dl className="mt-3 space-y-1 text-left text-sm">
        <div><dt className="inline font-semibold">Last seen: </dt><dd className="inline">{facts.lastSeenTime ?? 'Unknown'}</dd></div>
        <div><dt className="inline font-semibold">Area: </dt><dd className="inline">{facts.lastSeenPlace ?? 'Unknown'}</dd></div>
        <div><dt className="inline font-semibold">Clothing: </dt><dd className="inline">{facts.clothing ?? 'Unknown'}</dd></div>
      </dl>
      <p className="mt-3 text-xs">Details are family-reported and unverified. If you see this person, call 911.</p>
    </div>
    <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={print} className={guidePrimary} data-testid="button-demo-flyer-print"><Printer size={15} />Print flyer</button><button type="button" onClick={onClose} className={guideGhost} data-testid="button-demo-flyer-close">Close</button></div>
  </section>;
}
