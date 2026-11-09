import { useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMissingPersonCaseQueryKey, getListMissingPersonCasesQueryKey, useDeleteCaseLead, useDeleteMissingPersonCase,
  useGetMissingPersonCase, useReviewCaseLead, useUpdateMissingPersonCase,
} from '@workspace/api-client-react';
import type { CaseLead, CaseLeadReviewStatus, MissingPersonCase } from '@workspace/api-client-react';
import { CaseForm, type CaseValues } from './case-form';
import { LeadForm } from './lead-form';
import { displayName } from './cases-page';
import { ConfirmDialog, ErrorBanner, PrivacyNotice, Skeleton, errorMessage, ghostBtn, photoUrl } from './shared';
import { useDirtyGuard } from './use-dirty-guard';

const roleLabel = { 'family-or-guardian': 'Family or guardian', 'authorized-responder': 'Authorized responder', other: 'Other' } as const;
const statuses: { v: CaseLeadReviewStatus; l: string }[] = [{ v: 'needs-verification', l: 'Needs verification' }, { v: 'relevant', l: 'Relevant' }, { v: 'unrelated', l: 'Unrelated' }];
const fmt = (d?: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);

function toValues(c: MissingPersonCase): CaseValues {
  return { responderRole: c.responderRole, firstName: c.firstName, lastName: c.lastName ?? '', nickname: c.nickname ?? '', ageDescription: c.ageDescription ?? '', lastKnownDate: c.lastKnownDate ?? '', lastKnownArea: c.lastKnownArea ?? '', officialReference: c.officialReference ?? '', notes: c.notes ?? '' };
}

