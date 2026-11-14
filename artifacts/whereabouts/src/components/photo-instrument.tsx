import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Download, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { demoSamples, type DemoSample } from '@/lib/demo-samples';
import { createOpticalRenderer, type OpticalRenderer } from '@/lib/optical-loupe';
import { useLoupeDwell } from '@/hooks/use-loupe-dwell';
import type { LoupePoint } from '@/lib/loupe-dwell';

type RenderStatus = 'loading' | 'ready' | 'fallback' | 'lost' | 'image-error';
const BINARY = [
  '01010011 01000001 01001101 01010000',
  '01001100 01000101 00100000 01001111',
  '01000010 01010011 01000101 01010010',
  '01010110 01000101 00100000 00101111',
  '00100000 01000011 01001100 01010101',
  '01000101 01010011 00100000 00110000',
  '00110001 00100000 01010010 01000101',
  '01010110 01001001 01000101 01010111',
];

/** A cursor-driven, on-demand WebGL optical bench. No analysis requests. */
export function PhotoInstrument() {
  const [index, setIndex] = useState(0);
  const sample = demoSamples[index];
  return <InspectionBench key={sample.investigation.id} sample={sample} index={index} onPrevious={() => setIndex((index + demoSamples.length - 1) % demoSamples.length)} onNext={() => setIndex((index + 1) % demoSamples.length)} />;
}

