import {Component,createContext,lazy,memo,Suspense,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Environment,Lightformer,PerspectiveCamera,View} from '@react-three/drei';
import {DirectionalLight,PerspectiveCamera as ThreePerspectiveCamera} from 'three';
import {PhysicalModel,type InstrumentKind,type InstrumentPalette,type SwatchMotion} from './physical-models';
import type {InstrumentInteraction} from './instrument-meshes';
import {installLayoutMonitor} from '@/lib/control-layout';
import {INSTRUMENT_FOV,instrumentRenderer,instrumentSoftboxes,instrumentStudioSurround,pixelCameraDistance} from '@/lib/instrument-kit';
import {cachedInstrumentFrame,instrumentFrameKey} from '@/lib/instrument-fallback';
import {instrumentPNGs,instrumentPNGRevision} from '@/lib/instrument-pngs';
import {feedbackSpring} from '@/lib/lens-feedback';
import {INSTRUMENT_RENDER_REVISION,integerInstrumentBounds,instrumentRegion,isInstrumentDebugKey,measureInstrumentTracks,registerInstrumentTrack} from '@/lib/instrument-alignment';
import type {SelectorMotion} from '@/lib/desk-selector';
import {applyInstrumentViewViewport,showInstrumentFallback} from '@/lib/instrument-viewport';

