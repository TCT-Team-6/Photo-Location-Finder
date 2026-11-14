import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Download, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { demoSamples, type DemoSample } from '@/lib/demo-samples';
import type { OpticalRenderer } from '@/lib/optical-loupe';
import { useLoupeDwell } from '@/hooks/use-loupe-dwell';
import type { LoupePoint } from '@/lib/loupe-dwell';

type RenderStatus = 'loading' | 'ready' | 'fallback' | 'lost' | 'image-error';
/** Three.js optical bench. Binary/partial JSON exist only on the glass mesh. */
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
  const coordinatesRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const [status, setStatus] = useState<RenderStatus>('loading');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { phase, move, leave, reset } = useLoupeDwell(sample.investigation.id);
  const basic = status === 'fallback' || status === 'lost';
  const downloadable = Boolean(dimensions) && (phase === 'json' || basic);
  useEffect(() => { rendererRef.current?.setPhase(phase); }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let alive = true;
    let observer: ResizeObserver | null = null;
    let intersection: IntersectionObserver | null = null;
    let renderer: OpticalRenderer | null = null;
    setStatus('loading');
    reset();
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const lost = (event: Event) => {
      event.preventDefault();
      reset();
      rendererRef.current?.setVisible(false);
      setStatus('lost');
    };
    const restored = () => { if (alive) setAttempt((value) => value + 1); };
    const visibility = () => { if (document.hidden) { leave(); renderer?.cancelReveal(); } };
    document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    const resize = () => {
      const { width, height } = stage.getBoundingClientRect();
      const previous = pointRef.current;
      pointRef.current = {
        x: previous.x ? Math.min(width, previous.x) : width * .46,
        y: previous.y ? Math.min(height, previous.y) : height * .44,
      };
      renderer?.resize(width, height);
    };
    image.onload = async () => {
      if (!alive) return;
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      try {
        const { createOpticalRenderer } = await import('@/lib/optical-loupe');
        if (!alive) return;
        renderer = createOpticalRenderer(canvas, image, {
          width: image.naturalWidth, height: image.naturalHeight,
          clue: sample.investigation.clues?.[0]?.label ?? 'Unknown',
          onFrame: (point, progress) => {
            const rect = stage.getBoundingClientRect();
            const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
            const px = Math.max(0, Math.min(image.naturalWidth - 1, Math.round((image.naturalWidth - rect.width / scale) / 2 + point.x / scale)));
            const py = Math.max(0, Math.min(image.naturalHeight - 1, Math.round((image.naturalHeight - rect.height / scale) / 2 + point.y / scale)));
            if (coordinatesRef.current) coordinatesRef.current.textContent = `IMAGE X ${String(px).padStart(4, '0')} / Y ${String(py).padStart(4, '0')} px`;
            if (progressRef.current) progressRef.current.textContent = `LOCAL REVEAL ${String(progress).padStart(3, '0')}%`;
          },
        });
        rendererRef.current = renderer;
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(stage);
        intersection = new IntersectionObserver(([entry]) => {
          renderer?.setVisible(entry.isIntersecting);
          if (!entry.isIntersecting) { leave(); renderer?.cancelReveal(); }
        }, { threshold: 0 });
        intersection.observe(stage);
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
      intersection?.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      document.removeEventListener('visibilitychange', visibility);
      rendererRef.current = null;
      renderer?.dispose();
    };
  }, [sample.imageUrl, attempt, reset, leave, sample.investigation.clues]);

  const examine = (next: LoupePoint) => {
    if (status !== 'ready') return;
    pointRef.current = next;
    rendererRef.current?.draw(next);
    move(next);
  };
  const leaveInspection = () => { leave(); rendererRef.current?.cancelReveal(); };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && event.buttons === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    examine({ x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) });
  };
  const keyboardMove = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { leaveInspection(); event.currentTarget.blur(); return; }
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
  return <div className="wa-optical-bench" data-testid="panel-photo-instrument">
    <div className="wa-bench-heading"><span>W / Visual geolocation instrument</span><span>{status === 'ready' ? 'THREE.JS / 3D TRANSMISSION LOUPE' : status === 'loading' ? 'LOADING SAMPLE PHOTOGRAPH' : 'BASIC VIEWER / 3D UNAVAILABLE'}</span></div>
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
          onPointerUp={(event) => { if (event.pointerType !== 'mouse') { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); leaveInspection(); } }}
          onPointerCancel={leaveInspection} onPointerLeave={leaveInspection} onBlur={leaveInspection} onKeyDown={keyboardMove}
          onFocus={() => { const rect = stageRef.current?.getBoundingClientRect(); if (rect) examine(pointRef.current.x ? pointRef.current : { x: rect.width / 2, y: rect.height / 2 }); }}>
          <canvas ref={canvasRef} className={status === 'ready' ? '' : 'wa-optical-canvas-hidden'} aria-hidden="true" data-testid="canvas-optical-loupe" />
          {basic && <img src={sample.imageUrl} alt="" className="wa-optical-fallback-image" />}
          {status === 'loading' && <div className="wa-optical-loading skeleton" aria-hidden="true" />}
          {status === 'image-error' && <div className="wa-optical-error"><strong>Sample photograph unavailable.</strong><p>Retry loading the local sample image.</p></div>}
          <span className="wa-optical-stamp" aria-hidden="true">ILLUSTRATIVE SAMPLE / {String(index + 1).padStart(2, '0')}</span>
        </div>
        <div className="wa-optical-stage-footer"><p id="loupe-instructions">Move to inspect. One second still → partial JSON inside the glass.<br /><span>Touch: drag &amp; hold. Keyboard: focus photo, use arrows; Shift for larger steps.</span></p><div className="wa-loupe-counters"><span ref={coordinatesRef} data-testid="text-loupe-image-coordinates">IMAGE COORDINATES / px</span><span ref={progressRef} data-testid="text-loupe-reveal-counter">LOCAL REVEAL 000%</span></div></div>
        {status !== 'ready' && status !== 'loading' && <div className="wa-optical-notice" role="status"><p>{basic ? 'The Three.js 3D engine is unavailable or its WebGL context was lost. This is a basic photograph, not simulated optics. The prepared sample JSON can still be downloaded below.' : 'The image could not load. No record is inferred from a failed image.'}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} data-testid="button-retry-optics"><RotateCcw size={13} />Retry {basic ? '3D engine' : 'image'}</button></div>}
      </div>
    </div>
    <p className="sr-only" aria-live="polite" data-testid="status-loupe-phase">{phase === 'json' ? 'A small part of the binary inside the lens has resolved to illustrative sample JSON. Surrounding binary remains. Full JSON download is available.' : phase === 'decoding' ? 'Illustrative data reveal in progress.' : 'Binary is visible only inside the 3D lens. Hold still for one second to reveal a sample JSON excerpt.'}</p>
    {phase === 'json' && <pre className="sr-only" aria-label="Illustrative photo metadata and prepared scene clues" data-testid="text-loupe-json">{json}</pre>}
    <div className="wa-optical-controls">
      <div><span className="wa-eyebrow">Frame {String(index + 1).padStart(2, '0')} / {String(demoSamples.length).padStart(2, '0')}</span><strong>{sample.investigation.title}</strong></div>
      <Link href={`/demo?case=${encodeURIComponent(sample.investigation.id)}`} className="wa-optical-sample-link" data-testid="link-landing-selected-sample">Open sample file <ArrowUpRight size={14} /></Link>
      <button type="button" onClick={download} disabled={!downloadable} className="wa-json-download" data-testid="button-download-sample-json"><Download size={14} />Sample JSON</button>
      <div className="wa-optical-arrows"><button type="button" onClick={onPrevious} aria-label="Previous sample photo" data-testid="button-previous-landing-sample"><ArrowLeft size={18} /></button><button type="button" onClick={onNext} aria-label="Next sample photo" data-testid="button-next-landing-sample"><ArrowRight size={18} /></button></div>
    </div>
    <p className="wa-optical-disclaimer">ILLUSTRATION, NOT DECRYPTION. Binary is a location-responsive visual metaphor, not extracted bytes. Dimensions come from the image; clues are prepared sample observations. EXIF, GPS, camera and timestamp are not extracted and remain null in the file.</p>
  </div>;
}
