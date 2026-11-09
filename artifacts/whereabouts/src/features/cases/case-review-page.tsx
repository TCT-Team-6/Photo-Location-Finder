import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Loader2, Maximize2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMissingPersonCaseQueryKey, getListMissingPersonCasesQueryKey, useGetMissingPersonCase, useReviewCaseLead, useSaveCaseReview } from '@workspace/api-client-react';
import type { CasePhoto, CaseLeadReviewStatus, MissingPersonCase } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { buildCaseTimeline } from '@/lib/case-timeline';
import { displayName } from './cases-page';
import { ErrorBanner, PrivacyNotice, Skeleton, errorMessage, ghostBtn, inputCls, photoUrl, primaryBtn } from './shared';
import { useDirtyGuard } from './use-dirty-guard';

const statuses: { v: CaseLeadReviewStatus; l: string }[] = [{ v: 'needs-verification', l: 'Needs verification' }, { v: 'relevant', l: 'Relevant' }, { v: 'unrelated', l: 'Unrelated' }];
const fmt = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);
type Saved = { observations: string; nextSteps: string; revision: number };
const savedOf = (c: MissingPersonCase): Saved => ({ observations: c.review?.observations ?? '', nextSteps: c.review?.nextSteps ?? '', revision: c.review?.revision ?? 0 });

