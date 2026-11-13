import { useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ChevronDown, ClipboardList, Loader2, Phone, Printer, Send, Share2, ShieldX } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMissingPersonCaseQueryKey, getListMissingPersonCasesQueryKey, useCreateCaseLead, useCreateMissingPersonCase,
  useGetMissingPersonCase, useGuideIntake, useGuideNote, useGuidePlan,
} from '@workspace/api-client-react';
import type { GuidePlan, GuideState, MissingPersonCase, MissingPersonCaseInput } from '@workspace/api-client-react';
import { buildResponderSummary, canPlan, chatFromGuide, factRows, hasOpenQuestion, isYesNoQuestion, MAX_REQUIRED_QUESTIONS, needsCallNow, optionalQuestions, questionNumber, REGULAR_FORM_LINK } from '@/lib/guide-state';
import { ErrorBanner, PrivacyNotice, Skeleton, errorMessage, inputCls, newId, useCasePhotoUpload, useObjectUrl, validatePhoto } from '@/features/cases/shared';
import { displayName } from '@/features/cases/cases-page';
import { GuideChat, ReplyChips } from './guide-chat';
import { ResponderSummary } from './responder-summary';
import { Disclaimer, EmergencyBar, guideGhost, guidePrimary, useGuideDraft } from './guide-ui';

const roles: { v: MissingPersonCaseInput['responderRole']; l: string }[] = [
  { v: 'family-or-guardian', l: 'Family or guardian' }, { v: 'authorized-responder', l: 'Authorized responder' }, { v: 'other', l: 'Other' },
];

function useSyncGuide(caseId: string) {
  const qc = useQueryClient();
  return (g: GuideState) => {
    qc.setQueryData<MissingPersonCase>(getGetMissingPersonCaseQueryKey(caseId), (old) => (old ? { ...old, guide: g } : old));
    qc.invalidateQueries({ queryKey: getGetMissingPersonCaseQueryKey(caseId) });
    qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
  };
}

