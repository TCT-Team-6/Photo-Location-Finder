import { useEffect, useRef } from 'react';
import { ScanSearch } from 'lucide-react';
import type { ChatMessage } from '@/lib/guide-state';

const roleName = { user: 'You', assistant: 'AI Guide', gate: 'AI Guide', note: 'Saved note' } as const;

export function GuideChat({ messages, pending = false }: { messages: ChatMessage[]; pending?: boolean }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [messages.length, pending]);
  const lastAi = [...messages].reverse().find((m) => m.role === 'assistant' || m.role === 'gate');
  const older = messages.filter((m) => m !== lastAi);
  const renderMsg = (m: ChatMessage, live: boolean) => {
    const ai = m.role === 'assistant' || m.role === 'gate';
    if (m.role === 'note') return <li key={m.id} className="mx-auto max-w-[90%] rounded-xl border border-dashed border-[#c9c2b3] px-4 py-2 text-xs text-[#62756c]" data-testid={`chat-note-${m.id}`}><span className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">Saved note · </span>{m.text}</li>;
    return <li key={m.id} className={`flex ${ai ? 'justify-start' : 'justify-end'}`} data-testid={`chat-${m.role}-${m.id}`}>
      <div role={ai ? 'article' : undefined} aria-label={ai ? 'AI Guide' : undefined} className={`max-w-[88%] rounded-2xl px-4 py-3 text-[15px] leading-6 ${ai ? `rounded-tl-sm border ${m.role === 'gate' ? 'border-[#dfbfa9] bg-[#f5e8dc]' : 'border-[#d8d1c2] bg-[#fbf9f3]'} text-[#263d36]` : 'rounded-tr-sm bg-[#385e51] text-[#f4f0e6]'}`}>
        <p className={`mb-1 flex items-center gap-1.5 font-data text-[9px] uppercase tracking-[.16em] ${ai ? 'text-[#9c6d4e]' : 'text-[#c9d6cb]'}`}>{ai && <ScanSearch size={11} aria-hidden="true" />}{roleName[m.role]}{live && <span className="sr-only">, newest message</span>}</p>
        <p className="whitespace-pre-wrap">{m.text}</p>
      </div>
    </li>;
  };
  return <div className="wa-guide-chat">
    <ol className="space-y-3" aria-label="Conversation with the AI Guide">{older.map((m) => renderMsg(m, false))}</ol>
    <div aria-live="polite" aria-atomic="true" className="mt-3" data-testid="region-guide-latest">
      {lastAi && <ol>{renderMsg(lastAi, true)}</ol>}
      {pending && <p className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[#d8d1c2] bg-[#fbf9f3] px-4 py-3 text-sm text-[#718078]" aria-label="AI Guide is reading your message"><span className="guide-dots" aria-hidden="true"><i /><i /><i /></span>Reading what you wrote</p>}
    </div>
    <div ref={end} />
  </div>;
}

export function ReplyChips({ options, onPick, disabled }: { options: string[]; onPick: (v: string) => void; disabled?: boolean }) {
  return <div className="flex flex-wrap gap-2" role="group" aria-label="Quick replies">
    {options.map((o) => <button key={o} type="button" disabled={disabled} onClick={() => onPick(o)} data-testid={`button-reply-${o.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="inline-flex min-h-11 items-center rounded-full border border-[#385e51] bg-[#fbf9f3] px-5 text-sm font-semibold text-[#385e51] transition hover:bg-[#e9ede3] disabled:opacity-50">{o}</button>)}
  </div>;
}
