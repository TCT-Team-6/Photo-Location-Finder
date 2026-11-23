import { useState } from 'react';
import { Copy, Download, Printer, Share2 } from 'lucide-react';
import { SAMPLE_LABEL } from '@/lib/guide-state';
import { guideGhost } from './guide-ui';

/** Report preview. Every external action requires a tap; nothing is sent automatically. */
export function ResponderSummary({ text, filename, sample = false }: { text: string; filename: string; sample?: boolean }) {
  const [status, setStatus] = useState('');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  async function copy() {
    try { await navigator.clipboard.writeText(text); setStatus('Copied to clipboard.'); }
    catch { setStatus('Copy is blocked here. Select the text above and copy it manually.'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Downloaded as a text file.');
  }
  async function share() {
    if (!canShare) { await copy(); return; }
    try { await navigator.share({ title: 'Responder summary', text }); setStatus('Share sheet opened.'); }
    catch { setStatus('Sharing was cancelled.'); }
  }
  function print() {
    document.body.classList.add('guide-printing');
    const done = () => { document.body.classList.remove('guide-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    window.setTimeout(done, 1500);
  }
  return <section className="rounded-2xl border border-[#d8d1c2] bg-[#fbf9f3] p-4 sm:p-5" aria-labelledby="summary-h" data-testid="panel-responder-summary">
    <h3 id="summary-h" className="font-editorial text-2xl">Responder summary preview</h3>
    <p className="mt-1 text-[13px] text-[#718078]">User-reported, unverified. Unknown facts are marked Unknown. Nothing is shared until you choose an option below.</p>
    <div className="guide-print mt-3">
      {sample && <p className="mb-2 font-data text-[13px] uppercase tracking-[.14em] text-[#874d34]">{SAMPLE_LABEL}</p>}
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f4f0e6] p-4 font-data text-[13px] leading-5 text-[#263d36]" data-testid="text-responder-summary">{text}</pre>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <button type="button" onClick={share} className={guideGhost} data-testid="button-summary-share"><Share2 size={15} />{canShare ? 'Share' : 'Share (copy)'}</button>
      <button type="button" onClick={copy} className={guideGhost} data-testid="button-summary-copy"><Copy size={15} />Copy</button>
      <button type="button" onClick={download} className={guideGhost} data-testid="button-summary-download"><Download size={15} />Download</button>
      <button type="button" onClick={print} className={guideGhost} data-testid="button-summary-print"><Printer size={15} />Print</button>
    </div>
    <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[13px] text-[#385e51]" data-testid="status-summary-action">{status}</p>
  </section>;
}
