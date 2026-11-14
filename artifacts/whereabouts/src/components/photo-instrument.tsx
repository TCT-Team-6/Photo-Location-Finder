import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Download, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { demoSamples, type DemoSample } from '@/lib/demo-samples';
import { createPixelProbe, type ExamplePhoto, type RegionMap, type RegionReading } from '@/lib/loupe-image-data';
import type { OpticalRenderer } from '@/lib/optical-loupe';
import { useLoupeDwell } from '@/hooks/use-loupe-dwell';
import type { LoupePoint } from '@/lib/loupe-dwell';

type RenderStatus = 'loading' | 'ready' | 'fallback' | 'lost' | 'image-error';
const base = import.meta.env.BASE_URL;
const publicUrl = (path: string) => `${base}${path.replace(/^\//, '')}`;
type Frame = { id: string; title: string; imageUrl: string; sample?: DemoSample; photo?: ExamplePhoto; regions?: RegionMap };

export function PhotoInstrument() {
  const [index, setIndex] = useState(0);
  const [example, setExample] = useState<{ photo: ExamplePhoto; regions: RegionMap } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    Promise.all(['data/example-photo.json', 'data/regions.json'].map(async (path) => {
      const response = await fetch(publicUrl(path), { signal: controller.signal, credentials: 'include' });
      if (!response.ok) throw new Error('Example data could not load.');
      return response.json();
    })).then(([photo, regions]) => {
      if (!Array.isArray(photo.gps) || !photo.gps.every(Number.isFinite) || photo.gps.length !== 2 || !regions.regions?.length) throw new Error('The example needs valid supplied GPS and region data.');
      setExample({ photo, regions });
    }).catch((error: Error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [attempt]);
  const count = demoSamples.length + 1;
  const sample = index > 0 ? demoSamples[index - 1] : undefined;
  const frame: Frame | null = sample
    ? { id: sample.investigation.id, title: sample.investigation.title, imageUrl: sample.imageUrl, sample }
    : example ? { id: example.photo.id, title: example.photo.title, imageUrl: publicUrl(example.photo.image), ...example } : null;
  const next = () => setIndex((value) => (value + 1) % count);
  if (!frame) return <div className="wa-optical-bench"><div className="wa-optical-stage skeleton" role="status"><p className="wa-optical-load-label">{error || 'Loading supplied example and editable region map…'}</p></div>{error && <div className="wa-optical-controls"><button type="button" onClick={() => setAttempt((value) => value + 1)} data-testid="button-retry-example-data">Retry example</button><button type="button" onClick={next} data-testid="button-browse-legacy-samples">Browse existing samples <ArrowRight size={15} /></button></div>}</div>;
  return <InspectionBench key={frame.id} frame={frame} index={index} count={count} onPrevious={() => setIndex((value) => (value + count - 1) % count)} onNext={next} />;
}

function legacyConfig(sample: DemoSample, image: HTMLImageElement): { photo: ExamplePhoto; regions: RegionMap } {
  const analysis = sample.investigation.analysis as { latitude?: number; longitude?: number } | undefined;
  if (!Number.isFinite(analysis?.latitude) || !Number.isFinite(analysis?.longitude)) throw new Error('This prepared sample has no recorded coordinates.');
  return {
    photo: {
      id: sample.investigation.id, title: sample.investigation.title, image: sample.imageUrl,
      original_filename: sample.investigation.originalName ?? sample.imageUrl.split('/').pop() ?? 'sample',
      original_width: image.naturalWidth, original_height: image.naturalHeight, served_width: image.naturalWidth, served_height: image.naturalHeight,
      source: sample.sourceName, place: 'Prepared fictional sample location', gps: [analysis!.latitude!, analysis!.longitude!],
      gps_status: 'Prepared fictional sample coordinates; not verified geolocation or EXIF',
      elevation_approx_m: null, capture: sample.investigation.shotAt ?? 'Unknown; not recorded',
      provenance: 'Existing precomputed fictional sample; not new analysis', exif_status: 'Not extracted',
      exif: { camera: null, timestamp: null }, clue_status: 'Prepared sample observations, not live AI', pixel_status: 'Measured served image pixels',
    },
    regions: { coordinate_system: 'Normalized original image', authorship: 'Existing prepared sample, not a spatially annotated region map', regions: [{
      id: 'prepared_scene', label: 'prepared_sample_scene', priority: 0, polygon: [[0,0],[1,0],[1,1],[0,1]],
      clues: { clue: sample.investigation.clues?.[0]?.observation ?? 'Prepared sample scenery', prepared_clues: sample.investigation.clues ?? [] },
    }] },
  };
}

function InspectionBench({ frame, index, count, onPrevious, onNext }: { frame: Frame; index: number; count: number; onPrevious: () => void; onNext: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<OpticalRenderer | null>(null);
  const pointRef = useRef<LoupePoint>({ x: 0, y: 0 });
  const readingRef = useRef<RegionReading | null>(null);
  const photoRef = useRef<ExamplePhoto | null>(null);
  const coordinatesRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const touchRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<RenderStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState('');
  const { phase, move, leave, reset } = useLoupeDwell(frame.id);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const basic = status === 'fallback' || status === 'lost';
  useEffect(() => {
    if (status !== 'loading') window.dispatchEvent(new Event('whereabouts:bench-ready'));
  }, [status]);
  useEffect(() => {
    rendererRef.current?.setPhase(phase);
    if (phase === 'json' && readingRef.current) setSnapshot(JSON.stringify(readingRef.current.record, null, 2));
  }, [phase]);
  useEffect(() => {
    const canvas = canvasRef.current, stage = stageRef.current;
    if (!canvas || !stage) return;
    let alive = true;
    let resizeObserver: ResizeObserver | null = null, intersection: IntersectionObserver | null = null;
    let renderer: OpticalRenderer | null = null;
    setStatus('loading'); reset();
    const image = new Image(); image.crossOrigin = 'anonymous';
    const lost = (event: Event) => { event.preventDefault(); reset(); renderer?.setVisible(false); setStatus('lost'); };
    const restored = () => { if (alive) setAttempt((value) => value + 1); };
    const visibility = () => { if (document.hidden) { leave(); renderer?.cancelReveal(); } };
    const zoom = (event: Event) => renderer?.setPhotoZoom((event as CustomEvent<number>).detail);
    document.addEventListener('visibilitychange', visibility);
    stage.addEventListener('whereabouts:photo-scale', zoom);
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
    const resize = () => {
      const rect = stage.getBoundingClientRect();
      pointRef.current = { x: pointRef.current.x ? Math.min(rect.width, pointRef.current.x) : rect.width * .46, y: pointRef.current.y ? Math.min(rect.height, pointRef.current.y) : rect.height * .44 };
      renderer?.resize(rect.width, rect.height);
    };
    image.onload = async () => {
      if (!alive) return;
      try {
        const config = frame.photo && frame.regions ? { photo: frame.photo, regions: frame.regions } : legacyConfig(frame.sample!, image);
        photoRef.current = config.photo;
        const probe = createPixelProbe(image, config.photo, config.regions.regions);
        const rect = stage.getBoundingClientRect();
        readingRef.current = probe({ x: rect.width / 2, y: rect.height / 2 }, rect, Math.min(window.innerHeight * .2, rect.width * .44));
        const { createOpticalRenderer } = await import('@/lib/optical-loupe');
        if (!alive) return;
        renderer = createOpticalRenderer(canvas, image, {
          readPixels: probe,
          onReading: (reading) => {
            readingRef.current = reading;
            if (phaseRef.current === 'json') setSnapshot(JSON.stringify(reading.record, null, 2));
            if (coordinatesRef.current) coordinatesRef.current.textContent = `ORIGINAL IMAGE X ${reading.stats.pixel_xy[0]} / Y ${reading.stats.pixel_xy[1]} px`;
          },
          onFrame: (point, progress) => {
            if (progressRef.current) progressRef.current.textContent = `LOCAL REVEAL ${String(progress).padStart(3, '0')}%`;
            if (touchRef.current) {
              const radius = Math.min(window.innerHeight * .2, stage.clientWidth * .44);
              touchRef.current.style.width = `${radius * 2}px`; touchRef.current.style.height = `${radius * 2}px`;
              touchRef.current.style.transform = `translate(${point.x - radius}px,${point.y - radius}px)`;
            }
          },
        });
        rendererRef.current = renderer; resize();
        resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage);
        intersection = new IntersectionObserver(([entry]) => { renderer?.setVisible(entry.isIntersecting); if (!entry.isIntersecting) { leave(); renderer?.cancelReveal(); } });
        intersection.observe(stage);
        setStatus('ready');
      } catch { if (alive) setStatus('fallback'); }
    };
    image.onerror = () => { if (alive) { setStatus('image-error'); reset(); } };
    image.src = frame.imageUrl;
    return () => {
      alive = false; image.onload = null; image.onerror = null;
      resizeObserver?.disconnect(); intersection?.disconnect();
      stage.removeEventListener('whereabouts:photo-scale', zoom);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      document.removeEventListener('visibilitychange', visibility);
      rendererRef.current = null; renderer?.dispose();
    };
  }, [frame, attempt, reset, leave]);
  const examine = (point: LoupePoint) => {
    if (status !== 'ready') return;
    pointRef.current = point; rendererRef.current?.draw(point); move(point);
  };
  const stop = () => { leave(); rendererRef.current?.cancelReveal(); };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' && event.buttons === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    examine({ x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) });
  };
  const keyboardMove = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { stop(); event.currentTarget.blur(); return; }
    const rect = event.currentTarget.getBoundingClientRect(), step = event.shiftKey ? 34 : 12;
    const delta = { ArrowLeft: [-step,0], ArrowRight: [step,0], ArrowUp: [0,-step], ArrowDown: [0,step] }[event.key];
    if (!delta && event.key !== 'Home') return;
    event.preventDefault();
    examine(event.key === 'Home' ? { x: rect.width / 2, y: rect.height / 2 } : { x: Math.max(0, Math.min(rect.width, pointRef.current.x + delta![0])), y: Math.max(0, Math.min(rect.height, pointRef.current.y + delta![1])) });
  };
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  const download = () => {
    const photo = photoRef.current, reading = readingRef.current;
    if (!photo || !reading) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const json = JSON.stringify({ ...reading.record, photo, metrics_note: 'Statistics from a sampled circular footprint in the optimized served image; original-image coordinate mapping.' }, null, 2);
    urlRef.current = URL.createObjectURL(new Blob([`${json}\n`], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = urlRef.current; link.download = `${frame.id}-region.json`; link.click();
  };
  return <div className="wa-optical-bench" data-testid="panel-photo-instrument">
    <div className="wa-bench-heading"><span>W / Visual geolocation instrument</span><span>{status === 'ready' ? 'THREE.JS / LIVE PIXELS + AUTHORED REGIONS' : status === 'loading' ? 'LOADING EXAMPLE' : '3D UNAVAILABLE / BASIC PHOTO'}</span></div>
    <div className="wa-bench-body"><div className="wa-bench-photo">
      <div className="wa-optical-ruler" aria-hidden="true"><span>00</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span></div>
      <div ref={stageRef} tabIndex={0} role="group" aria-label={`Inspect ${frame.title}`} aria-describedby="loupe-instructions" data-testid="stage-optical-loupe" data-engine-state={status} className={`wa-optical-stage${status === 'ready' ? ' wa-optical-ready' : ''}`}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') pointerMove(event); }} onPointerMove={pointerMove}
        onPointerDown={(event) => { if (event.pointerType !== 'mouse') event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus({ preventScroll: true }); pointerMove(event); }}
        onPointerUp={(event) => { if (event.pointerType !== 'mouse') { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); stop(); } }}
        onPointerCancel={stop} onPointerLeave={stop} onBlur={stop} onKeyDown={keyboardMove}
        onFocus={() => { const rect = stageRef.current?.getBoundingClientRect(); if (rect) examine(pointRef.current.x ? pointRef.current : { x: rect.width / 2, y: rect.height / 2 }); }}>
        <canvas ref={canvasRef} className={status === 'ready' ? '' : 'wa-optical-canvas-hidden'} aria-hidden="true" data-testid="canvas-optical-loupe" />
        {basic && <img src={frame.imageUrl} alt="" className="wa-optical-fallback-image" />}
        {status === 'loading' && <div className="wa-optical-loading skeleton" aria-hidden="true" />}
        {status === 'image-error' && <div className="wa-optical-error">The photograph could not load. Retry below.</div>}
        <button ref={touchRef} type="button" tabIndex={-1} aria-hidden="true" className="wa-loupe-touch-target" />
        <span className="wa-optical-stamp">EXAMPLE / {String(index + 1).padStart(2, '0')} — NO LIVE AI</span>
        <span className="wa-photo-scroll-label" aria-hidden="true">SCROLL <span data-scroll-progress="photo">000%</span></span>
      </div>
      <div className="wa-optical-stage-footer"><p id="loupe-instructions">Move to read pixels. Hold still for 1 second, then a 0.5-second JSON morph.<br /><span>Touch: drag the lens; swipe outside it to scroll. Keyboard: arrows / Shift for larger steps.</span></p><div className="wa-loupe-counters"><span ref={coordinatesRef} data-testid="text-loupe-image-coordinates">ORIGINAL IMAGE COORDINATES / px</span><span ref={progressRef} data-testid="text-loupe-reveal-counter">LOCAL REVEAL 000%</span></div></div>
      {basic || status === 'image-error' ? <div className="wa-optical-notice" role="status"><p>The 3D engine or image is unavailable. No optical effect is simulated. A loaded image’s center reading can still be downloaded.</p><button type="button" onClick={() => setAttempt((value) => value + 1)} data-testid="button-retry-optics"><RotateCcw size={13} />Retry</button></div> : null}
    </div></div>
    <p className="sr-only" aria-live="polite" data-testid="status-loupe-phase">{phase === 'json' ? 'The entire lens now shows region JSON. Coordinates are approximate supplied matches, not verified geolocation.' : phase === 'decoding' ? 'Morphing pixel binary into region JSON.' : 'Live RGB binary inside the lens.'}</p>
    {phase === 'json' && <pre className="sr-only" data-testid="text-loupe-json">{snapshot}</pre>}
    <div className="wa-optical-controls">
      <div><span className="wa-eyebrow">Frame {String(index + 1).padStart(2,'0')} / {String(count).padStart(2,'0')}</span><strong>{frame.title}</strong></div>
      <Link href={frame.sample ? `/demo?case=${encodeURIComponent(frame.id)}` : '/demo'} className="wa-optical-sample-link" data-testid="link-landing-selected-sample">Open sample files <ArrowUpRight size={14} /></Link>
      <button type="button" onClick={download} disabled={!readingRef.current || status === 'loading' || status === 'image-error' || phase !== 'json' && !basic} className="wa-json-download" data-testid="button-download-sample-json"><Download size={14} />Region JSON</button>
      <div className="wa-optical-arrows"><button type="button" onClick={onPrevious} aria-label="Previous sample photo" data-testid="button-previous-landing-sample"><ArrowLeft size={18} /></button><button type="button" onClick={onNext} aria-label="Next sample photo" data-testid="button-next-landing-sample"><ArrowRight size={18} /></button></div>
    </div>
    <p className="wa-optical-disclaimer">{index === 0 ? 'GPS 37.5039, −119.6043: approximate user-supplied visual match to Bachelor and Three Graces, Mariposa Grove. Not verified geolocation. No EXIF was present in the original. Capture and species clues are supplied estimates.' : 'Prepared fictional sample, not verified geolocation. Coordinates and authored observations are from its existing sample record.'} Binary and metrics come from actual served-image RGB pixels. No face identification or live analysis.</p>
  </div>;
}