function InspectionBench({ sample, index, onPrevious, onNext }: { sample: DemoSample; index: number; onPrevious: () => void; onNext: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<OpticalRenderer | null>(null);
  const pointRef = useRef<LoupePoint>({ x: 0, y: 0 });
  const [status, setStatus] = useState<RenderStatus>('loading');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { phase, move, leave, reset } = useLoupeDwell(sample.investigation.id);
  const downloadable = phase === 'json' && Boolean(dimensions);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let alive = true;
    let observer: ResizeObserver | null = null;
    let renderer: OpticalRenderer | null = null;
    setStatus('loading');
    reset();
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const lost = (event: Event) => {
      event.preventDefault();
      reset();
      setStatus('lost');
    };
    const restored = () => { if (alive) setAttempt((value) => value + 1); };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    const resize = () => {
      const { width, height } = stage.getBoundingClientRect();
      const previous = pointRef.current;
      pointRef.current = {
        x: previous.x ? Math.min(width, previous.x) : width * .47,
        y: previous.y ? Math.min(height, previous.y) : height * .42,
      };
      renderer?.resize(width, height);
      renderer?.draw(pointRef.current);
    };
    image.onload = () => {
      if (!alive) return;
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      try {
        renderer = createOpticalRenderer(canvas, image);
        rendererRef.current = renderer;
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(stage);
        setStatus('ready');
      } catch {
        // Explicit basic viewer; no CSS simulation of a refractive lens.
        setStatus('fallback');
      }
    };
    image.onerror = () => { if (alive) { setDimensions(null); setStatus('image-error'); reset(); } };
    image.src = sample.imageUrl;
    return () => {
      alive = false;
      image.onload = null;
      image.onerror = null;
      observer?.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      rendererRef.current = null;
      renderer?.dispose();
    };
  }, [sample.imageUrl, attempt, reset]);

  const examine = (next: LoupePoint) => {
    if (status === 'loading' || status === 'image-error') return;
    pointRef.current = next;
    rendererRef.current?.draw(next);
    move(next);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && event.buttons === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    examine({ x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) });
  };
  const keyboardMove = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { leave(); event.currentTarget.blur(); return; }
    const rect = event.currentTarget.getBoundingClientRect();
    const step = event.shiftKey ? 28 : 10;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta && event.key !== 'Home') return;
    event.preventDefault();
    examine(event.key === 'Home' ? { x: rect.width / 2, y: rect.height / 2 } : {
      x: Math.max(0, Math.min(rect.width, pointRef.current.x + delta![0])),
      y: Math.max(0, Math.min(rect.height, pointRef.current.y + delta![1])),
    });
  };

  const record = useMemo(() => ({
    classification: 'ILLUSTRATIVE SAMPLE — NOT LIVE EVIDENCE',
    sample_id: sample.investigation.id,
    image: {
      asset_filename: sample.imageUrl.split('/').pop() ?? null,
      recorded_filename: sample.investigation.originalName ?? null,
      width_px: dimensions?.width ?? null,
      height_px: dimensions?.height ?? null,
      source: sample.sourceName,
      source_url: sample.sourceImageUrl,
      license_url: sample.licenseUrl,
    },
    exif: { date_taken: null, gps: null, camera: null, status: 'Not extracted. Missing values remain unknown.' },
    scene_clues: (sample.investigation.clues ?? []).map((clue) => ({ label: clue.label, observation: clue.observation })),
    clue_origin: 'Prepared sample record; not generated from cursor position or new analysis.',
    notice: 'Binary-to-JSON is an illustrative reveal, not decryption. No live provider request, face matching, or person location.',
  }), [sample, dimensions]);
  const json = useMemo(() => JSON.stringify(record, null, 2), [record]);
  const downloadUrl = useRef<string | null>(null);
  useEffect(() => () => { if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current); }, []);
  const download = () => {
    if (!downloadable) return;
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    const url = URL.createObjectURL(new Blob([`${json}\n`], { type: 'application/json' }));
    downloadUrl.current = url;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${sample.investigation.id}-illustrative.json`;
    anchor.click();
  };
  const basic = status === 'fallback' || status === 'lost';
  return <div className="wa-optical-bench" data-testid="panel-photo-instrument">
    <div className="wa-bench-heading"><span>W / Visual geolocation instrument</span><span>{status === 'ready' ? 'WEBGL / SPHERICAL REFRACTION' : status === 'loading' ? 'LOADING SAMPLE PHOTOGRAPH' : 'BASIC VIEWER / OPTICS UNAVAILABLE'}</span></div>
    <div className="wa-bench-body">
      <div className="wa-bench-photo">
        <div className="wa-optical-ruler" aria-hidden="true"><span>00</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span></div>
        <div ref={stageRef} tabIndex={0} role="group" aria-label={`Inspect illustrative sample photograph: ${sample.investigation.title}`} aria-describedby="loupe-instructions" data-testid="stage-optical-loupe" className={`wa-optical-stage wa-optical-${status}`}
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') pointerMove(event); }}
          onPointerMove={pointerMove}
          onPointerDown={(event) => {
            if (event.pointerType !== 'mouse') event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.focus({ preventScroll: true });
            const rect = event.currentTarget.getBoundingClientRect();
            examine({ x: event.clientX - rect.left, y: event.clientY - rect.top });
          }}
          onPointerUp={(event) => { if (event.pointerType !== 'mouse') { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); leave(); } }}
          onPointerCancel={leave} onPointerLeave={leave} onBlur={leave} onKeyDown={keyboardMove}
          onFocus={() => { const rect = stageRef.current?.getBoundingClientRect(); if (rect) examine(pointRef.current.x ? pointRef.current : { x: rect.width / 2, y: rect.height / 2 }); }}>
          <canvas ref={canvasRef} className={status === 'ready' ? '' : 'wa-optical-canvas-hidden'} aria-hidden="true" data-testid="canvas-optical-loupe" />
          {basic && <img src={sample.imageUrl} alt="" className="wa-optical-fallback-image" />}
          {status === 'loading' && <div className="wa-optical-loading skeleton" aria-hidden="true" />}
          {status === 'image-error' && <div className="wa-optical-error"><strong>Sample photograph unavailable.</strong><p>Retry loading the local sample image.</p></div>}
          <span className="wa-optical-stamp" aria-hidden="true">ILLUSTRATIVE SAMPLE / {String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="wa-optical-stage-footer"><p id="loupe-instructions">Move to inspect. Hold still for 2 seconds.<br /><span>Touch: drag &amp; hold. Keyboard: focus photo, use arrows; Shift for larger steps.</span></p><span aria-hidden="true">＋ / W</span></div>
        {status !== 'ready' && status !== 'loading' && <div className="wa-optical-notice" role="status"><p>{basic ? 'WebGL optics are unavailable or the context was lost. Basic photo inspection and the timed sample JSON reveal still work; no optical effect is being simulated.' : 'The image could not load. No record is inferred from a failed image.'}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} data-testid="button-retry-optics"><RotateCcw size={13} />Retry {basic ? 'optics' : 'image'}</button></div>}
      </div>
      <div className="wa-optical-record">
        <div className="wa-optical-record-header"><span>sample_{String(index + 1).padStart(2, '0')}.json</span><span data-testid="status-loupe-phase">{phase === 'json' ? 'RESOLVED' : phase === 'decoding' ? 'REVEALING' : 'BINARY'}</span></div>
        <div className="wa-optical-output" data-phase={phase} data-testid="panel-loupe-readout">
          {phase === 'json' ? <pre tabIndex={0} aria-label="Illustrative photo metadata and prepared scene clues" data-testid="text-loupe-json"><code>{json}</code></pre> : <div className={`wa-optical-binary ${phase === 'decoding' ? 'wa-optical-decoding' : ''}`} aria-hidden="true"><span>ILLUSTRATIVE DATA STREAM</span>{BINARY.map((line, i) => <div key={line}>{i % 2 === index % 2 ? line : line.split(' ').reverse().join(' ')}</div>)}<p>{phase === 'decoding' ? 'BINARY → SAMPLE JSON' : 'HOLD STILL / 2000 ms → JSON'}</p></div>}
        </div>
        <p className="wa-optical-live sr-only" aria-live="polite">{phase === 'json' ? 'Illustrative sample JSON ready. No EXIF has been extracted. Download is available.' : phase === 'decoding' ? 'Revealing sample record.' : 'Binary display. Move within the photograph and hold still for two seconds to reveal the sample record.'}</p>
        <button type="button" onClick={download} disabled={!downloadable} className="wa-json-download" data-testid="button-download-sample-json"><Download size={14} />Download sample JSON <ArrowUpRight size={14} /></button>
        <p className="wa-optical-disclaimer">ILLUSTRATION, NOT DECRYPTION. Dimensions come from the loaded image. Clues are prewritten sample observations. EXIF is not extracted; unknowns remain null.</p>
      </div>
    </div>
    <div className="wa-optical-controls">
      <div><span className="wa-eyebrow">Frame {String(index + 1).padStart(2, '0')} / {String(demoSamples.length).padStart(2, '0')}</span><strong>{sample.investigation.title}</strong></div>
      <Link href={`/demo?case=${encodeURIComponent(sample.investigation.id)}`} className="wa-optical-sample-link" data-testid="link-landing-selected-sample">Open sample file <ArrowUpRight size={14} /></Link>
      <div className="wa-optical-arrows"><button type="button" onClick={onPrevious} aria-label="Previous sample photo" data-testid="button-previous-landing-sample"><ArrowLeft size={18} /></button><button type="button" onClick={onNext} aria-label="Next sample photo" data-testid="button-next-landing-sample"><ArrowRight size={18} /></button></div>
    </div>
  </div>;
}
