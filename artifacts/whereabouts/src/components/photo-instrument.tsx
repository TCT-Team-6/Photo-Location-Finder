import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Download, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { demoSamples, type DemoSample } from '@/lib/demo-samples';
import { createPixelProbe, type ExamplePhoto, type RegionMap, type RegionReading } from '@/lib/loupe-image-data';
import { applyScrollLight, instrumentLayout } from '@/lib/instrument-layout';
import type { OpticalRenderer } from '@/lib/optical-loupe';
import type { ToolMode } from '@/lib/loupe-kinematics';
import { ToolPanel } from '@/components/tool-panel';
import { useLoupeDwell } from '@/hooks/use-loupe-dwell';
import type { LoupePoint } from '@/lib/loupe-dwell';

type RenderStatus='loading'|'ready'|'fallback'|'lost'|'image-error';
const base=import.meta.env.BASE_URL;
const publicUrl=(path:string)=>`${base}${path.replace(/^\//,'')}`;
type Frame={id:string;title:string;imageUrl:string;sample?:DemoSample;photo?:ExamplePhoto;regions?:RegionMap};

export function PhotoInstrument(){
  const[index,setIndex]=useState(0),[example,setExample]=useState<{photo:ExamplePhoto;regions:RegionMap}|null>(null);
  const[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setError('');
    Promise.all(['data/example-photo.json','data/regions.json'].map(async path=>{
      const response=await fetch(publicUrl(path),{signal:controller.signal,credentials:'include'});
      if(!response.ok)throw new Error('Example data could not load.');return response.json();
    })).then(([photo,regions])=>{
      if(!Array.isArray(photo.gps)||photo.gps.length!==2||!photo.gps.every(Number.isFinite)||!regions.regions?.length)throw new Error('The example needs valid supplied GPS and region data.');
      setExample({photo,regions});
    }).catch((error:Error)=>{if(!controller.signal.aborted)setError(error.message);});
    return()=>controller.abort();
  },[attempt]);
  const count=demoSamples.length+1,sample=index>0?demoSamples[index-1]:undefined;
  const frame:Frame|null=sample?{id:sample.investigation.id,title:sample.investigation.title,imageUrl:sample.imageUrl,sample}:example?{id:example.photo.id,title:example.photo.title,imageUrl:publicUrl(example.photo.image),...example}:null;
  const next=()=>setIndex(value=>(value+1)%count);
  if(!frame)return <div className="wa-optical-bench"><div className="wa-optical-stage skeleton" role="status"><p className="wa-optical-load-label">{error||'Loading supplied example and editable region map…'}</p></div>{error&&<div className="wa-optical-controls"><button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry example</button><button type="button" onClick={next}>Browse existing samples <ArrowRight size={15}/></button></div>}</div>;
  return <InspectionBench key={frame.id} frame={frame} index={index} count={count} onPrevious={()=>setIndex(value=>(value+count-1)%count)} onNext={next}/>;
}

function legacyConfig(sample:DemoSample,image:HTMLImageElement):{photo:ExamplePhoto;regions:RegionMap}{
  const analysis=sample.investigation.analysis as {latitude?:number;longitude?:number}|undefined;
  if(!Number.isFinite(analysis?.latitude)||!Number.isFinite(analysis?.longitude))throw new Error('This prepared sample has no recorded coordinates.');
  return{photo:{
    id:sample.investigation.id,title:sample.investigation.title,image:sample.imageUrl,
    original_filename:sample.investigation.originalName??sample.imageUrl.split('/').pop()??'sample',
    original_width:image.naturalWidth,original_height:image.naturalHeight,served_width:image.naturalWidth,served_height:image.naturalHeight,
    source:sample.sourceName,place:'Prepared fictional sample location',gps:[analysis!.latitude!,analysis!.longitude!],
    gps_status:'Prepared fictional sample coordinates; not verified geolocation or EXIF',
    elevation_approx_m:null,capture:sample.investigation.shotAt??'Unknown; not recorded',
    provenance:'Existing precomputed fictional sample; not new analysis',exif_status:'Not extracted',
    exif:{camera:null,timestamp:null},clue_status:'Prepared sample observations, not live AI',pixel_status:'Measured served image pixels',
  },regions:{coordinate_system:'Normalized original image',authorship:'Existing prepared sample, not a spatially annotated region map',regions:[{
    id:'prepared_scene',label:'prepared_sample_scene',priority:0,polygon:[[0,0],[1,0],[1,1],[0,1]],
    clues:{clue:sample.investigation.clues?.[0]?.observation??'Prepared sample scenery',prepared_clues:sample.investigation.clues??[]},
  }]}};
}