/** /guide: consent + first details, then create the case and send intake. */
export function GuideStartPage() {
  const { draft, clear, setNotice } = useGuideDraft();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const [text, setText] = useState(draft.text);
  const [firstName, setFirstName] = useState('');
  const [role, setRole] = useState<MissingPersonCaseInput['responderRole'] | ''>('');
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(draft.file);
  const [photoOk, setPhotoOk] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [photoWarn, setPhotoWarn] = useState('');
  const preview = useObjectUrl(file);
  const create = useCreateMissingPersonCase();
  const intake = useGuideIntake();
  const lead = useCreateCaseLead();
  const photos = useCasePhotoUpload();
  const createdId = useRef<string | null>(null);
  const reqId = useRef(newId());
  const leadReqId = useRef(newId());
  const photoSavedFor = useRef<File | null>(null);
  const busyRef = useRef(false);

  async function submit() {
    if (busyRef.current) return;
    const n: Record<string, string> = {};
    if (!text.trim()) n.text = 'Tell us what happened.';
    if (!role) n.role = 'Choose your role.';
    if (!consent) n.consent = 'Please agree to continue.';
    if (file && !photoOk) n.photo = 'Confirm permission for the photo, or remove it.';
    setErrs(n); if (Object.keys(n).length) return;
    busyRef.current = true;
    setError(''); setPhotoWarn('');
    let warn = '';
    try {
      let id = createdId.current;
      if (!id) {
        setBusy('Creating your private case');
        const c = await create.mutateAsync({ data: { clientRequestId: reqId.current, firstName: firstName.trim() || 'Guide case', responderRole: role as MissingPersonCaseInput['responderRole'], privacyAcknowledged: true } });
        id = c.id; createdId.current = id;
        qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
      }
      if (file && photoOk && photoSavedFor.current !== file) {
        setBusy('Saving the photo as reference evidence');
        try {
          const photo = await photos.upload(file);
          await lead.mutateAsync({ id, data: { clientRequestId: leadReqId.current, kind: 'photo', title: 'Last scene photo (reference only)', source: 'Family-provided via AI Guide', notes: 'Reference evidence only. Not a headshot and not analyzed by the AI Guide.', permissionGranted: true, photo } });
          photoSavedFor.current = file;
        } catch (e) { warn = `The last photo was not saved: ${errorMessage(e)} You can add it later from the case page.`; setPhotoWarn(warn); }
      }
      setBusy('Reading what you wrote');
      const g = await intake.mutateAsync({ data: { caseId: id, text: text.trim(), revision: 0 } });
      qc.setQueryData<MissingPersonCase>(getGetMissingPersonCaseQueryKey(id), (old) => (old ? { ...old, guide: g } : old));
      qc.invalidateQueries({ queryKey: getGetMissingPersonCaseQueryKey(id) });
      clear();
      setNotice(warn);
      nav(`/guide/${id}`, { replace: true });
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(''); busyRef.current = false; }
  }

  return <div className="wa-guide-workspace fade-up mx-auto max-w-2xl space-y-5">
    <Link href="/cases" className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#718078]" data-testid="link-guide-back"><ArrowLeft size={14} />Cases</Link>
    <div><p className="font-data text-[10px] uppercase tracking-[.18em] text-[#9c6d4e]">AI Guide / private</p><h1 className="mt-2 font-editorial text-4xl tracking-[-.04em] sm:text-5xl">Let's write it down together.</h1><p className="mt-2 text-sm leading-6 text-[#62756c]">The guide organizes what you know for police and searchers. It does not analyze photos, guess locations or contact anyone.</p></div>
    <EmergencyBar />
    {error && <ErrorBanner message={error} onRetry={submit} />}
    <fieldset disabled={!!busy} className="min-w-0 space-y-5 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4 sm:p-5" aria-busy={!!busy}>
      <div><label htmlFor="g-text" className="mb-1.5 block text-sm font-semibold text-[#344b42]">What happened</label><textarea id="g-text" rows={5} maxLength={6000} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} data-testid="input-guide-text" />{errs.text && <p role="alert" className="mt-1 text-xs text-[#a64e43]">{errs.text}</p>}</div>
      <div><label htmlFor="g-name" className="mb-1.5 block text-sm font-semibold text-[#344b42]">Their first name</label><input id="g-name" maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} placeholder="Leave blank to use 'Guide case'" data-testid="input-guide-first-name" /><p className="mt-1 text-xs text-[#718078]">You can edit this any time on the case page.</p></div>
      <fieldset><legend className="mb-1.5 text-sm font-semibold text-[#344b42]">Your role (self-declared)</legend><div className="grid gap-2 sm:grid-cols-3">{roles.map((r) => <label key={r.v} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${role === r.v ? 'border-[#385e51] bg-[#e9ede3]' : 'border-[#d8d1c2] bg-[#fbf9f3]'}`}><input type="radio" name="g-role" checked={role === r.v} onChange={() => setRole(r.v)} className="h-4 w-4 accent-[#385e51]" data-testid={`radio-guide-role-${r.v}`} />{r.l}</label>)}</div>{errs.role && <p role="alert" className="mt-1 text-xs text-[#a64e43]">{errs.role}</p>}</fieldset>
      <div className="rounded-xl border border-dashed border-[#b9c4b5] bg-[#e8e9df] p-3">
        <p className="text-sm font-semibold text-[#344b42]">Last photo (optional)</p>
        <p className="text-xs text-[#718078]">Saved privately as reference evidence on the case. It is never sent to the AI and is not a headshot.</p>
        <div className="mt-2 flex items-center gap-3">
          {preview ? <img src={preview} alt="Selected last photo" className="h-16 w-16 rounded-lg object-cover" /> : null}
          <label className={`${guideGhost} cursor-pointer`}><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" data-testid="input-guide-start-photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const m = validatePhoto(f); if (m) { setErrs((p) => ({ ...p, photo: m })); return; } leadReqId.current = newId(); setFile(f); }} />{file ? 'Replace' : 'Choose photo'}</label>
          {file && <button type="button" onClick={() => { setFile(null); setPhotoOk(false); }} className="min-h-11 px-2 text-xs font-semibold text-[#a64e43] underline" data-testid="button-guide-start-remove-photo">Remove</button>}
        </div>
        {file && <label className="mt-2 flex min-h-11 items-start gap-3 text-xs leading-5 text-[#344b42]"><input type="checkbox" checked={photoOk} onChange={(e) => setPhotoOk(e.target.checked)} className="mt-1 h-4 w-4 accent-[#385e51]" data-testid="checkbox-guide-photo-permission" />I have permission to save this photo privately on the case.</label>}
        {errs.photo && <p role="alert" className="mt-1 text-xs text-[#a64e43]">{errs.photo}</p>}
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] p-4 text-sm leading-6 text-[#344b42]"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1.5 h-4 w-4 accent-[#385e51]" data-testid="checkbox-guide-consent" /><span>I have permission to save these details in a private case. I understand my written words (not photos) are sent to OpenAI to organize the facts, that this is not an emergency service, and that nothing here confirms anyone's identity or location.</span></label>
      {errs.consent && <p role="alert" className="-mt-3 text-xs text-[#a64e43]">{errs.consent}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/cases/new" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#385e51] underline underline-offset-4" data-testid="link-guide-start-regular">{REGULAR_FORM_LINK}</Link>
        <button type="button" onClick={submit} disabled={!!busy} className={guidePrimary} data-testid="button-guide-create">{busy ? <><Loader2 size={15} className="animate-spin" />{busy}</> : <>Start the guide <Send size={15} /></>}</button>
      </div>
      {photoWarn && <p role="status" className="text-xs text-[#a64e43]">{photoWarn}</p>}
    </fieldset>
    <Disclaimer />
    <PrivacyNotice compact />
  </div>;
}

/** /guide/:id: resume conversation, questions, optional notes, plan. */
export function GuideCasePage() {
  const { id = '' } = useParams<{ id: string }>();
  const q = useGetMissingPersonCase(id);
  const sync = useSyncGuide(id);
  const intake = useGuideIntake();
  const note = useGuideNote();
  const plan = useGuidePlan();
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [optAnswers, setOptAnswers] = useState<Record<string, string>>({});
  const [savedOpt, setSavedOpt] = useState<Record<string, boolean>>({});
  const [planState, setPlanState] = useState<{ plan: GuidePlan; revision: number } | null>(null);
  const { notice, setNotice } = useGuideDraft();
  const guide = q.data?.guide;
  // A plan is shown only for the revision it was prepared from; any refetch with a new revision hides it.
  const planData = planState && guide && planState.revision === guide.revision ? planState.plan : null;
  const messages = useMemo(() => (guide ? chatFromGuide(guide) : []), [guide]);

  if (q.isLoading) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (q.isError || !q.data) return <div className="mx-auto max-w-2xl"><ErrorBanner message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div>;
  const c = q.data;

  async function send(text: string) {
    if (!guide || !text.trim()) return;
    setError('');
    try {
      // The reply box always goes through intake so answers, corrections and safety changes update facts and the gate.
      const g = await intake.mutateAsync({ data: { caseId: id, text: text.trim(), revision: guide.revision } });
      sync(g); setReply(''); setPlanState(null);
    } catch (e) { setError(errorMessage(e)); q.refetch(); }
  }
  async function saveOptional(qid: string, prefix: string) {
    const v = optAnswers[qid]?.trim();
    if (!guide || !v) return;
    setError('');
    try { const g = await note.mutateAsync({ data: { caseId: id, text: `${prefix}: ${v}`, revision: guide.revision } }); sync(g); setSavedOpt((p) => ({ ...p, [qid]: true })); setPlanState(null); }
    catch (e) { setError(errorMessage(e)); q.refetch(); }
  }
  async function preparePlan() {
    setError('');
    if (!guide) return;
    const rev = guide.revision;
    try { setPlanState({ plan: await plan.mutateAsync({ data: { caseId: id } }), revision: rev }); } catch (e) { setError(errorMessage(e)); }
  }

  const pending = intake.isPending || note.isPending;
  const header = <div>
    <Link href={`/cases/${id}`} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#718078]" data-testid="link-guide-case"><ArrowLeft size={14} />Case details</Link>
    <p className="font-data text-[10px] uppercase tracking-[.18em] text-[#9c6d4e]">AI Guide / private case</p>
    <h1 className="mt-1 font-editorial text-4xl tracking-[-.04em]" data-testid="text-guide-case-name">{displayName(c)}</h1>
  </div>;

  if (!guide) return <div className="wa-guide-workspace fade-up mx-auto max-w-2xl space-y-5">{header}<EmergencyBar />
    <div className="rounded-2xl border border-dashed border-[#b9c4b5] bg-[#f8f5ec] p-6"><p className="font-editorial text-2xl">The guide has not started for this case.</p><p className="mt-1 text-sm text-[#718078]">Tell it what happened. Your words are sent to OpenAI to organize the facts.</p>
      <textarea rows={4} maxLength={6000} value={reply} onChange={(e) => setReply(e.target.value)} className={`${inputCls} mt-3`} aria-label="Tell us what happened." placeholder="Tell us what happened." data-testid="input-guide-first-message" />
      {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
      <button type="button" disabled={intake.isPending || !reply.trim()} onClick={async () => { setError(''); try { sync(await intake.mutateAsync({ data: { caseId: id, text: reply.trim(), revision: 0 } })); setReply(''); } catch (e) { setError(errorMessage(e)); } }} className={`${guidePrimary} mt-3`} data-testid="button-guide-first-send">{intake.isPending && <Loader2 size={15} className="animate-spin" />}Start the guide</button>
    </div><Disclaimer /><PrivacyNotice compact /></div>;

  const blocked = guide.gate === 'blocked';
  const clarifying = hasOpenQuestion(guide);
  const allowed = canPlan(guide);
  const yesNo = clarifying && isYesNoQuestion(guide.question);
  const notes = guide.log.filter((l) => l.role === 'note').map((l) => l.text);
  const summaryText = buildResponderSummary({ name: displayName(c), facts: guide.facts, notes, planSummary: planData?.summary });

  return <div className="wa-guide-workspace fade-up mx-auto max-w-2xl space-y-5 pb-28">
    {header}
    <EmergencyBar urgent={needsCallNow(guide) || blocked} />
    {blocked && <section role="alert" className="rounded-2xl border border-[#d9a596] bg-[#fbefeb] p-5" data-testid="panel-guide-blocked">
      <p className="flex items-center gap-2 font-editorial text-2xl text-[#8f4037]"><ShieldX size={20} />The guide cannot continue with this request.</p>
      <p className="mt-2 text-sm leading-6 text-[#5d3a33]">Whereabouts helps families organize facts about a missing person for authorized responders. It cannot be used to locate or follow someone who may not want to be found. If you believe someone is in danger, contact 911 or local police.</p>
    </section>}
    <section className="rounded-2xl border border-[#d8d1c2] bg-[#f4f0e6] p-3 sm:p-4" aria-label="Guide conversation">
      <GuideChat messages={messages} pending={pending} />
      {clarifying && guide.question && <p className="mt-3 font-data text-[10px] uppercase tracking-[.14em] text-[#718078]" data-testid="text-guide-question-count">Question {questionNumber(guide)} of up to {MAX_REQUIRED_QUESTIONS}</p>}
    </section>
    {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-[#dbb6a8] bg-[#fbefeb] p-3 text-sm text-[#a64e43]" data-testid="status-guide-photo-notice"><p>{notice}</p><button type="button" onClick={() => setNotice('')} className="min-h-11 shrink-0 px-2 text-xs font-semibold underline" data-testid="button-dismiss-notice">Dismiss</button></div>}
    {error && <ErrorBanner message={error} onRetry={() => { setError(''); q.refetch(); }} />}
    {!blocked && <section className="sticky bottom-3 z-10 rounded-2xl border border-[#d8d1c2] bg-[#fbf9f3] p-3 shadow-[0_12px_30px_rgba(38,61,54,.12)]" aria-label="Your reply">
      {yesNo && <div className="mb-2"><ReplyChips options={['Yes', 'No', 'Not sure']} onPick={send} disabled={pending} /></div>}
      <form onSubmit={(e) => { e.preventDefault(); send(reply); }} className="flex items-end gap-2">
        <label htmlFor="g-reply" className="sr-only">{clarifying ? 'Answer the question' : 'Add a detail'}</label>
        <textarea id="g-reply" rows={1} maxLength={6000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={clarifying ? 'Type your answer' : 'Add or correct a detail'} className={`${inputCls} min-h-11 resize-none`} data-testid="input-guide-reply" />
        <button type="submit" disabled={pending || !reply.trim()} className={guidePrimary} aria-label="Send" data-testid="button-guide-send">{pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
      </form>
    </section>}

    {!blocked && <FactsPanel guide={guide} />}

    {allowed && <section className="space-y-3 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4 sm:p-5" aria-labelledby="opt-h">
      <h2 id="opt-h" className="font-editorial text-2xl">A few optional details</h2>
      <p className="text-xs text-[#718078]">Skip any of these. Each answer is saved as a note on the case.</p>
      {optionalQuestions.map((oq) => <div key={oq.id}><label htmlFor={`opt-${oq.id}`} className="mb-1 block text-sm font-semibold text-[#344b42]">{oq.prompt}</label>
        <div className="flex gap-2"><input id={`opt-${oq.id}`} maxLength={500} value={optAnswers[oq.id] ?? ''} onChange={(e) => { setOptAnswers((p) => ({ ...p, [oq.id]: e.target.value })); setSavedOpt((p) => ({ ...p, [oq.id]: false })); }} className={`${inputCls} min-h-11`} data-testid={`input-optional-${oq.id}`} />
          <button type="button" disabled={note.isPending || !optAnswers[oq.id]?.trim() || savedOpt[oq.id]} onClick={() => saveOptional(oq.id, oq.prefix)} className={guideGhost} data-testid={`button-save-optional-${oq.id}`}>{savedOpt[oq.id] ? 'Saved' : 'Save'}</button></div></div>)}
    </section>}

    {allowed && <section className="space-y-4" aria-labelledby="plan-h">
      <h2 id="plan-h" className="sr-only">Responder summary</h2>
      {!planData && <button type="button" onClick={preparePlan} disabled={plan.isPending} className={`${guidePrimary} w-full sm:w-auto`} data-testid="button-prepare-summary">{plan.isPending ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}Prepare responder summary</button>}
      {planData && <>
        {planData.actions.length > 0 && <ul className="grid gap-3" data-testid="list-guide-actions">{planData.actions.map((a, i) => <li key={`${a.kind}-${i}`} className="rounded-2xl border border-[#d8d1c2] bg-[#fbf9f3] p-4" data-testid={`card-guide-action-${a.kind}`}>
          <p className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">From: {a.sourceLabel}</p>
          <details className="mt-1 group" data-testid={`details-why-${a.kind}`}><summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-[#385e51]">Why this <ChevronDown size={14} className="transition group-open:rotate-180" /></summary>
            <dl className="rounded-xl bg-[#f4f0e6] p-3 text-xs leading-5 text-[#465c50]"><dt className="font-semibold">Source</dt><dd>{a.sourceLabel} (user-reported, unverified)</dd><dt className="mt-1 font-semibold">Reason</dt><dd>{a.reason}</dd></dl></details>
          <div className="mt-3">{a.kind === 'call_911' ? <a href="tel:911" className={`${guidePrimary} !bg-[#a64e43]`} data-testid="link-action-call"><Phone size={15} />Call 911</a>
            : a.kind === 'share_report' ? <a href="#summary-h" className={guideGhost} data-testid="link-action-share"><Share2 size={15} />Review and share below</a>
            : <a href="#summary-h" className={guideGhost} data-testid="link-action-print"><Printer size={15} />Review and print below</a>}</div>
        </li>)}</ul>}
        <ResponderSummary text={summaryText} filename={`responder-summary-${displayName(c).replace(/\W+/g, '-').toLowerCase()}.txt`} />
      </>}
    </section>}
    {!allowed && !blocked && <p className="rounded-xl bg-[#f8f5ec] p-3 text-xs text-[#718078]">The responder summary becomes available once the required facts are in.</p>}
    {allowed && clarifying && <p className="rounded-xl bg-[#f8f5ec] p-3 text-xs text-[#718078]">One question is still open above. Answering it makes the summary more useful.</p>}
    <Link href={`/cases/${id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[#385e51] underline underline-offset-4" data-testid="link-guide-open-form">{REGULAR_FORM_LINK}</Link>
    <Disclaimer />
    <PrivacyNotice compact />
  </div>;
}

export function FactsPanel({ guide }: { guide: GuideState }) {
  return <details className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4" data-testid="panel-guide-facts">
    <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-[#385e51]">Facts so far · user-reported, unverified</summary>
    <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{factRows(guide.facts).map((r) => <div key={r.key} data-testid={`fact-${r.key}`}><dt className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">{r.label}</dt><dd className={r.known ? 'text-[#263d36]' : 'italic text-[#89948a]'}>{r.value}</dd></div>)}</dl>
    <p className="mt-3 text-xs text-[#718078]">To correct a fact, type the correction in the reply box. The guide records it.</p>
  </details>;
}
