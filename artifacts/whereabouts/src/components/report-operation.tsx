import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { emptyReport, realStageStates, type ReportState } from '@/lib/report-lifecycle';
import { PhysicalView } from './physical-workspace';
import { paintRgbLoupe } from '@/lib/report-pixels';

type Operation = {
  state: ReportState; begin: (title: string, total: number, file?: File) => void;
  item: (file: File, index?: number) => void; phase: (phase: 'uploading' | 'analyzing') => void;
  complete: (destination: string) => void; fail: (message: string) => void;
  show: () => void; hide: () => void; stop: () => void; stopped: () => boolean;
  signal: () => AbortSignal; setRetry: (retry: () => void) => void;
  reset: () => void;
  settled: () => void;
};
const Context = createContext<Operation | null>(null);
export function useReportOperation() { const context = useContext(Context); if (!context) throw Error('Report operation provider missing'); return context; }
export function ReportOperationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(emptyReport), stateRef = useRef(state); stateRef.current = state;
  const abort = useRef(new AbortController()), stopRequested = useRef(false), retry = useRef<() => void>(() => {});
  const generation=useRef(0),scope=generation.current;
  const update = (patch: Partial<ReportState>, message?: string) => {if(scope!==generation.current)return;setState(old => ({ ...old, ...patch, events: message ? [...old.events, { at: Date.now(), message }] : old.events }));};
  const operation: Operation = {
    state,
    begin: (title, total, file) => {
      abort.current = new AbortController(); stopRequested.current = false;
      setState({ ...emptyReport, open: true, phase: 'uploading',settling:true, title: title.trim() || 'Untitled (uses file names)', total, file: file ?? null, startedAt: Date.now(), index: 1, events: [{ at: Date.now(), message: 'Investigation started in this browser.' }] });
    },
    item: (file, index) => update({ file, index: index ?? stateRef.current.index, phase: 'uploading' }, `Selected media: ${file.name}`),
    phase: phase => {
      if (stateRef.current.phase === phase) return;
      update({ phase, ...(phase === 'analyzing' ? { accepted: true } : {}) }, phase === 'uploading' ? 'Uploading media.' : 'Media transferred. Analysis request in progress; internal substages unavailable.');
    },
    complete: destination => {
      if (stopRequested.current) { update({ phase: 'stopped' }, 'Queue stopped. Any accepted server analysis may continue.'); return; }
      update({ phase: 'completed', destination, error: '',settling:false }, 'All selected reports are complete and saved.');
    },
    fail: message => update({ phase: stopRequested.current ? 'stopped' : 'error', error: message,settling:false,errorStage:stateRef.current.phase==='uploading'?0:1 }, message),
    show: () => update({ open: true }), hide: () => update({ open: false }),
    stop: () => { stopRequested.current = true; abort.current.abort(); update({ phase: 'stopped', error: '' }, 'Browser transfers aborted and unstarted queue work stopped. Already accepted server analysis cannot be stopped.'); },
    stopped: () => scope!==generation.current||stopRequested.current, signal: () => scope!==generation.current?AbortSignal.abort():abort.current.signal,
    setRetry: callback => { retry.current = callback; },
    reset:()=>{generation.current++;stopRequested.current=true;abort.current.abort();setState(emptyReport);retry.current=()=>{};},
    settled:()=>update({settling:false}),
  };
  return <Context.Provider value={operation}>{children}<ReportSheet onRetry={() => retry.current()} /></Context.Provider>;
}
export function ReportChip() {
  const op = useReportOperation(), { phase } = op.state;
  if (phase === 'idle') return null;
  const label = phase === 'completed' ? 'FILED · OPEN REPORT' : phase === 'error' ? 'REPORT NEEDS ATTENTION' : phase === 'stopped' ? 'QUEUE STOPPED' : `ANALYZING · ${phase === 'uploading' ? '01' : '02'}/05`;
  return <button type="button" className="report-chip" data-testid="button-report-progress" onClick={op.show}>{label}</button>;
}
function ReportSheet({ onRetry }: { onRetry: () => void }) {
  const op = useReportOperation(), { state } = op, [, navigate] = useLocation();
  const root = useRef<HTMLDivElement>(null), list = useRef<HTMLOListElement>(null), [now, setNow] = useState(Date.now()), [confirm, setConfirm] = useState(false);
  const [src, setSrc] = useState(''), callbacks = useRef({ hide: op.hide, navigate }); callbacks.current = { hide: op.hide, navigate };
  useEffect(() => {
    if (!state.file) { setSrc(''); return; }
    const url = URL.createObjectURL(state.file); setSrc(url); return () => URL.revokeObjectURL(url);
  }, [state.file]);
  useEffect(() => { if (!state.open) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [state.open]);
  useEffect(() => {
    if (!state.open) return;
    setConfirm(false);
    const previous = document.activeElement as HTMLElement | null;
    const siblings = Array.from(document.querySelectorAll<HTMLElement>('[data-report-background]'));
    siblings.forEach(n => { n.inert = true; });
    list.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); callbacks.current.hide(); }
      if (e.key !== 'Tab') return;
      const focusable = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),video[controls],[tabindex="0"]') ?? []).filter(n => n.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === list.current)) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === list.current)) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); siblings.forEach(n => { n.inert = false; }); if (previous?.isConnected) previous.focus({ preventScroll: true }); if(document.activeElement===document.body)Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="button-report-progress"]')).find(n=>n.getClientRects().length)?.focus({preventScroll:true}); };
  }, [state.open]);
  const destination = state.destination;
  useEffect(() => {
    if (state.phase !== 'completed' || !state.open || !destination) return;
    const timer = setTimeout(() => { callbacks.current.hide(); callbacks.current.navigate(destination); }, 2000);
    return () => clearTimeout(timer);
  }, [state.phase, state.open, destination]);
  if (!state.open) return null;
  const elapsed = Math.max(0, Math.floor((now - state.startedAt) / 1000));
  const stages = realStageStates(state.phase), errorIndex = state.errorStage;
  const running = state.phase === 'uploading' || state.phase === 'analyzing';
  const themeRoot = document.querySelector('[data-app-theme]');
  return createPortal(<div className="physical-progress-backdrop" data-app-theme={themeRoot?.getAttribute('data-app-theme') ?? 'rescue'} data-high-contrast={themeRoot?.getAttribute('data-high-contrast') ?? 'false'}>
    <div ref={root} role="dialog" aria-modal="true" aria-labelledby="report-title" className="physical-progress" data-testid="panel-report-sheet">
      <header><div><p className="font-data text-[10px] tracking-[.14em]">FIELD REPORT / {state.phase === 'completed' ? 'FILED' : state.phase === 'error' ? 'NEEDS ATTENTION' : state.phase === 'stopped' ? 'QUEUE STOPPED' : 'IN PROGRESS'}</p><h2 id="report-title">{state.title}</h2></div><time aria-label={`${elapsed} seconds elapsed`}>{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</time></header>
      <div className="report-grid">
        <div><div className="report-print" key={src}>{src ? state.file?.type.startsWith('video/') ? <video src={src} controls preload="metadata" aria-label="Selected video" /> : <img src={src} alt="Current selected photograph" /> : <p className="font-data text-xs">Selected media is retained in your intake.</p>}
          {running && src && !state.file?.type.startsWith('video/') && <DecorativeScan src={src} />}
          {state.phase === 'completed' && <div className="report-stamp">FILED</div>}
        </div><p className="report-disclosure">INSTRUMENT SCAN IS DECORATION ONLY. It does not show live analysis.</p></div>
        <div><p className="font-data text-[10px]">PHOTO {state.index} OF {state.total}</p>
          <ol ref={list} tabIndex={-1} className="report-stage-list" aria-label="Real pipeline progress">
            {['UPLOAD', 'READ SCENE', 'COMPARE CLUES', 'RANK FINDINGS', 'SAVE REPORT'].map((label, i) => <li key={label} data-state={state.phase === 'error' && i === errorIndex ? 'error' : stages[i]} aria-current={stages[i] === 'running' ? 'step' : undefined}><span className="report-stage-symbol">{state.phase === 'error' && i === errorIndex ? '×' : stages[i] === 'done' ? <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true"><path className="report-drawn-check" d="m3 10 4 4L17 4" fill="none" stroke="currentColor" strokeWidth="1.8" pathLength="1"/></svg> : stages[i] === 'running' ? '●' : String(i + 1).padStart(2, '0')}</span>{label}</li>)}
          </ol>
          <p className="report-disclosure">ESTIMATED — NOT LIVE PROGRESS<br />Only upload, analysis, and completion events are available. Internal compare, rank, and save stages are not reported.</p>
          <p aria-live="polite" className="report-disclosure" data-testid="status-report-event">{state.events.at(-1)?.message}</p>
          {(state.phase === 'error' || state.phase === 'stopped') && <p role="alert" className="mt-4 text-xs leading-6">{state.error || 'Browser transfer and unstarted queue work stopped.'} Your files and form details remain selected. Already accepted server analysis cannot be stopped; saved records remain in your library.</p>}
        </div>
      </div>
      <div className="report-actions">
        {state.phase === 'completed' ? <button type="button" className="report-primary" onClick={() => { op.hide(); navigate(state.destination); }} data-testid="button-open-report">Open report →</button> : running ? <><button type="button" onClick={op.hide} data-testid="button-report-background">Run in background</button><button type="button" onClick={() => setConfirm(true)} data-testid="button-report-cancel">Cancel</button></> : <><button type="button" className="report-primary" onClick={onRetry} disabled={state.settling} data-testid="button-report-retry">Try again</button><button type="button" onClick={op.hide} data-testid="button-report-close">Close</button></>}
      </div>
      {state.phase==='stopped'&&state.settling&&<p className="report-disclosure">Waiting for the in-flight request to settle before retrying. Already accepted server analysis cannot be stopped.</p>}
      {confirm && <div className="report-confirm" role="alertdialog" aria-label="Stop this analysis?"><h3 className="font-data text-sm">Stop this analysis?</h3><p>This stops browser transfers and unstarted queue work. Already accepted server analysis cannot be stopped. Saved items are kept; retries reuse their records.</p><div className="report-actions"><button type="button" onClick={() => { op.stop(); setConfirm(false); }} data-testid="button-confirm-stop">Stop</button><button type="button" onClick={() => setConfirm(false)} data-testid="button-keep-going">Keep going</button></div></div>}
    </div>
  </div>, document.body);
}
function DecorativeScan({ src }: { src: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const image = new Image(); let disposed = false, frame = 0;
    image.onload = () => {
      const paint = (now: number) => {
        if (disposed || !canvas.current) return;
        if (!document.hidden) paintRgbLoupe(canvas.current, image, now, matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) frame = requestAnimationFrame(paint);
      };
      paint(performance.now());
    };
    image.src = src;
    return () => { disposed = true; cancelAnimationFrame(frame); image.onload = null; };
  }, [src]);
  return <div className="report-scan" aria-hidden="true"><canvas ref={canvas} width={78} height={78} /><span className="physical-footprint physical-loupe"><PhysicalView kind="loupe" active /></span></div>;
}