type RenderState={available:boolean;error:string};
const Rendering=createContext<RenderState&{retry:()=>void;report:(message:string)=>void}>({available:true,error:'',retry:()=>{},report:()=>{}});
const defaultPalette:InstrumentPalette={paper:'#eeece4',ink:'#242723',accent:'#a23e34',metal:'#c9c9c4'};
class Boundary extends Component<{children:ReactNode;fail:(message:string)=>void},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(error:Error){this.props.fail(error.message);}
  render(){return this.state.failed?null:this.props.children;}
}
export function InstrumentKit({children}:{children:ReactNode}){
  const[state,setState]=useState<RenderState>({available:true,error:''}),exportMode=new URLSearchParams(location.search).get('instrument-kit')==='export';
  const fail=(detail:string)=>{console.error('[InstrumentKit] 3D renderer failed:',detail);setState({available:false,error:detail});};
  useEffect(()=>import.meta.env.DEV?installLayoutMonitor():undefined,[]);
  useEffect(()=>{
    if(!import.meta.env.DEV)return;let count=0,last=0;
    const debug=(event:KeyboardEvent)=>{if(!isInstrumentDebugKey(event))return;const now=performance.now();count=now-last<700?count+1:1;last=now;if(count!==3)return;count=0;const root=document.documentElement;if(root.dataset.instrumentDebug==='true')delete root.dataset.instrumentDebug;else root.dataset.instrumentDebug='true';window.dispatchEvent(new Event('whereabouts:instrument-motion'));};
    document.addEventListener('keydown',debug);return()=>{document.removeEventListener('keydown',debug);delete document.documentElement.dataset.instrumentDebug;};
  },[]);
  return <Rendering.Provider value={{...state,retry:()=>setState({available:true,error:''}),report:fail}}>{exportMode?<InstrumentExportGallery/>:children}{state.available&&<Boundary fail={fail}>
    <Canvas aria-hidden="true" eventSource={document.body} eventPrefix="client" dpr={[1,2]} frameloop="demand" shadows={{type:instrumentRenderer.shadowType}}
      gl={{alpha:true,antialias:true,powerPreference:'low-power',toneMapping:instrumentRenderer.toneMapping,outputColorSpace:instrumentRenderer.outputColorSpace}}
      onCreated={({gl})=>{gl.setClearAlpha(0);gl.shadowMap.type=instrumentRenderer.shadowType;gl.debug.onShaderError=(context,program,vertex,fragment)=>fail(`Instrument shader compilation failed: ${[context.getProgramInfoLog(program),context.getShaderInfoLog(vertex),context.getShaderInfoLog(fragment)].filter(Boolean).join(' ').slice(0,2400)}`);gl.domElement.addEventListener('webglcontextlost',()=>fail('WebGL context lost.'),{once:true});}}
      fallback={<span>3D requires a browser with canvas support.</span>} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:'var(--instrument-layer,1)'}}>
      <View.Port/><FrameCoordinator/>
    </Canvas>
  </Boundary>}</Rendering.Provider>;
}
type ExportedFrame={kind:InstrumentKind;png:string;width:number;height:number;revision:string};
const sceneExports=new Map<HTMLElement,()=>ExportedFrame>();
let capturingInstrumentFrame=false;
declare global{interface Window{InstrumentKitExport?:()=>Promise<ExportedFrame[]>}}
function FrameCoordinator(){
  const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate),advance=useThree(s=>s.advance),pending=useRef<((frames:ExportedFrame[])=>void)|null>(null);
  const get=useThree(s=>s.get),setSize=useThree(s=>s.setSize);
  const rendering=useContext(Rendering),report=useRef(rendering.report),requested=useRef(0);report.current=rendering.report;
  useEffect(()=>{
    let drawing=false;
    const refresh=()=>{measureInstrumentTracks();invalidate();if(drawing||document.hidden)return;drawing=true;try{advance(performance.now(),false);}catch(error){report.current(error instanceof Error?error.message:'The instrument render pass failed.');}finally{drawing=false;invalidate();}};
    window.addEventListener('scroll',refresh,true);window.addEventListener('resize',refresh);window.addEventListener('whereabouts:lenis-scroll',refresh);window.addEventListener('whereabouts:instrument-motion',refresh);document.addEventListener('visibilitychange',refresh);
    window.visualViewport?.addEventListener('resize',refresh);window.visualViewport?.addEventListener('scroll',refresh);
    window.InstrumentKitExport=async()=>{await document.fonts.ready;return new Promise((resolve,reject)=>{if(pending.current){reject(new Error('A real-scene instrument export is already in progress.'));return;}requested.current=performance.now();pending.current=resolve;invalidate();});};
    return()=>{delete window.InstrumentKitExport;window.removeEventListener('scroll',refresh,true);window.removeEventListener('resize',refresh);window.removeEventListener('whereabouts:lenis-scroll',refresh);window.removeEventListener('whereabouts:instrument-motion',refresh);document.removeEventListener('visibilitychange',refresh);window.visualViewport?.removeEventListener('resize',refresh);window.visualViewport?.removeEventListener('scroll',refresh);pending.current?.([]);pending.current=null;};
  },[invalidate,advance]);
  useFrame(()=>{
    // The inner Canvas container is the actual fixed drawing surface, not the
    // workspace below its header. Repair stale root bounds before Views run.
    const rect=gl.domElement.parentElement?.getBoundingClientRect(),size=get().size;
    if(rect?.width&&rect.height&&(size.width!==rect.width||size.height!==rect.height||size.top!==rect.top||size.left!==rect.left))setSize(rect.width,rect.height,rect.top,rect.left);
    measureInstrumentTracks();gl.setRenderTarget(null);gl.setScissorTest(false);gl.setClearAlpha(0);gl.clear(true,true,true);
  },-100);
  useFrame(()=>{
    if(!pending.current)return;
    const expected=document.querySelectorAll('[data-instrument-kind][data-rendered="true"]').length;
    if(sceneExports.size<expected){if(performance.now()-requested.current>8000){console.error('[InstrumentKit] Actual model frame export failed: not all rendered Views registered their scenes.');pending.current([]);pending.current=null;}else invalidate();return;}
    const resolve=pending.current;pending.current=null;const frames:ExportedFrame[]=[];
    try{sceneExports.forEach((capture,node)=>{if(node.dataset.viewRendered!=='true'||frames.some(frame=>frame.kind===node.dataset.instrumentViewKind))return;frames.push(capture());});resolve(frames);}
    catch(error){console.error('[InstrumentKit] Actual model frame export failed.',error);resolve([]);}
    // Restore all tracked Views before this frame is presented, not one frame
    // after the last isolated PNG capture. pending is already cleared above.
    advance(performance.now(),false);
    invalidate();
  },2);
  return null;
}
export type InstrumentViewProps={
  kind:InstrumentKind;value?:number;active?:boolean;pressed?:boolean;amount?:number;count?:number;
  host?:RefObject<HTMLElement|null>;colors?:string[][];labels?:string[];media?:File;
  interaction?:InstrumentInteraction;swatch?:SwatchMotion;
  angle?:number;
  layer?:number;
  selector?:RefObject<SelectorMotion>;
};
export function InstrumentView({kind,value=0,active=false,pressed=false,amount=0,count=0,host,colors,labels,media,interaction,swatch,angle,layer=0,selector}:InstrumentViewProps){
  const rendering=useContext(Rendering),local=useRef<HTMLDivElement>(null),[palette,setPalette]=useState(defaultPalette),[visible,setVisible]=useState(false),[ready,setReady]=useState(false);
  const[dimensions,setDimensions]=useState({width:280,height:300}),[png,setPng]=useState<string>(),[pngLoaded,setPngLoaded]=useState(false);
  const fallback=useRef<HTMLImageElement>(null),bleed=kind==='drawer'?80:32;
  useLayoutEffect(()=>{
    const node=local.current,owner=host?.current??node?.parentElement;if(!node||!owner)return;
    const measure=()=>{const rect=owner.getBoundingClientRect();if(!rect.width||!rect.height)return;const region=instrumentRegion(kind,rect.width,rect.height),bounds=integerInstrumentBounds({left:rect.left+region.left,top:rect.top+region.top,width:region.width,height:region.height},bleed);
      const left=`${bounds.left-rect.left+bleed}px`,top=`${bounds.top-rect.top+bleed}px`,width=`${bounds.width}px`,height=`${bounds.height}px`;
      for(const element of[node,fallback.current])if(element){element.style.margin=`-${bleed}px`;element.style.setProperty('--instrument-bleed',`${bleed}px`);if(element.style.left!==left)element.style.left=left;if(element.style.top!==top)element.style.top=top;if(element.style.width!==width)element.style.width=width;if(element.style.height!==height)element.style.height=height;}
      const visualWidth=Math.round(region.width),visualHeight=Math.round(region.height);setDimensions(old=>old.width===visualWidth&&old.height===visualHeight?old:{width:visualWidth,height:visualHeight});
    };
    const resize=new ResizeObserver(()=>{measure();window.dispatchEvent(new Event('whereabouts:instrument-motion'));});resize.observe(owner);resize.observe(node);
    const unregister=registerInstrumentTrack(measure);measure();
    const update=()=>{const shown=Boolean(owner.getClientRects().length&&!owner.closest('[hidden],[inert]'));setVisible(shown);measure();
      const theme=owner.closest('[data-app-theme]')??document.documentElement,css=getComputedStyle(theme);setPalette({paper:css.getPropertyValue('--paper').trim()||defaultPalette.paper,ink:css.getPropertyValue('--ink').trim()||defaultPalette.ink,accent:css.getPropertyValue('--fd-red').trim()||defaultPalette.accent,metal:'#c9c9c4'});
    };
    update();const observer=new MutationObserver(update);observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['hidden','inert','data-app-theme','data-high-contrast']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-app-theme','data-high-contrast']});
    return()=>{unregister();resize.disconnect();observer.disconnect();};
  },[host,kind,bleed,png,visible,rendering.available]);
  useEffect(()=>{if(!visible||!rendering.available)setReady(false);},[visible,rendering.available]);
  const key=`${INSTRUMENT_RENDER_REVISION}:${instrumentFrameKey(kind,palette,value,active)}`;
  useEffect(()=>{if(kind==='splitflap'||kind==='archiveprint'||kind==='fontslider'||kind==='leadpaper'){setPng(undefined);return;}const bundled=instrumentPNGRevision===INSTRUMENT_RENDER_REVISION?instrumentPNGs[kind]:undefined;setPng(cachedInstrumentFrame(key)??(bundled?`${import.meta.env.BASE_URL}instrument-renders/${bundled}`:undefined));},[key,kind,rendering.available]);
  useEffect(()=>{
    const owner=host?.current??local.current?.parentElement;if(!owner)return;
    owner.dataset.rendered=String(visible&&ready&&rendering.available);owner.dataset.instrumentKind=kind;
    if(local.current){local.current.dataset.viewRendered=String(visible&&ready&&rendering.available);local.current.dataset.instrumentViewKind=kind;}
    return()=>{delete owner.dataset.rendered;delete owner.dataset.instrumentKind;};
  },[ready,rendering.available,host,kind,visible]);
  return <>{png&&kind!=='print'&&<img ref={fallback} src={png} className="physical-fallback" alt="" aria-hidden="true" style={{visibility:showInstrumentFallback(visible,pngLoaded,ready,rendering.available)?'visible':'hidden'}} onLoad={()=>setPngLoaded(true)} onError={()=>setPngLoaded(false)}/>}
      {visible&&rendering.available?<View ref={local} className="physical-view instrument-track" aria-hidden="true" frames={Infinity} index={1+layer/100}>
        {visible&&rendering.available&&<>
        <CalibratedCamera track={local}/>
        <AuthoritativeViewViewport track={local}/>
        <InstrumentLights palette={palette} host={host??local}/>
        <SoftboxEnvironment/>
        <InvalidateModel value={value} amount={amount} active={active} pressed={pressed} swatch={swatch} host={host??local}>
          <PhysicalModel kind={kind} value={value} active={active} pressed={pressed} amount={amount} count={count} palette={palette} colors={colors} labels={labels} media={media} onRendered={()=>setReady(true)} interaction={interaction} width={dimensions.width} height={dimensions.height} swatch={swatch} angle={angle} selector={selector}/>
        </InvalidateModel>
        <mesh position={[0,0,-.15]} receiveShadow><planeGeometry args={[dimensions.width+bleed*2,dimensions.height+bleed*2]}/><shadowMaterial transparent opacity={.24} depthWrite={false}/></mesh>
        <ActualSceneExport kind={kind} track={local} ready={ready}/>
        </>}
      </View>:<div ref={local} className="physical-view instrument-track" aria-hidden="true"/>}
    {!rendering.available&&<div className="physical-render-error" role="alert"><p>3D unavailable.</p><small>{rendering.error}</small><button type="button" onClick={rendering.retry}>Retry 3D</button></div>}
  </>;
}
function AuthoritativeViewViewport({track}:{track:RefObject<HTMLDivElement|null>}){
  const{gl,scene,invalidate}=useThree();
  useLayoutEffect(()=>{
    const previous=scene.onBeforeRender,previousAfter=scene.onAfterRender;
    let restore:(()=>void)|undefined;
    const prepare:typeof scene.onBeforeRender=(...args)=>{
      restore?.();restore=undefined;
      previous.apply(scene,args);
      if(capturingInstrumentFrame)return;
      const node=track.current;if(!node)return;
      restore=applyInstrumentViewViewport(gl,gl.domElement.getBoundingClientRect(),node.getBoundingClientRect(),args[2] as ThreePerspectiveCamera);
    };
    const finish:typeof scene.onAfterRender=(...args)=>{
      try{previousAfter.apply(scene,args);}finally{restore?.();restore=undefined;}
    };
    scene.onBeforeRender=prepare;scene.onAfterRender=finish;invalidate();
    return()=>{restore?.();if(scene.onBeforeRender===prepare)scene.onBeforeRender=previous;if(scene.onAfterRender===finish)scene.onAfterRender=previousAfter;invalidate();};
  },[gl,scene,track,invalidate]);
  // Drei performs a scissored clear when a portal unmounts. Request a complete
  // frame after that cleanup so it cannot leave a rectangular hole at rest.
  useEffect(()=>()=>{invalidate();},[invalidate]);
  return null;
}
function CalibratedCamera({track}:{track:RefObject<HTMLDivElement|null>}){
  const camera=useRef<ThreePerspectiveCamera>(null);
  useFrame(()=>{const rect=track.current?.getBoundingClientRect(),node=camera.current;if(!rect?.height||!node)return;const height=Math.round(rect.height),aspect=Math.round(rect.width)/height,distance=pixelCameraDistance(height);if(node.aspect!==aspect||node.position.z!==distance){node.aspect=aspect;node.position.set(0,0,distance);node.updateProjectionMatrix();}},-10);
  return <PerspectiveCamera ref={camera} makeDefault fov={INSTRUMENT_FOV} near={.1} far={10000}/>;
}
function ActualSceneExport({kind,track,ready}:{kind:InstrumentKind;track:RefObject<HTMLDivElement|null>;ready:boolean}){
  const{gl,scene,camera}=useThree();
  useEffect(()=>{const node=track.current;if(!node||!ready)return;
    sceneExports.set(node,()=>{const rect=node.getBoundingClientRect(),width=Math.round(rect.width),height=Math.round(rect.height),dpr=gl.getPixelRatio(),copy=document.createElement('canvas');copy.width=Math.round(width*dpr);copy.height=Math.round(height*dpr);
      if(copy.width>gl.domElement.width||copy.height>gl.domElement.height)throw new Error(`Canvas is too small to export the complete ${kind} View with bleed.`);
      gl.setRenderTarget(null);gl.setScissorTest(false);gl.setViewport(0,0,width,height);gl.setClearAlpha(0);gl.clear(true,true,true);
      capturingInstrumentFrame=true;try{gl.render(scene,camera);}finally{capturingInstrumentFrame=false;}
      copy.getContext('2d')!.drawImage(gl.domElement,0,gl.domElement.height-copy.height,copy.width,copy.height,0,0,copy.width,copy.height);
      return{kind,png:copy.toDataURL('image/png'),width:copy.width,height:copy.height,revision:INSTRUMENT_RENDER_REVISION};});
    return()=>{sceneExports.delete(node);};
  },[kind,track,ready,gl,scene,camera]);return null;
}
const SoftboxEnvironment=memo(function SoftboxEnvironment(){return <Environment frames={1} resolution={256} near={1} far={2000}><color attach="background" args={[instrumentStudioSurround]}/>{instrumentSoftboxes.map((box,i)=><Lightformer key={i} {...box} color="#faf9f4"/>)}</Environment>;});
function InvalidateModel({children,value,amount,active,pressed,swatch,host}:{children:ReactNode;value:number;amount:number;active:boolean;pressed:boolean;swatch?:SwatchMotion;host:RefObject<HTMLElement|null>}){
  const invalidate=useThree(s=>s.invalidate);
  useEffect(()=>invalidate(),[value,amount,active,pressed,swatch,invalidate]);
  useFrame(()=>{const node=host.current?.closest<HTMLElement>('.physical-footprint'),scan=node?.closest('.report-scan');if([...(node?.getAnimations()??[]),...(scan?.getAnimations()??[])].some(a=>a.playState==='running'))invalidate();});
  return children;
}
function InstrumentLights({palette,host}:{palette:InstrumentPalette;host:RefObject<HTMLElement|null>}){
  const key=useRef<DirectionalLight>(null),target=useRef({x:-360,y:420}),velocity=useRef({x:0,y:0}),invalidate=useThree(s=>s.invalidate);
  useEffect(()=>{const node=host.current?.closest('.physical-footprint')??host.current;if(!node)return;
    const move=(e:Event)=>{const event=e as PointerEvent,r=node.getBoundingClientRect(),dx=Math.max(-.5,Math.min(.5,(event.clientX-r.left)/r.width-.5)),dy=Math.max(-.5,Math.min(.5,(event.clientY-r.top)/r.height-.5));target.current={x:-360+dx*70,y:420-dy*70};invalidate();};
    const leave=()=>{target.current={x:-360,y:420};invalidate();};node.addEventListener('pointermove',move);node.addEventListener('pointerleave',leave);return()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerleave',leave);};
  },[host,invalidate]);
  useFrame((_,delta)=>{if(!key.current)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches){key.current.position.set(target.current.x,target.current.y,600);return;}const dt=Math.min(.032,delta),x=feedbackSpring({position:key.current.position.x,velocity:velocity.current.x},target.current.x,dt,220,26),y=feedbackSpring({position:key.current.position.y,velocity:velocity.current.y},target.current.y,dt,220,26);key.current.position.x=x.position;key.current.position.y=y.position;velocity.current={x:x.velocity,y:y.velocity};if(Math.abs(x.position-target.current.x)+Math.abs(y.position-target.current.y)+Math.abs(x.velocity)+Math.abs(y.velocity)>.01)invalidate();});
  return <><ambientLight intensity={.65} color={palette.paper}/><directionalLight ref={key} position={[-360,420,600]} intensity={3.1} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-550} shadow-camera-right={550} shadow-camera-top={550} shadow-camera-bottom={-550} shadow-camera-near={1} shadow-camera-far={1800} shadow-normalBias={.3} shadow-bias={-.00015} shadow-radius={4}/><directionalLight position={[300,-200,400]} color={palette.paper} intensity={.45}/></>;
}
const exportThemes=[['#f4f4f2','#242723','#b6382e'],['#e4eadc','#27352d','#a23e34'],['#e0e8ee','#293039','#9f3e39'],['#efe2d7','#352c28','#aa3b30'],['#e6e6e6','#171917','#a1322b']];
const ExportSwatch=lazy(()=>import('./instrument-export-swatch'));
const ExportSelector=lazy(()=>import('./instrument-export-selector'));
function InstrumentExportGallery(){
  const sizes:Partial<Record<InstrumentKind,[number,number]>>={dial:[320,280],shutter:[200,220],keys:[240,96],voice:[260,96],swatch:[560,420],lever:[120,140],rocker:[96,72],tally:[240,120],splitflap:[280,210],archiveprint:[280,174],fontslider:[320,48],leadpaper:[560,150],drawer:[560,360],loupe:[160,160],tray:[400,250],print:[208,184]};
  const specimen=useMemo(()=>new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'export-specimen.png',{type:'image/png'}),[]);
  return <main className="instrument-export-gallery" data-testid="instrument-export-gallery">{Object.entries(sizes).map(([key,[width,height]])=><section key={key}><h2>{key}</h2><div className={key==='dial'||key==='swatch'?'instrument-specimen':'physical-footprint'} style={{width,height}}>{key==='dial'?<Suspense fallback={null}><ExportSelector/></Suspense>:key==='swatch'?<Suspense fallback={null}><ExportSwatch/></Suspense>:<InstrumentView kind={key as InstrumentKind} value={key==='tally'?37:key==='splitflap'?128:key==='fontslider'?125:0} amount={key==='tally'?37:0} count={key==='drawer'?4:0} media={key==='print'||key==='archiveprint'?specimen:undefined} labels={key==='splitflap'?['Saved investigations']:['CASE 001 / Arden Vale','CASE 002 / Mina Ross','CASE 003 / Theo Wells','CASE 004 / Imani Shaw']} colors={exportThemes}/>}</div></section>)}</main>;
}
