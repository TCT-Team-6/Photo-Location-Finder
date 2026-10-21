import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMissingPersonCaseQueryKey, getListMissingPersonCasesQueryKey, useCreateCaseLead } from '@workspace/api-client-react';
import type { CaseLeadInputKind, CasePhoto } from '@workspace/api-client-react';
import { ErrorBanner, Field, PhotoPicker, errorMessage, inputCls, newId, primaryBtn, useCasePhotoUpload, validatePhoto } from './shared';

const kinds: { v: CaseLeadInputKind; l: string }[] = [{ v: 'photo', l: 'Photo' }, { v: 'link', l: 'Source link' }, { v: 'tip', l: 'Tip' }];
const blank = { kind: 'tip' as CaseLeadInputKind, title: '', source: '', sourceUrl: '', notes: '', reportedTakenOn: '', postedOn: '' };

export function LeadForm({ caseId, onDirtyChange }: { caseId: string; onDirtyChange: (d: boolean) => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState(blank);
  const [file, setFile] = useState<File | null>(null);
  const [perm, setPerm] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const requestId = useRef(newId());
  const photos = useCasePhotoUpload();
  const create = useCreateCaseLead({
    mutation: {
      onSuccess: (c) => {
        requestId.current = newId();
        qc.setQueryData(getGetMissingPersonCaseQueryKey(caseId), c);
        qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
        setV(blank); setFile(null); setPerm(false); setErrs({}); setError(''); photos.reset(); setSaved(true);
      },
      onError: (e) => setError(errorMessage(e)),
    },
  });
  const dirty = !!file || perm || (Object.keys(blank) as (keyof typeof blank)[]).some((k) => v[k] !== blank[k]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const set = (k: keyof typeof blank, val: string) => { setSaved(false); setV((p) => ({ ...p, [k]: val })); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (create.isPending || uploading) return;
    const n: Record<string, string> = {};
    if (!v.title.trim()) n.title = 'Add a short title.';
    if (!v.source.trim()) n.source = 'Say where this came from.';
    if (v.kind === 'link' && !/^https?:\/\/\S+$/i.test(v.sourceUrl.trim())) n.sourceUrl = 'Enter a link starting with http:// or https://.';
    if (v.sourceUrl.trim() && v.kind !== 'link' && !/^https?:\/\/\S+$/i.test(v.sourceUrl.trim())) n.sourceUrl = 'Enter a link starting with http:// or https://.';
    if (v.kind === 'photo' && !file) n.photo = 'Choose the authorized photo to save.';
    if (v.kind === 'tip' && !v.notes.trim()) n.notes = 'Describe the tip.';
    if (!perm) n.perm = 'Confirm you have permission to submit this.';
    setErrs(n);
    if (Object.keys(n).length) return;
    setError('');
    let photo: CasePhoto | null = null;
    if (v.kind === 'photo' && file) {
      setUploading(true);
      try { photo = await photos.upload(file); } catch (err) { setUploading(false); setError(errorMessage(err)); return; }
      setUploading(false);
    }
    create.mutate({ id: caseId, data: {
      clientRequestId: requestId.current, kind: v.kind, title: v.title.trim(), source: v.source.trim(),
      sourceUrl: v.sourceUrl.trim(), notes: v.notes.trim(), reportedTakenOn: v.reportedTakenOn || null,
      postedOn: v.postedOn || null, permissionGranted: true, photo,
    } });
  }
  const busy = create.isPending || uploading;
  return <form onSubmit={submit} noValidate aria-busy={busy} className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5" data-testid="form-lead">
    <fieldset disabled={busy} className="min-w-0 space-y-5">
    {error && <ErrorBanner message={error} />}
    {saved && <p role="status" data-testid="status-lead-saved" className="rounded-xl bg-[#e9ede3] px-4 py-3 text-xs font-semibold text-[#385e51]">Lead saved as needs verification.</p>}
    <fieldset><legend className="mb-2 text-xs font-semibold text-[#344b42]">Type of lead</legend>
      <div className="flex gap-2">{kinds.map((k) => <label key={k.v} className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-semibold ${v.kind === k.v ? 'border-[#385e51] bg-[#385e51] text-[#f4f0e6]' : 'border-[#d8d1c2] bg-[#fbf9f3] text-[#385e51]'}`}>
        <input type="radio" name="kind" className="sr-only" checked={v.kind === k.v} onChange={() => set('kind', k.v)} data-testid={`radio-kind-${k.v}`} />{k.l}</label>)}</div>
    </fieldset>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="lead-title" label="Title" error={errs.title}><input id="lead-title" data-testid="input-lead-title" maxLength={160} value={v.title} onChange={(e) => set('title', e.target.value)} className={inputCls} /></Field>
      <Field id="lead-source" label="Source" hint="Who or what provided it" error={errs.source}><input id="lead-source" data-testid="input-lead-source" maxLength={200} value={v.source} onChange={(e) => set('source', e.target.value)} className={inputCls} /></Field>
    </div>
    <Field id="lead-url" label={v.kind === 'link' ? 'Link' : 'Source link (optional)'} hint="Saved as text only. It is never opened, fetched or previewed." error={errs.sourceUrl}><input id="lead-url" data-testid="input-lead-url" inputMode="url" maxLength={2000} value={v.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)} className={inputCls} placeholder="https://" /></Field>
    {v.kind === 'photo' && <PhotoPicker id="lead-photo" label="Authorized photo" hint="JPEG, PNG or WebP, up to 25 MB. Stored privately; not analyzed." file={file} onChange={(f) => { const m = validatePhoto(f); if (m) { setErrs((p) => ({ ...p, photo: m })); return; } setErrs((p) => ({ ...p, photo: '' })); setFile(f); }} onClear={() => setFile(null)} error={errs.photo} />}
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="lead-taken" label="Reported taken on" hint="As claimed by the source"><input id="lead-taken" type="date" data-testid="input-lead-taken" value={v.reportedTakenOn} onChange={(e) => set('reportedTakenOn', e.target.value)} className={inputCls} /></Field>
      <Field id="lead-posted" label="Posted on" hint="When the source published it"><input id="lead-posted" type="date" data-testid="input-lead-posted" value={v.postedOn} onChange={(e) => set('postedOn', e.target.value)} className={inputCls} /></Field>
    </div>
    <Field id="lead-notes" label={v.kind === 'tip' ? 'Tip details (required)' : 'Notes'} error={errs.notes}><textarea id="lead-notes" rows={3} maxLength={3000} data-testid="input-lead-notes" value={v.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} /></Field>
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] p-4 text-sm leading-6">
        <input type="checkbox" checked={perm} onChange={(e) => setPerm(e.target.checked)} data-testid="checkbox-permission" className="mt-1.5 h-4 w-4 accent-[#385e51]" />
        <span>I have permission to save this material, and I understand it will not be verified, searched, or matched to anyone.</span>
      </label>
      {errs.perm && <p role="alert" className="mt-1.5 text-xs font-medium text-[#a64e43]">{errs.perm}</p>}
    </div>
    <button type="submit" disabled={busy} className={primaryBtn} data-testid="button-save-lead">{busy && <Loader2 size={15} className="animate-spin" />}{uploading ? 'Uploading photo' : create.isPending ? 'Saving' : 'Save lead'}</button>
    </fieldset>
  </form>;
}
