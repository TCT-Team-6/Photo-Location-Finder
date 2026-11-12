import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMissingPersonCaseQueryKey, getListMissingPersonCasesQueryKey, useGuideIntake } from '@workspace/api-client-react';
import type { MissingPersonCase } from '@workspace/api-client-react';
import { factRows } from '@/lib/guide-state';
import { ErrorBanner, errorMessage, inputCls } from '@/features/cases/shared';
import { guideGhost } from './guide-ui';

const mapped = new Set(['lastSeenPlace']);

/** Additive panel on case detail: resume link, guide-only facts, corrections, log. */
export function CaseGuidePanel({ c }: { c: MissingPersonCase }) {
  const g = c.guide;
  const qc = useQueryClient();
  const note = useGuideIntake();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  if (!g) return <Link href={`/guide/${c.id}`} className="mt-4 flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4 text-sm font-semibold text-[#385e51]" data-testid="link-start-guide"><span className="flex items-center gap-2"><Sparkles size={15} />Start the AI Guide for this case</span><ArrowRight size={16} /></Link>;

  async function correct() {
    if (!g || !text.trim()) return;
    setErr('');
    try {
      const next = await note.mutateAsync({ data: { caseId: c.id, text: `Correction: ${text.trim()}`, revision: g.revision } });
      qc.setQueryData<MissingPersonCase>(getGetMissingPersonCaseQueryKey(c.id), (old) => (old ? { ...old, guide: next } : old));
      qc.invalidateQueries({ queryKey: getGetMissingPersonCaseQueryKey(c.id) });
      qc.invalidateQueries({ queryKey: getListMissingPersonCasesQueryKey() });
      setText('');
    } catch (e) { setErr(errorMessage(e)); qc.invalidateQueries({ queryKey: getGetMissingPersonCaseQueryKey(c.id) }); }
  }
  const rows = factRows(g.facts).filter((r) => !mapped.has(r.key));
  return <section className="mt-6 rounded-2xl border border-[#d8d1c2] bg-[#f8f5ec] p-4 sm:p-5" aria-labelledby="case-guide-h" data-testid="panel-case-guide">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="case-guide-h" className="flex items-center gap-2 font-editorial text-2xl"><Sparkles size={17} className="text-[#c8794d]" />AI Guide facts</h2>
      <Link href={`/guide/${c.id}`} className={guideGhost} data-testid="link-resume-guide">Resume AI Guide <ArrowRight size={15} /></Link>
    </div>
    <p className="mt-1 text-xs text-[#718078]">User-reported and unverified. Area and date also appear above in the regular fields. Status: {g.gate === 'blocked' ? 'stopped by safety check' : g.question ? `waiting for an answer: ${g.question}` : 'ready for a responder summary'}.</p>
    <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{rows.map((r) => <div key={r.key} data-testid={`case-fact-${r.key}`}><dt className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">{r.label}</dt><dd className={r.known ? '' : 'italic text-[#89948a]'}>{r.value}</dd></div>)}</dl>
    {g.gate !== 'blocked' && <div className="mt-4"><label htmlFor="guide-correction" className="mb-1 block text-xs font-semibold text-[#344b42]">Correct or add a guide fact</label>
      <div className="flex gap-2"><input id="guide-correction" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="For example: he was wearing a blue coat" className={`${inputCls} min-h-11`} data-testid="input-guide-correction" />
        <button type="button" onClick={correct} disabled={note.isPending || !text.trim()} className={guideGhost} data-testid="button-guide-correction">{note.isPending && <Loader2 size={14} className="animate-spin" />}Save</button></div>
      {err && <div className="mt-2"><ErrorBanner message={err} /></div>}</div>}
    <details className="mt-4"><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[#385e51]">Guide log ({g.log.length})</summary>
      <ol className="mt-2 space-y-2" data-testid="list-case-guide-log">{g.log.map((l, i) => <li key={i} className="border-l-2 border-[#d8d1c2] pl-3 text-xs leading-5"><span className="font-data text-[9px] uppercase tracking-[.14em] text-[#9c6d4e]">{l.role === 'user' ? 'You' : l.role === 'note' ? 'Note' : 'AI Guide'} · {new Date(l.at).toLocaleString()}</span><p className="whitespace-pre-wrap text-[#344b42]">{l.text}</p></li>)}</ol>
    </details>
  </section>;
}