export default function CaseReviewPage() {
  const { id = '' } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const q = useGetMissingPersonCase(id);
  const guard = useDirtyGuard();
  const [draft, setDraft] = useState<{ observations: string; nextSteps: string } | null>(null);
  const base = useRef<Saved | null>(null);
  const [baseRev, setBaseRev] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [zoom, setZoom] = useState<{ photo: CasePhoto; label: string } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const sync = (c: MissingPersonCase) => {
    qc.setQueryData(getGetMissingPersonCaseQueryKey(id), c);
    qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
  };
  const save = useSaveCaseReview({ mutation: {
    onMutate: async () => { await qc.cancelQueries({ queryKey: getGetMissingPersonCaseQueryKey(id) }); },
    onSuccess: (c) => {
      sync(c);
      const s = savedOf(c);
      base.current = s; setBaseRev(s.revision);
      setDraft({ observations: s.observations, nextSteps: s.nextSteps });
      setSaveError(''); setConflict(false); setComparing(false); setSavedAt(c.review?.updatedAt ?? null);
    },
    onError: (e) => {
      if ((e as { status?: number })?.status === 409) { setConflict(true); setSaveError(''); qc.invalidateQueries({ queryKey: getGetMissingPersonCaseQueryKey(id) }); }
      else setSaveError(errorMessage(e));
    },
  } });
  const review = useReviewCaseLead({ mutation: {
    onMutate: async () => { await qc.cancelQueries({ queryKey: getGetMissingPersonCaseQueryKey(id) }); },
    onSuccess: (c) => { sync(c); setActionError(''); }, onError: (e) => setActionError(errorMessage(e)),
  } });

  const server = q.data ? savedOf(q.data) : null;
  const dirty = !!draft && !!base.current && (draft.observations !== base.current.observations || draft.nextSteps !== base.current.nextSteps);
  guard.setDirty(dirty || save.isPending);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;

  // Initialize once; adopt newer server review only while the draft is clean.
  useEffect(() => {
    if (!server) return;
    if (!base.current || (!dirtyRef.current && !save.isPending && server.revision !== base.current.revision)) {
      base.current = server; setBaseRev(server.revision);
      setDraft({ observations: server.observations, nextSteps: server.nextSteps });
    }
  }, [server?.revision, server?.observations, server?.nextSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeline = useMemo(() => buildCaseTimeline(q.data?.leads ?? []), [q.data]);

  const back = <Link href={`/cases/${id}`} data-testid="link-back-case" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#718078] hover:text-[#385e51]"><ArrowLeft size={14} />Back to case overview</Link>;
  if (q.isLoading) return <div>{back}<Skeleton className="h-32" /><Skeleton className="mt-4 h-64" /></div>;
  if (!q.data) return <div>{back}<ErrorBanner message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div>;
  const c = q.data;
  const locked = save.isPending;
  const latestDiffers = !!server && server.revision !== baseRev;

  const loadLatest = () => {
    if (!server) return;
    if (dirty && !window.confirm('Replace your unsaved draft with the latest saved review? Your draft text will be discarded.')) return;
    base.current = server; setBaseRev(server.revision);
    setDraft({ observations: server.observations, nextSteps: server.nextSteps }); setConflict(false); setComparing(false); setSaveError('');
  };
  const keepDraft = () => { if (!server) return; base.current = server; setBaseRev(server.revision); setConflict(false); setComparing(true); };
  const submit = () => { if (draft && dirty && !save.isPending && !review.isPending && !conflict) { setSaveError(''); save.mutate({ id, data: { ...draft, expectedRevision: baseRev } }); } };

  const photoBtn = (p: CasePhoto, label: string, cls: string) => <button type="button" onClick={() => setZoom({ photo: p, label })} aria-label={`View full-size: ${label}`} data-testid="button-zoom-photo" className={`group relative shrink-0 overflow-hidden rounded-xl ${cls}`}>
    <img src={photoUrl(p)} alt={label} className="h-full w-full object-cover" /><span className="absolute bottom-1 right-1 rounded-full bg-[#263d36]/80 p-1 text-[#f4f0e6]"><Maximize2 size={12} /></span></button>;

  const leadCard = (l: MissingPersonCase['leads'][number], basis?: string) => <li key={l.id} data-testid={`card-review-lead-${l.id}`} className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4">
    <div className="flex gap-4">
      {l.photo && photoBtn(l.photo, `Submitted photo: ${l.title}`, 'h-20 w-20')}
      <div className="min-w-0 flex-1">
        <p className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">{l.kind} / source: {l.source}</p>
        <h4 className="mt-1 break-words font-editorial text-lg">{l.title}</h4>
        {l.sourceUrl && <p className="mt-1 break-all text-xs text-[#44556d]">{/^https?:\/\//i.test(l.sourceUrl) ? <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">{l.sourceUrl}</a> : l.sourceUrl}</p>}
        <dl className="mt-2 grid gap-x-6 gap-y-0.5 text-xs text-[#718078] sm:grid-cols-3">
          <div><dt className="inline font-semibold">Reported taken: </dt><dd className="inline">{fmt(l.reportedTakenOn) ?? 'unknown'}</dd></div>
          <div><dt className="inline font-semibold">Posted: </dt><dd className="inline">{fmt(l.postedOn) ?? 'unknown'}</dd></div>
          <div><dt className="inline font-semibold">Added to case: </dt><dd className="inline">{new Date(l.createdAt).toLocaleString()}</dd></div>
        </dl>
        {basis && <p className="mt-1 text-[11px] italic text-[#9c6d4e]">{basis}</p>}
        {l.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-[#44556d]">{l.notes}</p>}
      </div>
    </div>
    <div role="group" aria-label="Relevance" className="mt-3 flex flex-wrap gap-1.5 border-t border-[#d8d1c2] pt-3">{statuses.map((s) => <button key={s.v} type="button" aria-pressed={l.reviewStatus === s.v} disabled={review.isPending || save.isPending} data-testid={`button-review-${s.v}-${l.id}`} onClick={() => l.reviewStatus !== s.v && review.mutate({ id, leadId: l.id, data: { reviewStatus: s.v } })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${l.reviewStatus === s.v ? 'border-[#385e51] bg-[#385e51] text-[#f4f0e6]' : 'border-[#d8d1c2] bg-[#fbf9f3] text-[#385e51]'}`}>{s.l}</button>)}</div>
  </li>;

  return <div className="fade-up mx-auto max-w-5xl">
    {back}
    <p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">Manual case review</p>
    <h1 className="mt-1 font-editorial text-4xl tracking-[-.04em]" data-testid="text-review-case-name">{displayName(c)}</h1>
    <p className="mt-2 max-w-2xl text-xs leading-5 text-[#718078]">Your own observations and follow-up notes. Nothing here is verified, automated, or a conclusion about anyone's whereabouts.</p>
    {q.isError && <div className="mt-4"><ErrorBanner message="Could not refresh the latest saved case. Your draft is still here; retry before resolving a conflict." onRetry={() => q.refetch()} /></div>}

    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-10">
        {c.headshot && <section aria-labelledby="ref-h" className="flex items-center gap-4 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4">
          {photoBtn(c.headshot, 'Reference headshot, private', 'h-24 w-24')}
          <div><h2 id="ref-h" className="font-editorial text-xl">Reference headshot</h2><p className="text-xs text-[#718078]">Supplied by you as a reference. Select to view full size.</p></div>
        </section>}

        <section aria-labelledby="notes-h">
          <h2 id="notes-h" className="border-b border-[#d8d1c2] pb-3 font-editorial text-3xl tracking-[-.03em]">Your notes</h2>
          {(conflict || comparing) && <div role="alert" data-testid="notice-conflict" className="mt-4 rounded-xl border border-[#dbb6a8] bg-[#fbefeb] p-4 text-sm text-[#7a3d34]">
            <p className="font-semibold">{conflict ? 'A newer saved review exists.' : 'Compare and merge your notes manually.'}</p>
            <p className="mt-1">{conflict ? <>It was saved from another tab or device{c.review ? ` at ${new Date(c.review.updatedAt).toLocaleString()}` : ''}. Your draft is untouched and was not saved.</> : 'Your draft is kept below. Combine any text you need from the saved review before saving. Nothing is merged automatically.'}</p>
            {server && <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs text-[#44556d]">
              <div className="rounded-lg bg-[#fbf9f3] p-3"><p className="font-semibold">Latest observations</p><p className="mt-1 whitespace-pre-wrap">{server.observations || 'Empty'}</p></div>
              <div className="rounded-lg bg-[#fbf9f3] p-3"><p className="font-semibold">Latest follow-up notes</p><p className="mt-1 whitespace-pre-wrap">{server.nextSteps || 'Empty'}</p></div>
            </div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={(conflict && !latestDiffers) || q.isFetching || locked} onClick={loadLatest} className={`${ghostBtn} disabled:opacity-50`} data-testid="button-load-latest">Load latest (discard my draft)</button>
              {conflict && <button type="button" disabled={!latestDiffers || q.isFetching || locked} onClick={keepDraft} className={`${ghostBtn} disabled:opacity-50`} data-testid="button-keep-draft">Keep my draft to merge manually</button>}
            </div>
          </div>}
          {!conflict && !comparing && latestDiffers && dirty && <p className="mt-4 rounded-xl bg-[#e9ede3] p-3 text-xs text-[#465c50]" data-testid="notice-newer">A newer saved review exists. Your draft is kept. <button type="button" onClick={loadLatest} className="font-semibold underline">Load latest</button></p>}
          {saveError && <div className="mt-4"><ErrorBanner message={saveError} onRetry={submit} /></div>}
          <form className="mt-5 space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div><label htmlFor="obs" className="mb-1.5 block text-xs font-semibold text-[#344b42]">Observations</label>
              <textarea id="obs" data-testid="input-observations" rows={7} maxLength={10000} disabled={locked || !draft} value={draft?.observations ?? ''} onChange={(e) => setDraft((d) => d && { ...d, observations: e.target.value })} className={inputCls} placeholder="What you have noticed, and where it came from." /></div>
            <div><label htmlFor="next" className="mb-1.5 block text-xs font-semibold text-[#344b42]">Follow-up notes</label>
              <textarea id="next" data-testid="input-next-steps" rows={5} maxLength={10000} disabled={locked || !draft} value={draft?.nextSteps ?? ''} onChange={(e) => setDraft((d) => d && { ...d, nextSteps: e.target.value })} className={inputCls} placeholder="Questions to ask, people to contact, things to check." /></div>
            <div className="flex flex-wrap items-center gap-4">
              <button type="submit" disabled={locked || review.isPending || !dirty || conflict} className={primaryBtn} data-testid="button-save-review">{locked && <Loader2 size={15} className="animate-spin" />}{locked ? 'Saving' : 'Save notes'}</button>
              <p className="text-xs text-[#718078]" aria-live="polite" data-testid="text-save-state">{locked ? 'Saving, editing paused.' : dirty ? 'Unsaved changes.' : savedAt || c.review ? `Saved ${new Date(savedAt ?? c.review!.updatedAt).toLocaleString()}` : 'Nothing saved yet.'}</p>
            </div>
          </form>
        </section>

        <section aria-labelledby="tl-h">
          <h2 id="tl-h" className="border-b border-[#d8d1c2] pb-3 font-editorial text-3xl tracking-[-.03em]">Timeline <span className="font-data text-xs text-[#718078]">{c.leads.length}</span></h2>
          <p className="mt-3 text-xs leading-5 text-[#718078]">Ordered by the date each lead was reported as taken; if absent, by posted date (marked). Dates are as supplied and unverified. Added-to-case time is when you saved it, not when it happened.</p>
          {actionError && <div className="mt-4"><ErrorBanner message={actionError} /></div>}
          {c.leads.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-[#b9c4b5] bg-[#f8f5ec] p-8 text-center text-sm text-[#718078]" data-testid="empty-timeline">No leads to review yet. <Link href={`/cases/${id}`} className="font-semibold underline">Add one from the case overview.</Link></p> : <>
            {timeline.dated.length > 0 && <ol className="mt-5 space-y-5 border-l border-[#b9c4b5] pl-5">{timeline.dated.map((e) => <li key={e.lead.id}>
              <p className="-ml-[26px] mb-2 flex items-center gap-2 font-data text-[10px] uppercase tracking-[.14em] text-[#385e51]"><span className="h-2 w-2 rounded-full bg-[#385e51]" />{fmt(e.date)} / {e.basis === 'reported' ? 'reported taken' : 'posted (taken date unknown)'}</p>
              <ul>{leadCard(e.lead, e.basis === 'posted' ? 'No taken date supplied; placed by posted date.' : undefined)}</ul>
            </li>)}</ol>}
            {timeline.undated.length > 0 && <div className="mt-8" data-testid="section-undated"><h3 className="font-editorial text-xl">Dates unknown</h3><p className="mt-1 text-xs text-[#718078]">No reported or posted date. Listed by when added.</p><ul className="mt-3 space-y-4">{timeline.undated.map((l) => leadCard(l))}</ul></div>}
          </>}
        </section>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start"><PrivacyNotice compact /></div>
    </div>

    <Dialog open={!!zoom} onOpenChange={(o) => { if (!o) setZoom(null); }}>
      <DialogContent className="max-w-[95vw] border-[#d8d1c2] bg-[#fbf9f3] p-3 sm:max-w-4xl">
        <DialogTitle className="font-editorial text-lg font-normal text-[#263d36]">{zoom?.label}</DialogTitle>
        <DialogDescription className="sr-only">Full-size private photo. Press Escape to close.</DialogDescription>
        {zoom && <img src={photoUrl(zoom.photo)} alt={zoom.label} className="mx-auto max-h-[75dvh] w-auto max-w-full object-contain" data-testid="img-zoom" />}
      </DialogContent>
    </Dialog>
  </div>;
}
