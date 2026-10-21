import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { useRequestUploadUrl } from '@workspace/api-client-react';
import type { CasePhoto } from '@workspace/api-client-react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';

export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const inputCls = 'w-full rounded-xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 py-3 text-sm text-[#263d36] outline-none transition placeholder:text-[#89948a] focus:border-[#668675] focus:ring-4 focus:ring-[#385e51]/10';
export const primaryBtn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#385e51] px-6 text-sm font-semibold text-[#f4f0e6] transition hover:bg-[#2e5044] disabled:cursor-not-allowed disabled:opacity-50';
export const ghostBtn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#d8d1c2] bg-[#fbf9f3] px-5 text-sm font-semibold text-[#385e51] transition hover:bg-[#e8e4d8] disabled:opacity-50';

export function newId() {
  return crypto.randomUUID();
}
export function photoUrl(p: CasePhoto) {
  return `/api/storage${p.objectPath}`;
}
export function errorMessage(e: unknown) {
  if (e && typeof e === 'object') {
    const v = e as { data?: { error?: string }; message?: string };
    if (v.data?.error) return v.data.error;
    if (v.message) return v.message;
  }
  return 'Something went wrong. Your entries are kept — please try again.';
}
export function validatePhoto(f: File): string | null {
  if (!(TYPES as readonly string[]).includes(f.type)) return 'Use a JPEG, PNG or WebP image.';
  if (f.size > MAX_PHOTO_BYTES) return 'Photos must be 25 MB or smaller.';
  if (f.size < 1) return 'That file is empty.';
  return null;
}

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: ReactNode; id: string }) {
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-[#344b42]">{label}</label>
    {children}
    {hint && !error && <p className="mt-1.5 text-xs text-[#718078]">{hint}</p>}
    {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-[#a64e43]">{error}</p>}
  </div>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#dbb6a8] bg-[#fbefeb] p-4 text-sm text-[#a64e43]">
    <AlertTriangle size={16} className="mt-0.5 shrink-0" /><p className="flex-1">{message}</p>
    {onRetry && <button type="button" onClick={onRetry} className="font-semibold underline">Retry</button>}
  </div>;
}

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  return <aside className="rounded-2xl border border-[#d8d1c2] bg-[#e9ede3] p-5" data-testid="notice-privacy">
    <p className="flex items-center gap-2 font-data text-[10px] uppercase tracking-[.16em] text-[#385e51]"><ShieldCheck size={14} />Private workspace</p>
    <ul className="mt-3 space-y-2 text-xs leading-5 text-[#465c50]">
      <li>This is not an emergency service. If someone is in danger or missing, contact your local emergency number or police first.</li>
      <li>Only you can see your cases, leads and photos. Nothing is shared or published.</li>
      {!compact && <>
        <li>Names and roles are self-declared and are not verified.</li>
        <li>Whereabouts does not search social media, crawl links, match faces, analyze images automatically, or claim any person's identity or location.</li>
        <li>A headshot is a reference for you only. Review labels record your assessment; they do not independently verify a lead.</li>
      </>}
    </ul>
  </aside>;
}

export function ConfirmDialog({ title, body, confirmLabel, busy, error, onConfirm, onCancel }: { title: string; body: string; confirmLabel: string; busy: boolean; error?: string; onConfirm: () => void; onCancel: () => void }) {
  return <AlertDialog open onOpenChange={(open) => { if (!open && !busy) onCancel(); }}>
    <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl border-[#d8d1c2] bg-[#fbf9f3] p-6">
      <AlertDialogTitle className="font-editorial text-2xl font-normal text-[#263d36]">{title}</AlertDialogTitle>
      <AlertDialogDescription className="mt-2 text-sm leading-6 text-[#718078]">{body}</AlertDialogDescription>
      {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
      <div className="mt-6 flex justify-end gap-3">
        <AlertDialogCancel disabled={busy} className={ghostBtn} data-testid="button-confirm-cancel">Keep it</AlertDialogCancel>
        <button type="button" onClick={onConfirm} disabled={busy} data-testid="button-confirm-delete" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#a64e43] px-6 text-sm font-semibold text-[#fbf9f3] hover:bg-[#8f4037] disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />}{confirmLabel}</button>
      </div>
    </AlertDialogContent>
  </AlertDialog>;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} aria-hidden="true" />;
}

/** Object-URL preview with cleanup. */
export function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

/** Signed URL request, then direct PUT. Caches by file so retries don't re-upload. */
export function useCasePhotoUpload() {
  const req = useRequestUploadUrl();
  const reqFn = useRef(req.mutateAsync);
  reqFn.current = req.mutateAsync;
  const cache = useRef<{ file: File; photo: CasePhoto } | null>(null);
  async function upload(file: File): Promise<CasePhoto> {
    if (cache.current?.file === file) return cache.current.photo;
    const contentType = file.type as CasePhoto['contentType'];
    const r = await reqFn.current({ data: { name: file.name.slice(0, 255), size: file.size, contentType } });
    const put = await fetch(r.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!put.ok) throw new Error('The photo could not be uploaded. Please try again.');
    const photo: CasePhoto = { objectPath: r.objectPath, originalName: file.name.slice(0, 255), contentType };
    cache.current = { file, photo };
    return photo;
  }
  return { upload, reset: () => { cache.current = null; } };
}

export function PhotoPicker({ id, label, hint, file, existing, onChange, onClear, error }: { id: string; label: string; hint: string; file: File | null; existing?: CasePhoto | null; onChange: (f: File) => void; onClear: () => void; error?: string }) {
  const preview = useObjectUrl(file);
  const src = preview ?? (existing ? photoUrl(existing) : null);
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-[#344b42]">{label}</label>
    <div className="flex items-center gap-4 rounded-xl border border-dashed border-[#b9c4b5] bg-[#e8e9df] p-3">
      {src ? <img src={src} alt="Selected reference" className="h-20 w-20 rounded-lg object-cover" /> : <div className="grid h-20 w-20 place-items-center rounded-lg bg-[#fbf9f3] font-data text-[9px] uppercase text-[#718078]">None</div>}
      <div className="min-w-0 flex-1">
        <input id={id} data-testid={`input-${id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ''; }} className="block w-full text-xs text-[#44556d] file:mr-3 file:rounded-full file:border-0 file:bg-[#385e51] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-[#f4f0e6]" />
        <p className="mt-1.5 text-xs text-[#718078]">{file ? file.name : hint}</p>
        {src && <button type="button" onClick={onClear} className="mt-1 text-xs font-semibold text-[#a64e43] underline">Remove</button>}
      </div>
    </div>
    {error && <p role="alert" className="mt-1.5 text-xs font-medium text-[#a64e43]">{error}</p>}
  </div>;
}
