import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import type { CasePhoto, MissingPersonCaseInput } from '@workspace/api-client-react';
import { ErrorBanner, Field, PhotoPicker, errorMessage, ghostBtn, inputCls, primaryBtn, useCasePhotoUpload, validatePhoto } from './shared';

export type CaseValues = {
  responderRole: MissingPersonCaseInput['responderRole'];
  firstName: string; lastName: string; nickname: string; ageDescription: string;
  lastKnownDate: string; lastKnownArea: string; officialReference: string; notes: string;
};
export const emptyCase: CaseValues = { responderRole: 'other', firstName: '', lastName: '', nickname: '', ageDescription: '', lastKnownDate: '', lastKnownArea: '', officialReference: '', notes: '' };
const roles: { v: CaseValues['responderRole']; l: string }[] = [
  { v: 'family-or-guardian', l: 'Family member or guardian' },
  { v: 'authorized-responder', l: 'Authorized responder' },
  { v: 'other', l: 'Other' },
];

export function CaseForm({ initial, initialHeadshot, submitLabel, pending, error, onDirtyChange, onSubmit, onCancel }: {
  initial: CaseValues; initialHeadshot?: CasePhoto | null; submitLabel: string; pending: boolean; error?: string;
  onDirtyChange: (d: boolean) => void;
  onSubmit: (values: Omit<MissingPersonCaseInput, 'clientRequestId'>) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [removed, setRemoved] = useState(false);
  const [ack, setAck] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [uploadErr, setUploadErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const photos = useCasePhotoUpload();
  const set = (k: keyof CaseValues, val: string) => setV((p) => ({ ...p, [k]: val }));
  const dirty = file !== null || removed || ack || (Object.keys(initial) as (keyof CaseValues)[]).some((k) => v[k] !== initial[k]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending || uploading) return;
    const n: Record<string, string> = {};
    if (!v.firstName.trim()) n.firstName = 'A first name is required.';
    if (v.lastKnownDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.lastKnownDate)) n.lastKnownDate = 'Use a valid date.';
    if (!ack) n.ack = 'Please acknowledge to save this case.';
    setErrs(n);
    if (Object.keys(n).length) return;
    setUploadErr('');
    let headshot: CasePhoto | null = removed ? null : initialHeadshot ?? null;
    if (file) {
      setUploading(true);
      try { headshot = await photos.upload(file); } catch (err) { setUploading(false); setUploadErr(errorMessage(err)); return; }
      setUploading(false);
    }
    onSubmit({
      responderRole: v.responderRole, firstName: v.firstName.trim(), lastName: v.lastName.trim(), nickname: v.nickname.trim(),
      ageDescription: v.ageDescription.trim(), lastKnownDate: v.lastKnownDate || null, lastKnownArea: v.lastKnownArea.trim(),
      officialReference: v.officialReference.trim(), notes: v.notes.trim(), privacyAcknowledged: true, headshot,
    });
  }
  const busy = pending || uploading;
  return <form onSubmit={submit} noValidate aria-busy={busy} data-testid="form-case">
    <fieldset disabled={busy} className="min-w-0 space-y-6">
    {(error || uploadErr) && <ErrorBanner message={uploadErr || error || ''} />}
    <fieldset className="rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5">
      <legend className="px-2 font-data text-[10px] uppercase tracking-[.16em] text-[#9c6d4e]">Your role (self-declared)</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {roles.map((r) => <label key={r.v} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm ${v.responderRole === r.v ? 'border-[#385e51] bg-[#e9ede3]' : 'border-[#d8d1c2] bg-[#fbf9f3]'}`}>
          <input type="radio" name="role" checked={v.responderRole === r.v} onChange={() => set('responderRole', r.v)} data-testid={`radio-role-${r.v}`} className="accent-[#385e51]" />{r.l}
        </label>)}
      </div>
      <p className="mt-2 text-xs text-[#718078]">Roles are not verified.</p>
    </fieldset>
    <div className="grid gap-5 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-5 sm:grid-cols-2">
      <Field id="firstName" label="First name (required)" error={errs.firstName}><input id="firstName" data-testid="input-first-name" aria-required="true" aria-invalid={!!errs.firstName} maxLength={80} value={v.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls} autoComplete="off" /></Field>
      <Field id="lastName" label="Last name"><input id="lastName" data-testid="input-last-name" maxLength={80} value={v.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls} autoComplete="off" /></Field>
      <Field id="nickname" label="Nickname"><input id="nickname" data-testid="input-nickname" maxLength={80} value={v.nickname} onChange={(e) => set('nickname', e.target.value)} className={inputCls} /></Field>
      <Field id="ageDescription" label="Age or description" hint="For example, mid-teens. No date of birth."><input id="ageDescription" data-testid="input-age" maxLength={40} value={v.ageDescription} onChange={(e) => set('ageDescription', e.target.value)} className={inputCls} /></Field>
      <Field id="lastKnownDate" label="Last-known date" error={errs.lastKnownDate}><input id="lastKnownDate" data-testid="input-last-known-date" type="date" value={v.lastKnownDate} onChange={(e) => set('lastKnownDate', e.target.value)} className={inputCls} /></Field>
      <Field id="lastKnownArea" label="General area" hint="City or neighborhood only. Do not enter an exact address."><input id="lastKnownArea" data-testid="input-area" maxLength={160} value={v.lastKnownArea} onChange={(e) => set('lastKnownArea', e.target.value)} className={inputCls} /></Field>
      <details className="rounded-xl border border-[#d8d1c2] p-4 sm:col-span-2">
        <summary className="cursor-pointer text-sm font-semibold text-[#385e51]">More case details · optional</summary>
        <div className="mt-4 space-y-4">
          <Field id="officialReference" label="Official reference" hint="Report or case number from an agency, if any."><input id="officialReference" data-testid="input-official-reference" maxLength={120} value={v.officialReference} onChange={(e) => set('officialReference', e.target.value)} className={inputCls} /></Field>
          <Field id="notes" label="Private notes"><textarea id="notes" data-testid="input-notes" rows={4} maxLength={3000} value={v.notes} onChange={(e) => set('notes', e.target.value)} className={inputCls} /></Field>
        </div>
      </details>
      <div className="sm:col-span-2"><PhotoPicker id="headshot" label="Recent headshot (optional)" hint="JPEG, PNG or WebP, up to 25 MB. Reference only; never used for matching." file={file} existing={removed ? null : initialHeadshot} onChange={(f) => { const m = validatePhoto(f); if (m) { setUploadErr(m); return; } setUploadErr(''); setFile(f); setRemoved(false); }} onClear={() => { setFile(null); setRemoved(true); }} /></div>
    </div>
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] p-4 text-sm leading-6 text-[#344b42]">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} data-testid="checkbox-privacy" aria-describedby="ack-error" className="mt-1.5 h-4 w-4 accent-[#385e51]" />
        <span>I have permission to save these details and any headshot. I understand this is a private workspace, not an emergency service, and nothing here confirms any person's identity or location.</span>
      </label>
      {errs.ack && <p id="ack-error" role="alert" className="mt-1.5 text-xs font-medium text-[#a64e43]">{errs.ack}</p>}
    </div>
    <div className="flex flex-wrap justify-end gap-3">
      <button type="button" onClick={onCancel} disabled={busy} className={ghostBtn} data-testid="button-cancel-case">Cancel</button>
      <button type="submit" disabled={busy} className={primaryBtn} data-testid="button-save-case">{busy && <Loader2 size={15} className="animate-spin" />}{uploading ? 'Uploading photo' : pending ? 'Saving' : submitLabel}</button>
    </div>
    </fieldset>
  </form>;
}
