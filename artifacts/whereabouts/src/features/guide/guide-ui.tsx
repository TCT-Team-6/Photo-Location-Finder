import { createContext, useContext, useState, type ReactNode } from 'react';
import { Phone, ShieldAlert } from 'lucide-react';
import { DISCLAIMER } from '@/lib/urgency';
import { SAMPLE_LABEL } from '@/lib/guide-state';

/** In-memory draft only. Never written to localStorage or sessionStorage. */
type Draft = { text: string; file: File | null };
type DraftCtx = { draft: Draft; setDraft: (d: Draft) => void; clear: () => void; notice: string; setNotice: (n: string) => void; reset: () => void };
const DraftContext = createContext<DraftCtx>({ draft: { text: '', file: null }, setDraft: () => {}, clear: () => {}, notice: '', setNotice: () => {}, reset: () => {} });

export function GuideDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({ text: '', file: null });
  const [notice, setNotice] = useState('');
  const clear = () => setDraft({ text: '', file: null });
  return <DraftContext.Provider value={{ draft, setDraft, clear, notice, setNotice, reset: () => { clear(); setNotice(''); } }}>{children}</DraftContext.Provider>;
}
export function useGuideDraft() { return useContext(DraftContext); }

export const tapBtn = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
export const guidePrimary = `${tapBtn} bg-[#385e51] text-[#f4f0e6] hover:bg-[#2e5044]`;
export const guideGhost = `${tapBtn} border border-[#d8d1c2] bg-[#fbf9f3] text-[#385e51] hover:bg-[#e8e4d8]`;

export function SampleLabel({ className = '' }: { className?: string }) {
  return <p className={`inline-flex items-center gap-2 rounded-full border border-[#dfbfa9] bg-[#f5e8dc] px-3 py-1.5 font-data text-[10px] uppercase tracking-[.14em] text-[#874d34] ${className}`} data-testid="label-sample-case"><span className="h-1.5 w-1.5 rounded-full bg-[#c8794d]" aria-hidden="true" />{SAMPLE_LABEL}</p>;
}

export function EmergencyBar({ urgent = false, sample = false }: { urgent?: boolean; sample?: boolean }) {
  return <aside className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${urgent ? 'border-[#d9a596] bg-[#fbefeb]' : 'border-[#d8d1c2] bg-[#f8f5ec]'}`} data-testid="notice-emergency">
    <ShieldAlert size={20} className={`shrink-0 ${urgent ? 'text-[#a64e43]' : 'text-[#9c6d4e]'}`} aria-hidden="true" />
    <p className="flex-1 text-sm leading-6 text-[#344b42]"><strong className="font-semibold">If someone may be in danger, call 911 first.</strong> {sample ? 'In this fictional sample, the button only simulates the call.' : 'This guide organizes facts for responders. It is not an emergency service.'}</p>
    {sample ? <SimulatedCallButton /> : <a href="tel:911" className={`${tapBtn} shrink-0 bg-[#a64e43] text-[#fbf9f3] hover:bg-[#8f4037]`} data-testid="link-call-911"><Phone size={16} />Call 911</a>}
  </aside>;
}

export function Disclaimer() {
  return <p className="text-xs leading-5 text-[#718078]" data-testid="text-disclaimer">{DISCLAIMER} Facts here are user-reported and unverified. Whereabouts never confirms where a person is.</p>;
}

/** Fictional demos never dial. Tapping shows an explicit sample confirmation. */
export function SimulatedCallButton({ className = '' }: { className?: string }) {
  const [done, setDone] = useState(false);
  return <div className={`flex shrink-0 flex-col items-start gap-1 ${className}`}>
    <button type="button" onClick={() => setDone(true)} className={`${tapBtn} bg-[#a64e43] text-[#fbf9f3] hover:bg-[#8f4037]`} data-testid="button-simulate-call-911"><Phone size={16} />Call 911 (simulated)</button>
    {done && <p role="status" className="text-xs font-semibold text-[#8f4037]" data-testid="status-simulated-call">Simulated only. {SAMPLE_LABEL}. No call was placed. In a real emergency, dial 911 yourself.</p>}
  </div>;
}
