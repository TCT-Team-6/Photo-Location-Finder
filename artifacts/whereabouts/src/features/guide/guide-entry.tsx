import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Lock, Mic, MicOff, Paperclip, X } from 'lucide-react';
import { guideExamples } from '@/lib/guide-state';
import { validatePhoto } from '@/features/cases/shared';
import { guideGhost, guidePrimary, useGuideDraft } from './guide-ui';
import { DeskHeadline } from '@/components/field-desk';
import { createPromptTypewriter } from '@/lib/prompt-typewriter';

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
function speechCtor(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechInput(onText: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText); cb.current = onText;
  const supported = !!speechCtor();
  useEffect(() => () => rec.current?.stop(), []);
  function toggle() {
    const C = speechCtor();
    if (!C) { setError('Voice input is not available in this browser. Please type instead.'); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new C();
    r.lang = navigator.language || 'en-US'; r.interimResults = false; r.continuous = false;
    r.onresult = (e) => { const t = Array.from(e.results).map((x) => x[0]?.transcript ?? '').join(' ').trim(); if (t) cb.current(t); };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setError('We could not hear that. Please try again or type instead.'); };
    rec.current = r; setError(''); setListening(true);
    try { r.start(); } catch { setListening(false); setError('Voice input could not start. Please type instead.'); }
  }
  return { listening, supported, error, toggle };
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function GuideEntry({ signedIn, tone = 'light' }: { signedIn: boolean; tone?: 'light' | 'panel' }) {
  const { draft, setDraft } = useGuideDraft();
  const [text, setText] = useState(draft.text);
  const [file, setFile] = useState<File | null>(draft.file);
  const [err, setErr] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [, nav] = useLocation();
  const writer=useRef<ReturnType<typeof createPromptTypewriter>|null>(null);
  if(!writer.current)writer.current=createPromptTypewriter(setText);
  const flights=useRef<HTMLElement[]>([]);
  useEffect(()=>()=>{writer.current?.stop();flights.current.forEach(node=>node.remove());},[]);
  const speech = useSpeechInput((t) => {writer.current?.stop();setText((p) => (p ? `${p} ${t}` : t));});
  const fileRef = useRef<HTMLInputElement>(null);

  function go() {
    writer.current?.stop();
    if (!text.trim()) { setErr('Tell us a little about what happened first.'); return; }
    setErr('');
    setDraft({ text: text.trim(), file });
    if (signedIn) nav('/guide'); else setNeedsSignIn(true);
  }
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(`${window.location.origin}${basePath}/guide`)}`;

  return <section className={`wa-guide-entry border border-[#d8d1c2] ${tone === 'panel' ? 'bg-[#fbf9f3]' : 'bg-[#f8f5ec]/95'} p-4 sm:p-7`} aria-labelledby="guide-entry-h" data-testid="panel-guide-entry">
    <p className="wa-eyebrow mb-4">Private evidence organization / AI Guide</p>
    <label id="guide-entry-h" htmlFor="guide-entry-text" className="block font-editorial text-3xl tracking-[-.03em] text-[#263d36] sm:text-4xl"><DeskHeadline as="span">Tell us what happened.</DeskHeadline></label>
    <p className="mt-1 text-sm text-[#62756c]">In your own words. The AI Guide asks only what is missing, then helps you prepare a summary for responders.</p>
    <div className="mt-4 rounded-2xl border border-[#d8d1c2] bg-[#fbf9f3] focus-within:border-[#668675] focus-within:ring-4 focus-within:ring-[#385e51]/10">
      <textarea id="guide-entry-text" aria-label="Tell us what happened." data-testid="input-guide-entry" rows={4} maxLength={6000} value={text} onBeforeInput={()=>writer.current?.stop()} onCompositionStart={()=>writer.current?.stop()} onPaste={()=>writer.current?.stop()} onKeyDown={event=>{if(event.key.length===1||event.key==='Backspace'||event.key==='Delete')writer.current?.stop();}} onChange={(e) => {writer.current?.stop();setText(e.target.value);}} placeholder="For example: my dad has dementia and left the house around 3 PM..." className="block w-full resize-none rounded-t-2xl bg-transparent px-4 py-3 text-base leading-7 text-[#263d36] outline-none placeholder:text-[#89948a]" />
      <div className="flex flex-wrap items-center gap-2 border-t border-[#e1dbce] px-2 py-2">
        <button type="button" onClick={speech.toggle} aria-pressed={speech.listening} data-testid="button-guide-voice" className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold ${speech.listening ? 'bg-[#a64e43] text-[#fbf9f3]' : 'text-[#385e51] hover:bg-[#e8e4d8]'}`} aria-label={speech.listening ? 'Stop voice input' : 'Speak instead of typing'}>{speech.listening ? <MicOff size={18} /> : <Mic size={18} />}<span className="hidden sm:inline">{speech.listening ? 'Listening' : 'Speak'}</span></button>
        <button type="button" onClick={() => fileRef.current?.click()} data-testid="button-guide-attach" className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold text-[#385e51] hover:bg-[#e8e4d8]" aria-label="Attach the last photo (optional)"><Paperclip size={18} /><span className="hidden sm:inline">Last photo</span></button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} data-testid="input-guide-photo" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const m = validatePhoto(f); if (m) { setErr(m); return; } setErr(''); setFile(f); }} />
        {file && <span className="inline-flex min-h-11 max-w-[220px] items-center gap-1 rounded-full bg-[#e9ede3] pl-3 text-xs text-[#385e51]" data-testid="text-guide-attachment"><span className="truncate">{file.name}</span><button type="button" onClick={() => setFile(null)} className="grid h-11 w-11 place-items-center" aria-label="Remove photo" data-testid="button-guide-remove-photo"><X size={14} /></button></span>}
        <button type="button" onClick={go} className={`${guidePrimary} ml-auto`} data-testid="button-guide-start">Continue <ArrowRight size={16} /></button>
      </div>
    </div>
    {!speech.supported && <p className="mt-2 text-xs text-[#718078]">Voice input is not available in this browser. Typing works everywhere.</p>}
    {(err || speech.error) && <p role="alert" className="mt-2 text-xs font-medium text-[#a64e43]">{err || speech.error}</p>}
    <div className="fd-example-grid mt-4" aria-label="Examples">
      {guideExamples.map((ex, i) => <button key={ex} type="button" data-card-number={`PROMPT / ${String(i+1).padStart(2,'0')}`} data-cursor-crop="" onClick={event=>{
        const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        if(!reduced){const from=event.currentTarget.getBoundingClientRect(),to=document.getElementById('guide-entry-text')!.getBoundingClientRect(),clone=event.currentTarget.cloneNode(true) as HTMLButtonElement;clone.removeAttribute('data-testid');clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;clone.style.cssText=`position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;pointer-events:none;z-index:9000;`;document.body.appendChild(clone);flights.current.push(clone);const animation=clone.animate([{transform:'translate(0,0)',opacity:1},{transform:`translate(${to.left-from.left+25}px,${to.top-from.top+16}px) scale(.7)`,opacity:0}],{duration:200,easing:'ease-in'});animation.onfinish=()=>{clone.remove();flights.current=flights.current.filter(node=>node!==clone);};}
        writer.current?.start(ex,reduced);document.getElementById('guide-entry-text')?.focus({preventScroll:true});
      }} data-testid={`button-guide-example-${i}`} className="fd-example-card min-h-11 text-left text-xs leading-5">{ex}</button>)}
    </div>
    {needsSignIn && <div className="mt-5 rounded-2xl border border-[#bdcbbd] bg-[#e9ede3] p-4" role="status" data-testid="panel-guide-sign-in-first">
      <p className="flex items-center gap-2 text-sm font-semibold text-[#263d36]"><Lock size={15} />Sign in first to keep this private.</p>
      <p className="mt-1 text-xs leading-5 text-[#465c50]">Your words and photo stay in this browser tab's memory only; they are not saved until you sign in and agree. If the page reloads during sign-in, you may need to type them again.</p>
      <div className="mt-3 flex flex-wrap gap-2"><Link href={signInHref} className={guidePrimary} data-testid="link-guide-sign-in">Sign in and continue</Link><Link href="/guide-demo/joe" className={guideGhost} data-testid="link-guide-try-sample">Try a sample instead</Link></div>
    </div>}
    <Link href={signedIn ? '/cases/new' : '/sign-in'} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#385e51] underline underline-offset-4" data-testid="link-guide-regular-form">Use the regular form instead.</Link>
  </section>;
}