function InspectionBench({frame,index,count,onPrevious,onNext}:{frame:Frame;index:number;count:number;onPrevious:()=>void;onNext:()=>void}){
  const stageRef=useRef<HTMLDivElement>(null),canvasRef=useRef<HTMLCanvasElement>(null),targetRef=useRef<HTMLButtonElement>(null);
  const rendererRef=useRef<OpticalRenderer|null>(null),pointRef=useRef<LoupePoint>({x:0,y:0}),modeRef=useRef<ToolMode>('docked');
  const readingRef=useRef<RegionReading|null>(null),settledRef=useRef<RegionReading|null>(null),photoRef=useRef<ExamplePhoto|null>(null);
  const coordinatesRef=useRef<HTMLSpanElement>(null),progressRef=useRef<HTMLSpanElement>(null),panelReadoutRef=useRef<HTMLSpanElement>(null);
  const inspectingRef=useRef(false),urlRef=useRef<string|null>(null);
  const cycleRef=useRef({anchor:{x:-999,y:-999},started:0});
  const[status,setStatus]=useState<RenderStatus>('loading'),[attempt,setAttempt]=useState(0),[snapshot,setSnapshot]=useState('');
  const[mode,setMode]=useState<ToolMode>('docked'),[used,setUsed]=useState(false),[hasDownload,setHasDownload]=useState(false);
  const{phase,move,leave,reset}=useLoupeDwell(frame.id);const phaseRef=useRef(phase);phaseRef.current=phase;
  const basic=status==='fallback'||status==='lost';
  useEffect(()=>{if(status!=='loading')window.dispatchEvent(new Event('whereabouts:bench-ready'));},[status]);
  useEffect(()=>{
    rendererRef.current?.setPhase(phase);
    if(phase==='json'&&readingRef.current){settledRef.current=readingRef.current;setHasDownload(true);setSnapshot(JSON.stringify(readingRef.current.record));}
  },[phase]);
  useEffect(()=>{
    const canvas=canvasRef.current,stage=stageRef.current;if(!canvas||!stage)return;
    let alive=true,renderer:OpticalRenderer|null=null,resizeObserver:ResizeObserver|null=null,intersection:IntersectionObserver|null=null;
    setStatus('loading');reset();applyScrollLight(stage,0);
    const image=new Image();image.crossOrigin='anonymous';
    const resize=()=>{const rect=stage.getBoundingClientRect();renderer?.resize(rect.width,rect.height);};
    const lost=(event:Event)=>{event.preventDefault();reset();renderer?.setVisible(false);setStatus('lost');modeRef.current='docked';setMode('docked');window.dispatchEvent(new CustomEvent('whereabouts:loupe-mode',{detail:'docked'}));};
    const restored=()=>{if(alive)setAttempt(value=>value+1);};
    const visibility=()=>{if(document.hidden){leave();renderer?.release();}};
    const blur=()=>{leave();reset();renderer?.release();};
    const hover=(event:globalThis.PointerEvent)=>{
      if(event.pointerType==='touch'||modeRef.current!=='docked')return;
      const rect=stage.getBoundingClientRect();renderer?.hover({x:event.clientX-rect.left,y:event.clientY-rect.top});
    };
    const zoom=(event:Event)=>renderer?.setPhotoZoom((event as CustomEvent<number>).detail);
    const lighting=(event:Event)=>renderer?.setLighting((event as CustomEvent<number>).detail);
    const updateMode=(next:ToolMode)=>{
      modeRef.current=next;setMode(next);stage.dataset.toolMode=next;
      if(next==='held')setUsed(true);
      else{leave();reset();inspectingRef.current=false;if(panelReadoutRef.current)panelReadoutRef.current.textContent='X — / Y —';}
      window.dispatchEvent(new CustomEvent('whereabouts:loupe-mode',{detail:next}));
    };
    document.addEventListener('visibilitychange',visibility);window.addEventListener('blur',blur);window.addEventListener('pointermove',hover,{passive:true});stage.addEventListener('whereabouts:photo-scale',zoom);stage.addEventListener('whereabouts:light',lighting);
    canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
    image.onload=async()=>{
      if(!alive)return;
      try{
        const config=frame.photo&&frame.regions?{photo:frame.photo,regions:frame.regions}:legacyConfig(frame.sample!,image);
        photoRef.current=config.photo;const probe=createPixelProbe(image,config.photo,config.regions.regions);
        const rect=stage.getBoundingClientRect(),layout=instrumentLayout(rect.width,rect.height);
        readingRef.current=probe({x:layout.photoWidth/2,y:layout.photoHeight/2},{width:layout.photoWidth,height:layout.photoHeight},layout.heldRadius);
        const{createOpticalRenderer}=await import('@/lib/optical-loupe');if(!alive)return;
        renderer=createOpticalRenderer(canvas,image,{
          photo:config.photo,regions:config.regions.regions,sampleIndex:index,readPixels:probe,onMode:updateMode,
          onReading:(reading,renderPhase)=>{
            readingRef.current=reading;
            if(phaseRef.current==='json'&&renderPhase==='json'){settledRef.current=reading;setSnapshot(JSON.stringify(reading.record));}
            const[x,y]=reading.stats.pixel_xy;
            if(coordinatesRef.current)coordinatesRef.current.textContent=`ORIGINAL IMAGE X ${x} / Y ${y} px`;
            if(panelReadoutRef.current)panelReadoutRef.current.textContent=`X ${x} / Y ${y}`;
          },
          onFrame:(point,_progress,state)=>{
            pointRef.current=point;
            if(targetRef.current){const radius=state.radius;targetRef.current.style.width=`${radius*2.4}px`;targetRef.current.style.height=`${radius*3.6}px`;targetRef.current.style.transform=`translate(${point.x-radius*1.2}px,${point.y-radius*1.2}px)`;}
            if(state.inspecting){
              const cycle=cycleRef.current;
              if(!inspectingRef.current||Math.hypot(point.x-cycle.anchor.x,point.y-cycle.anchor.y)>=3){cycle.anchor={...point};cycle.started=performance.now();}
              move(point);inspectingRef.current=true;
            }
            else if(inspectingRef.current){leave();reset();renderer?.cancelReveal();inspectingRef.current=false;}
            const progress=!state.inspecting?0:phaseRef.current==='json'?100:Math.min(99,Math.floor((performance.now()-cycleRef.current.started)/15));
            if(progressRef.current)progressRef.current.textContent=`LOCAL REVEAL ${String(progress).padStart(3,'0')}%`;
            if(!state.inspecting&&panelReadoutRef.current)panelReadoutRef.current.textContent='X — / Y —';
            stage.dataset.returnCount=String(state.returnCount);
          },
        });
        rendererRef.current=renderer;resize();renderer.setLighting(Number(stage.dataset.lightProgress||0));
        resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);
        intersection=new IntersectionObserver(([entry])=>renderer?.setVisible(entry.isIntersecting),{rootMargin:'100px'});intersection.observe(stage);
        setStatus('ready');
      }catch{if(alive){renderer?.dispose();renderer=null;rendererRef.current=null;setStatus('fallback');}}
    };
    image.onerror=()=>{if(alive)setStatus('image-error');};image.src=frame.imageUrl;
    return()=>{
      alive=false;image.onload=null;image.onerror=null;resizeObserver?.disconnect();intersection?.disconnect();
      stage.removeEventListener('whereabouts:photo-scale',zoom);stage.removeEventListener('whereabouts:light',lighting);
      canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);
      document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',blur);window.removeEventListener('pointermove',hover);rendererRef.current=null;renderer?.dispose();
      window.dispatchEvent(new CustomEvent('whereabouts:loupe-mode',{detail:'docked'}));
    };
  },[frame,attempt,reset,leave,move]);
  useEffect(()=>()=>{if(urlRef.current)URL.revokeObjectURL(urlRef.current);},[]);
  const position=(event:PointerEvent<HTMLDivElement>)=>{
    const r=event.currentTarget.getBoundingClientRect();return{x:Math.max(0,Math.min(r.width,event.clientX-r.left)),y:Math.max(0,Math.min(r.height,event.clientY-r.top))};
  };
  const release=()=>{
    rendererRef.current?.release();leave();reset();
  };
  const pointerMove=(event:PointerEvent<HTMLDivElement>)=>{
    const point=position(event);rendererRef.current?.hover(point);
    if(modeRef.current==='held')rendererRef.current?.draw(point);
  };
  const pointerDown=(event:PointerEvent<HTMLDivElement>)=>{
    const point=position(event),engine=rendererRef.current;
    if(status!=='ready'||!engine?.hitTest(point))return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);targetRef.current?.focus({preventScroll:true});engine.pickup(point);
  };
  const keyboardMove=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(!['Enter',' ','Escape','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||status!=='ready')return;
    event.preventDefault();
    if(event.key==='Escape'){release();return;}
    if(event.key==='Enter'||event.key===' '){if(modeRef.current==='held')release();else rendererRef.current?.pickup(pointRef.current);return;}
    if(modeRef.current!=='held')rendererRef.current?.pickup(pointRef.current);
    const rect=stageRef.current!.getBoundingClientRect(),layout=instrumentLayout(rect.width,rect.height),step=event.shiftKey?34:12;
    const delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key]??[0,0];
    rendererRef.current?.draw(event.key==='Home'?{x:layout.photoWidth/2,y:layout.photoHeight/2}:{x:Math.max(0,Math.min(rect.width,pointRef.current.x+delta[0])),y:Math.max(0,Math.min(rect.height,pointRef.current.y+delta[1]))});
  };
  const download=()=>{
    const photo=photoRef.current,reading=phase==='json'?readingRef.current:settledRef.current??(basic?readingRef.current:null);
    if(!photo||!reading)return;if(urlRef.current)URL.revokeObjectURL(urlRef.current);
    const json=JSON.stringify({...reading.record,photo,metrics_note:'Live statistics from a circular footprint in optimized served RGB pixels; coordinates mapped to original dimensions.'});
    urlRef.current=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const link=document.createElement('a');link.href=urlRef.current;link.download=`${frame.id}-region.json`;document.body.appendChild(link);link.click();link.remove();
  };
  return <div className="wa-optical-bench">
    <div className="wa-bench-heading wa-instrument-heading"><span>EXAMPLE / {String(index+1).padStart(2,'0')} — NO LIVE AI</span><span>SCROLL <span data-scroll-progress="photo">000%</span></span></div>
    <div className="wa-bench-ruler wa-optical-ruler" aria-hidden="true">ORIGINAL IMAGE / RGB PIXEL FIELD / INSTRUMENT 01</div>
    <div ref={stageRef} role="group" aria-label={`Inspect ${frame.title}`} aria-describedby="loupe-instructions" data-testid="stage-optical-loupe" data-engine-state={status} data-tool-mode={mode} className="wa-optical-stage wa-instrument-scene"
      onPointerMove={pointerMove} onPointerDown={pointerDown}
      onPointerUp={event=>{if(modeRef.current==='held')release();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onPointerCancel={release} onLostPointerCapture={()=>{if(modeRef.current==='held')release();}} onKeyDown={keyboardMove}>
      <div className="wa-instrument-photo" data-testid="inspection-photo"><img src={frame.imageUrl} alt="" draggable={false}/></div>
      <ToolPanel photo={photoRef.current??frame.photo??null} used={used} index={index} available={status==='ready'} readoutRef={panelReadoutRef}/>
      <canvas ref={canvasRef} className={status==='ready'?'':'wa-optical-canvas-hidden'} data-testid="canvas-optical-loupe" aria-hidden="true"/>
      {status==='loading'&&<div className="wa-optical-loading skeleton" aria-hidden="true"/>}
      <button ref={targetRef} type="button" disabled={status!=='ready'} aria-label={mode==='held'?'Return loupe to cradle':'Hold to lift loupe; Enter or Space toggles pickup'} aria-pressed={mode==='held'} data-testid="button-loupe-pickup" className="wa-loupe-hit-target"
        onBlur={()=>{if(modeRef.current==='held')release();}}
        onClick={event=>{if(event.detail===0){if(modeRef.current==='held')release();else rendererRef.current?.pickup(pointRef.current);}}}/>
    </div>
    <div className="wa-instrument-instructions"><p id="loupe-instructions">Hold the loupe to lift. Drag across the photo; release to return.<br/>Keyboard: Enter / Space to lift or return. Home centers on photo. Arrows move, Shift steps farther. Escape returns. Tab stays free.</p><span><span ref={coordinatesRef} data-testid="text-loupe-image-coordinates">ORIGINAL IMAGE COORDINATES / px</span><br/><span ref={progressRef} data-testid="text-loupe-reveal-counter">LOCAL REVEAL 000%</span></span></div>
    {(basic||status==='image-error')&&<div className="wa-optical-notice" role="status"><p>The 3D engine or photo is unavailable. No optical effect is simulated. A loaded image’s center reading remains downloadable.</p><button type="button" onClick={()=>setAttempt(value=>value+1)} data-testid="button-retry-optics"><RotateCcw size={13}/>Retry</button></div>}
    <p className="sr-only" aria-live="polite" data-testid="status-loupe-phase">{mode==='docked'?'Loupe is in its holder.':mode==='returning'?'Returning to the cradle.':phase==='json'?'The lens shows minified region JSON. Supplied coordinates are approximate, not verified.':phase==='decoding'?'Morphing binary wall to JSON wall.':'Loupe held. Reading the aligned RGB binary wall.'}</p>
    {phase==='json'&&<pre className="sr-only" data-testid="text-loupe-json">{snapshot}</pre>}
    <div className="wa-optical-controls">
      <div><span className="wa-eyebrow">Frame {String(index+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</span><strong>{frame.title}</strong></div>
      <Link href={frame.sample?`/demo?case=${encodeURIComponent(frame.id)}`:'/demo'} className="wa-optical-sample-link" data-testid="link-landing-selected-sample">Open sample files <ArrowUpRight size={14}/></Link>
      <button type="button" onClick={download} disabled={!hasDownload&&!basic||!readingRef.current||status==='loading'||status==='image-error'} className="wa-json-download" data-testid="button-download-sample-json"><Download size={14}/>Region JSON</button>
      <div className="wa-optical-arrows"><button type="button" onClick={onPrevious} aria-label="Previous sample photo" data-testid="button-previous-landing-sample"><ArrowLeft size={18}/></button><button type="button" onClick={onNext} aria-label="Next sample photo" data-testid="button-next-landing-sample"><ArrowRight size={18}/></button></div>
    </div>
    <p className="wa-optical-disclaimer">{index===0?'GPS 37.5039, −119.6043: approximate user-supplied visual match to Bachelor and Three Graces, Mariposa Grove. Not verified geolocation. No EXIF was present in the original. Capture, confidence and species clues are supplied estimates.':'Prepared fictional sample, not verified geolocation. Coordinates and observations are from its existing sample record.'} Binary and metrics derive from optimized image RGB pixels; transient bit flips are display animation, not changed source pixels. Hold still for one second, then a 0.5-second JSON morph. No face identification or live analysis.</p>
  </div>;
}
