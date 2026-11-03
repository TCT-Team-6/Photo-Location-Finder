import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, LoaderCircle } from 'lucide-react';
import type { DemoSample } from '@/lib/demo-samples';
import { demoProgressStages } from '@/lib/demo-scenarios';
import type { PersonFactors } from '@/lib/urgency';
import { ageGroupLabels } from './demo-parts';

export type StartOverrides = { nickname: string; ageGroup: NonNullable<PersonFactors['ageGroup']>; careNotes: string; reason: string };
const reasons = ['Missing person', 'Lost hiker', 'Welfare check'] as const;
const ages = ['child', 'teen', 'adult', 'older_adult'] as const;
const stepNames = ["Who's missing", 'Last photo', 'Reason'];

export function DemoStartFlow({ samples, onRun }: { samples: DemoSample[]; onRun: (sample: DemoSample, overrides: StartOverrides) => void }) {
  const [step, setStep] = useState(0);
  const [sampleId, setSampleId] = useState(samples[0]?.investigation.id ?? '');
  const sample = samples.find((s) => s.investigation.id === sampleId);
  const [nickname, setNickname] = useState(sample?.caseFile.nickname ?? '');
  const [ageGroup, setAgeGroup] = useState<StartOverrides['ageGroup']>(sample?.caseFile.ageGroup ?? 'adult');
  const [careNotes, setCareNotes] = useState(sample?.caseFile.careNotes ?? '');
  const [reason, setReason] = useState<string>('Missing person');
  const [contacted, setContacted] = useState(false);
  const [error, setError] = useState('');

  const pick = (s: DemoSample) => { setSampleId(s.investigation.id); };
  const next = () => {
    if (step === 0 && !nickname.trim()) { setError('Add a nickname so the summary has a name.'); return; }
    setError(''); setStep((s) => Math.min(2, s + 1));
  };
  const submit = () => {
    if (!sample) return;
    if (!contacted) { setError('Please confirm you have contacted emergency services first.'); return; }
    setError('');
    onRun(sample, { nickname: nickname.trim(), ageGroup, careNotes: careNotes.trim(), reason });
  };
  const field = 'mt-2 w-full rounded-xl border border-[#c9c2b3] bg-[#fbf9f3] px-4 text-sm text-[#263d36] focus:outline-none focus:ring-2 focus:ring-[#385e51]/25';

  return <section className="max-w-3xl rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5 sm:p-7" data-testid="panel-demo-start-flow">
    <ol className="mb-6 grid grid-cols-3 gap-2">{stepNames.map((name, i) => <li key={name} className="flex flex-col gap-2" aria-current={i === step ? 'step' : undefined}>
      <span className={`h-1 rounded-full ${i <= step ? 'bg-[#385e51]' : 'bg-[#e1dbce]'}`} />
      <span className={`font-data text-[9px] uppercase tracking-[.12em] ${i === step ? 'text-[#385e51]' : 'text-[#9aa59d]'}`}>{i + 1} · {name}</span>
    </li>)}</ol>

    {step === 0 && <div className="fade-up space-y-5">
      <h2 className="font-editorial text-3xl tracking-[-.03em]">Who's missing?</h2>
      <label className="block text-xs font-semibold text-[#344b42]">Nickname<input value={nickname} onChange={(e) => setNickname(e.target.value)} className={`${field} h-12`} placeholder="What the family calls them" data-testid="input-demo-nickname" /></label>
      <fieldset><legend className="text-xs font-semibold text-[#344b42]">Age group</legend>
        <div className="mt-2 flex flex-wrap gap-2">{ages.map((a) => <button type="button" key={a} onClick={() => setAgeGroup(a)} aria-pressed={ageGroup === a} data-testid={`button-demo-age-${a}`} className={`min-h-10 rounded-full border px-4 text-xs font-semibold ${ageGroup === a ? 'border-[#385e51] bg-[#385e51] text-white' : 'border-[#c9c2b3] text-[#385e51] hover:bg-[#e8e4d8]'}`}>{ageGroupLabels[a]}</button>)}</div>
      </fieldset>
      <label className="block text-xs font-semibold text-[#344b42]">Care notes <span className="font-normal text-[#829087]">(shown on the summary only)</span><textarea value={careNotes} onChange={(e) => setCareNotes(e.target.value)} rows={3} className={`${field} py-3`} placeholder="Medication, phone battery, what they were wearing" data-testid="input-demo-care-notes" /></label>
    </div>}

    {step === 1 && <div className="fade-up">
      <h2 className="font-editorial text-3xl tracking-[-.03em]">Last photo</h2>
      <p className="mt-1 text-xs text-[#718078]">Pick a fictional sample photo. Nothing is uploaded.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{samples.map((s) => { const on = s.investigation.id === sampleId; return <button key={s.investigation.id} type="button" onClick={() => pick(s)} aria-pressed={on} data-testid={`button-choose-sample-${s.investigation.id}`} className={`relative flex items-center gap-3 rounded-xl border p-2.5 text-left ${on ? 'border-[#385e51] bg-[#e8eee4] ring-1 ring-[#385e51]/30' : 'border-[#d8d1c2] hover:bg-[#eee9dc]'}`}>
        <img src={s.imageUrl} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
        <span className="min-w-0"><span className="block font-data text-[9px] uppercase tracking-[.12em] text-[#9c6d4e]">{s.scenario}</span><span className="mt-0.5 block font-editorial text-lg leading-tight">{s.investigation.title}</span></span>
        {on && <Check size={15} className="absolute right-2.5 top-2.5 text-[#385e51]" aria-hidden="true" />}
      </button>; })}</div>
    </div>}

    {step === 2 && <div className="fade-up space-y-5">
      <h2 className="font-editorial text-3xl tracking-[-.03em]">Reason for the search</h2>
      <div className="flex flex-wrap gap-2" role="radiogroup">{reasons.map((r) => <button type="button" role="radio" aria-checked={reason === r} key={r} onClick={() => setReason(r)} data-testid={`button-demo-reason-${r.toLowerCase().replace(/\s+/g, '-')}`} className={`min-h-11 rounded-full border px-5 text-sm font-semibold ${reason === r ? 'border-[#385e51] bg-[#385e51] text-white' : 'border-[#c9c2b3] text-[#385e51] hover:bg-[#e8e4d8]'}`}>{r}</button>)}</div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#ddc6aa] bg-[#f7ecdd] p-4 text-sm leading-5 text-[#604a37]">
        <input type="checkbox" required checked={contacted} onChange={(e) => { setContacted(e.target.checked); setError(''); }} className="mt-0.5 h-4 w-4 shrink-0 accent-[#385e51]" data-testid="checkbox-demo-authorities" />
        <span><strong>I have contacted 911 or local police.</strong> Whereabouts supports a search; it never replaces one.</span>
      </label>
    </div>}

    {error && <p className="mt-4 text-xs font-semibold text-[#b23a1e]" role="alert" data-testid="text-demo-start-error">{error}</p>}
    <div className="mt-6 flex items-center justify-between gap-3">
      {step > 0 ? <button type="button" onClick={() => { setError(''); setStep((s) => s - 1); }} data-testid="button-demo-step-back" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#c9c2b3] px-4 text-xs font-semibold text-[#385e51] hover:bg-[#e8e4d8]"><ArrowLeft size={14} />Back</button> : <span />}
      {step < 2
        ? <button type="button" onClick={next} data-testid="button-demo-step-next" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#385e51] px-5 text-xs font-semibold text-[#f4f0e6] hover:bg-[#2e5044]">Continue <ArrowRight size={14} /></button>
        : <button type="button" onClick={submit} disabled={!contacted || !sample} data-testid="button-run-demo-sample" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#385e51] px-6 text-sm font-semibold text-[#f4f0e6] hover:bg-[#2e5044] disabled:cursor-not-allowed disabled:opacity-50"><ImagePlus size={16} />Analyze photo <ArrowRight size={16} /></button>}
    </div>
  </section>;
}

export function DemoProgressOverlay({ sample, onDone }: { sample: DemoSample; onDone: () => void }) {
  const [stage, setStage] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const iv = window.setInterval(() => setStage((s) => Math.min(s + 1, demoProgressStages.length - 1)), 1000);
    const t = window.setTimeout(() => doneRef.current(), 5000);
    return () => { window.clearInterval(iv); window.clearTimeout(t); };
  }, []);
  return <div className="demo-overlay fixed inset-0 z-50 grid place-items-center bg-[#1f302a]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Analyzing sample photo">
    <section className="demo-overlay-card w-full max-w-md overflow-hidden rounded-2xl bg-[#f8f5ec] shadow-2xl" role="status" aria-live="polite" data-testid="status-demo-simulated-progress">
      <div className="relative h-32 overflow-hidden"><img src={sample.imageUrl} alt="" className="h-full w-full object-cover opacity-80" /><div className="absolute inset-0 bg-gradient-to-t from-[#f8f5ec] to-transparent" /></div>
      <div className="px-6 pb-6">
        <p className="font-data text-[9px] uppercase tracking-[.16em] text-[#9c6d4e]">Sample walkthrough · no upload</p>
        <div className="mt-2 flex items-center gap-3"><LoaderCircle size={18} className="shrink-0 animate-spin text-[#385e51] motion-reduce:animate-none" aria-hidden="true" /><p className="font-editorial text-xl" data-testid="text-demo-progress-stage">{demoProgressStages[stage]}</p></div>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e1dbce]"><div className="demo-progress-bar h-full bg-[#385e51]" /></div>
        <ol className="mt-4 space-y-1">{demoProgressStages.map((s, i) => <li key={s} aria-current={i === stage ? 'step' : undefined} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs ${i === stage ? 'font-semibold text-[#263d36]' : i < stage ? 'text-[#718078]' : 'text-[#aab3ac]'}`}>
          <span className={`grid h-5 w-5 place-items-center rounded-full font-data text-[10px] ${i < stage ? 'bg-[#385e51] text-white' : i === stage ? 'border border-[#385e51] text-[#385e51]' : 'border border-[#d8d1c2]'}`}>{i < stage ? <Check size={11} /> : i + 1}</span>{s}
        </li>)}</ol>
      </div>
    </section>
  </div>;
}