export default function CaseDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const q = useGetMissingPersonCase(id);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [confirmCase, setConfirmCase] = useState(false);
  const [confirmLead, setConfirmLead] = useState<CaseLead | null>(null);
  const [actionError, setActionError] = useState('');
  const edit = useDirtyGuard();
  const leadGuard = useDirtyGuard();

  const sync = (c: MissingPersonCase) => {
    qc.setQueryData(getGetMissingPersonCaseQueryKey(id), c);
    qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
  };
  const update = useUpdateMissingPersonCase({ mutation: { onSuccess: (c) => { sync(c); edit.setDirty(false); setEditing(false); setEditError(''); }, onError: (e) => setEditError(errorMessage(e)) } });
  const del = useDeleteMissingPersonCase({ mutation: { onSuccess: () => {
    qc.removeQueries({ queryKey: getGetMissingPersonCaseQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
    nav('/cases');
  }, onError: (e) => setActionError(errorMessage(e)) } });
  const review = useReviewCaseLead({ mutation: { onSuccess: (c) => { sync(c); setActionError(''); }, onError: (e) => setActionError(errorMessage(e)) } });
  const delLead = useDeleteCaseLead({ mutation: { onSuccess: () => {
    qc.invalidateQueries({ queryKey: getGetMissingPersonCaseQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
    setConfirmLead(null); setActionError('');
  }, onError: (e) => setActionError(errorMessage(e)) } });

  const back = <Link href="/cases" data-testid="link-back-cases" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#718078] hover:text-[#385e51]"><ArrowLeft size={14} />Back to cases</Link>;
  if (q.isLoading) return <div>{back}<Skeleton className="h-40" /><Skeleton className="mt-4 h-64" /></div>;
  if (q.isError || !q.data) return <div>{back}<ErrorBanner message={errorMessage(q.error)} onRetry={() => q.refetch()} /></div>;
  const c = q.data;
  const leads = [...c.leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return <div className="fade-up mx-auto max-w-5xl">
    {back}
    <p className="font-data text-[9px] uppercase tracking-[.2em] text-[#9c6d4e]">Private case / {roleLabel[c.responderRole]} (self-declared)</p>
    {editing ? <div className="mt-4">
      <h1 className="font-editorial text-4xl tracking-[-.04em]">Edit case information</h1>
      <div className="mt-6"><CaseForm initial={toValues(c)} initialHeadshot={c.headshot} submitLabel="Save changes" pending={update.isPending} error={editError} onDirtyChange={edit.setDirty}
        onCancel={() => { if (edit.confirmLeave()) { edit.setDirty(false); setEditing(false); setEditError(''); } }}
        onSubmit={(data) => { setEditError(''); update.mutate({ id, data: { ...data, clientRequestId: c.clientRequestId } }); }} /></div>
    </div> : <section className="mt-3 flex flex-col gap-6 sm:flex-row">
      {c.headshot && <img src={photoUrl(c.headshot)} alt="Reference headshot, private" className="h-40 w-40 rounded-2xl object-cover" data-testid="img-headshot" />}
      <div className="min-w-0 flex-1">
        <h1 className="font-editorial text-5xl tracking-[-.05em]" data-testid="text-case-name">{displayName(c)}</h1>
        <p className="mt-2 text-xs text-[#718078]">Name and details are not verified.</p>
        <dl className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {([['Age or description', c.ageDescription], ['Last-known date', fmt(c.lastKnownDate)], ['General area', c.lastKnownArea], ['Official reference', c.officialReference]] as const).map(([k, val]) => <div key={k}><dt className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">{k}</dt><dd className="mt-0.5 text-[#263d36]">{val || 'Not provided'}</dd></div>)}
        </dl>
        {c.notes && <p className="mt-5 whitespace-pre-wrap rounded-xl bg-[#f8f5ec] p-4 text-sm leading-6 text-[#44556d]">{c.notes}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => setEditing(true)} className={ghostBtn} data-testid="button-edit-case"><Pencil size={14} />Edit</button>
          <button type="button" onClick={() => { setActionError(''); setConfirmCase(true); }} className={`${ghostBtn} !text-[#a64e43]`} data-testid="button-delete-case"><Trash2 size={14} />Delete case</button>
        </div>
      </div>
    </section>}

    {!editing && <Link href={`/cases/${id}/review`} data-testid="link-continue-review" className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-[#385e51] p-5 text-[#f4f0e6] transition hover:bg-[#2e5044]"><span><span className="block font-editorial text-2xl">Continue case review</span><span className="mt-1 block text-xs text-[#d6e0d3]">{c.review ? 'Pick up your observations, follow-up notes and timeline.' : 'Start your manual observations, follow-up notes and timeline.'}</span></span><ArrowRight size={20} /></Link>}

    <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-10">
        <section aria-labelledby="leads-h">
          <h2 id="leads-h" className="border-b border-[#d8d1c2] pb-3 font-editorial text-3xl tracking-[-.03em]">Saved leads <span className="font-data text-xs text-[#718078]">{leads.length}</span></h2>
          {actionError && !confirmLead && !confirmCase && <div className="mt-4"><ErrorBanner message={actionError} /></div>}
          <p className="mt-3 text-xs leading-5 text-[#718078]">Review labels reflect your assessment of relevance, not independent verification or confirmed whereabouts.</p>
          {leads.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-[#b9c4b5] bg-[#f8f5ec] p-8 text-center text-sm text-[#718078]" data-testid="empty-leads">No leads yet. Add an authorized photo, link or tip below. New leads are marked needs verification.</p>
            : <ul className="mt-5 space-y-4">{leads.map((l) => <li key={l.id} data-testid={`card-lead-${l.id}`} className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4">
              <div className="flex gap-4">
                {l.photo && <img src={photoUrl(l.photo)} alt={`Submitted photo: ${l.title}`} className="h-24 w-24 shrink-0 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">{l.kind} / source: {l.source}</p>
                  <h3 className="mt-1 break-words font-editorial text-xl">{l.title}</h3>
                  {l.sourceUrl && <p className="mt-1 break-all text-xs text-[#44556d]">{/^https?:\/\//i.test(l.sourceUrl) ? <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="underline">{l.sourceUrl}</a> : l.sourceUrl}</p>}
                  <p className="mt-2 text-xs text-[#718078]">Reported taken: {fmt(l.reportedTakenOn) ?? 'unknown'} / Posted: {fmt(l.postedOn) ?? 'unknown'}</p>
                  <p className="mt-1 text-xs text-[#718078]">Added to case: {new Date(l.createdAt).toLocaleString()}</p>
                  {l.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-[#44556d]">{l.notes}</p>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#d8d1c2] pt-3">
                <div role="group" aria-label="Review status" className="flex flex-wrap gap-1.5">{statuses.map((s) => <button key={s.v} type="button" aria-pressed={l.reviewStatus === s.v} disabled={review.isPending} data-testid={`button-review-${s.v}-${l.id}`} onClick={() => l.reviewStatus !== s.v && review.mutate({ id, leadId: l.id, data: { reviewStatus: s.v } })} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${l.reviewStatus === s.v ? 'border-[#385e51] bg-[#385e51] text-[#f4f0e6]' : 'border-[#d8d1c2] bg-[#fbf9f3] text-[#385e51]'}`}>{s.l}</button>)}</div>
                <button type="button" onClick={() => { setActionError(''); setConfirmLead(l); }} data-testid={`button-delete-lead-${l.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a64e43]"><Trash2 size={13} />Delete</button>
              </div>
            </li>)}</ul>}
        </section>
        <section aria-labelledby="add-h"><h2 id="add-h" className="mb-4 font-editorial text-3xl tracking-[-.03em]">Add a lead</h2><LeadForm caseId={id} onDirtyChange={leadGuard.setDirty} /></section>
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start"><PrivacyNotice /></div>
    </div>

    {confirmCase && <ConfirmDialog title="Delete this case?" body="The case and all saved leads will be permanently removed. Photo access is revoked immediately; storage deletion is retried if unavailable. This cannot be undone." confirmLabel="Delete case" busy={del.isPending} error={actionError} onCancel={() => setConfirmCase(false)} onConfirm={() => { setActionError(''); del.mutate({ id }); }} />}
    {confirmLead && <ConfirmDialog title="Delete this lead?" body={`"${confirmLead.title}" and its uploaded photo, if any, will be permanently deleted.`} confirmLabel="Delete lead" busy={delLead.isPending} error={actionError} onCancel={() => setConfirmLead(null)} onConfirm={() => { setActionError(''); delLead.mutate({ id, leadId: confirmLead.id }); }} />}
  </div>;
}
