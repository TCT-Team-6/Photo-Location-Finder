import {Component,createContext,lazy,memo,Suspense,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode,type RefObject} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {Environment,Lightformer,PerspectiveCamera,View} from '@react-three/drei';
import {DirectionalLight} from 'three';
import {PhysicalModel,type InstrumentKind,type InstrumentPalette,type SwatchMotion} from './physical-models';
import type {InstrumentInteraction} from './instrument-meshes';
import {installLayoutMonitor} from '@/lib/control-layout';
import {INSTRUMENT_FOV,instrumentRenderer,instrumentSoftboxes,instrumentStudioSurround,pixelCameraDistance} from '@/lib/instrument-kit';
import {cacheInstrumentFrame,cachedInstrumentFrame,instrumentFrameKey} from '@/lib/instrument-fallback';
import {instrumentPNGs} from '@/lib/instrument-pngs';
import {feedbackSpring} from '@/lib/lens-feedback';

type RenderState={available:boolean;error:string};
const Rendering=createContext<RenderState&{retry:()=>void}>({available:true,error:'',retry:()=>{}});
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
  return <Rendering.Provider value={{...state,retry:()=>setState({available:true,error:''})}}>{exportMode?<InstrumentExportGallery/>:children}{state.available&&<Boundary fail={fail}>
    <Canvas aria-hidden="true" eventSource={document.body} eventPrefix="client" dpr={[1,2]} frameloop="demand" shadows={{type:instrumentRenderer.shadowType}}
      gl={{alpha:true,antialias:true,powerPreference:'low-power',toneMapping:instrumentRenderer.toneMapping,outputColorSpace:instrumentRenderer.outputColorSpace}}
      onCreated={({gl})=>{gl.setClearAlpha(0);gl.shadowMap.type=instrumentRenderer.shadowType;gl.debug.onShaderError=(context,program,vertex,fragment)=>fail(`Instrument shader compilation failed: ${[context.getProgramInfoLog(program),context.getShaderInfoLog(vertex),context.getShaderInfoLog(fragment)].filter(Boolean).join(' ').slice(0,2400)}`);gl.domElement.addEventListener('webglcontextlost',()=>fail('WebGL context lost.'),{once:true});}}
      fallback={<span>3D requires a browser with canvas support.</span>} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:'var(--instrument-layer,1)'}}>
      <View.Port/><FrameCoordinator/>
    </Canvas>
  </Boundary>}</Rendering.Provider>;
}
type ExportedFrame={kind:InstrumentKind;png:string;width:number;height:number};
declare global{interface Window{InstrumentKitExport?:()=>Promise<ExportedFrame[]>}}
function FrameCoordinator(){
  const gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate),pending=useRef<((frames:ExportedFrame[])=>void)|null>(null);
  useEffect(()=>{
    const refresh=()=>invalidate();window.addEventListener('scroll',refresh,true);window.addEventListener('resize',refresh);window.addEventListener('whereabouts:instrument-motion',refresh);document.addEventListener('visibilitychange',refresh);
    window.InstrumentKitExport=async()=>{await document.fonts.ready;return new Promise(resolve=>{pending.current=resolve;invalidate();});};
    return()=>{delete window.InstrumentKitExport;window.removeEventListener('scroll',refresh,true);window.removeEventListener('resize',refresh);window.removeEventListener('whereabouts:instrument-motion',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[invalidate]);
  useFrame(()=>{gl.setScissorTest(false);gl.setRenderTarget(null);gl.setClearAlpha(0);gl.clear(true,true,true);},0);
  useFrame(()=>{
    if(!pending.current)return;
    const frames:ExportedFrame[]=[],canvasRect=gl.domElement.getBoundingClientRect(),ratio=gl.domElement.width/canvasRect.width;
    document.querySelectorAll<HTMLElement>('[data-instrument-kind][data-rendered="true"]').forEach(node=>{
      const kind=node.dataset.instrumentKind as InstrumentKind;if(frames.some(frame=>frame.kind===kind))return;
      const rect=node.getBoundingClientRect();if(!rect.width||rect.top<0||rect.bottom>canvasRect.bottom||rect.left<0||rect.right>canvasRect.right)return;
      const copy=document.createElement('canvas');copy.width=Math.round(rect.width*ratio);copy.height=Math.round(rect.height*ratio);
      copy.getContext('2d')!.drawImage(gl.domElement,(rect.left-canvasRect.left)*ratio,(rect.top-canvasRect.top)*ratio,rect.width*ratio,rect.height*ratio,0,0,copy.width,copy.height);
      frames.push({kind,png:copy.toDataURL('image/png'),width:copy.width,height:copy.height});
    });
    pending.current(frames);pending.current=null;
  },2);
  return null;
}
export type InstrumentViewProps={
  kind:InstrumentKind;value?:number;active?:boolean;pressed?:boolean;amount?:number;count?:number;
  host?:RefObject<HTMLElement|null>;colors?:string[][];labels?:string[];media?:File;
  interaction?:InstrumentInteraction;swatch?:SwatchMotion;
  angle?:number;
  layer?:number;
};
export function InstrumentView({kind,value=0,active=false,pressed=false,amount=0,count=0,host,colors,labels,media,interaction,swatch,angle,layer=0}:InstrumentViewProps){
  const rendering=useContext(Rendering),local=useRef<HTMLSpanElement>(null),[palette,setPalette]=useState(defaultPalette),[visible,setVisible]=useState(false),[ready,setReady]=useState(false);
  const[dimensions,setDimensions]=useState({width:280,height:300}),[png,setPng]=useState<string>(),[pngLoaded,setPngLoaded]=useState(false);
  useLayoutEffect(()=>{
    const node=local.current;if(!node)return;
    const resize=new ResizeObserver(([entry])=>setDimensions({width:entry.contentRect.width,height:entry.contentRect.height}));resize.observe(node);
    const update=()=>{const owner=host?.current??node,shown=Boolean(owner.getClientRects().length&&!owner.closest('[hidden],[inert]'));setVisible(shown);
      const theme=owner.closest('[data-app-theme]')??document.documentElement,css=getComputedStyle(theme);setPalette({paper:css.getPropertyValue('--paper').trim()||defaultPalette.paper,ink:css.getPropertyValue('--ink').trim()||defaultPalette.ink,accent:css.getPropertyValue('--fd-red').trim()||defaultPalette.accent,metal:'#c9c9c4'});
    };
    update();const observer=new MutationObserver(update);observer.observe(document.body,{attributes:true,subtree:true,attributeFilter:['hidden','inert','data-app-theme','data-high-contrast']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-app-theme','data-high-contrast']});
    return()=>{resize.disconnect();observer.disconnect();};
  },[host]);
  useEffect(()=>{if(!visible||!rendering.available)setReady(false);},[visible,rendering.available]);
  const key=instrumentFrameKey(kind,palette,value,active);
  useEffect(()=>{const bundled=instrumentPNGs[kind];setPng(cachedInstrumentFrame(key)??(bundled?`${import.meta.env.BASE_URL}instrument-renders/${bundled}`:undefined));},[key,kind,rendering.available]);
  useEffect(()=>{
    const owner=host?.current??local.current?.parentElement;if(!owner)return;
    owner.dataset.rendered=String(ready&&rendering.available);owner.dataset.instrumentKind=kind;
    return()=>{delete owner.dataset.rendered;delete owner.dataset.instrumentKind;};
  },[ready,rendering.available,host,kind]);
  return <>{png&&kind!=='print'&&<img src={png} className="physical-fallback" alt="" aria-hidden="true" style={{visibility:pngLoaded&&(!ready||!rendering.available)?'visible':'hidden'}} onLoad={()=>setPngLoaded(true)} onError={()=>setPngLoaded(false)}/>}
    <span ref={local} className="physical-view" aria-hidden="true">
      {rendering.available&&visible&&<View className="physical-view" frames={Infinity} index={1+layer/100}>
        <PerspectiveCamera makeDefault fov={INSTRUMENT_FOV} near={.1} far={10000} position={[0,0,pixelCameraDistance(dimensions.height)]}/>
        <InstrumentLights palette={palette} host={host??local}/>
        <SoftboxEnvironment/>
        <InvalidateModel value={value} amount={amount} active={active} pressed={pressed} swatch={swatch} host={host??local}>
          <PhysicalModel kind={kind} value={value} active={active} pressed={pressed} amount={amount} count={count} palette={palette} colors={colors} labels={labels} media={media} onRendered={()=>setReady(true)} interaction={interaction} width={dimensions.width} height={dimensions.height} swatch={swatch} angle={angle}/>
        </InvalidateModel>
        <mesh position={[0,0,-.15]} receiveShadow><planeGeometry args={[dimensions.width,dimensions.height]}/><shadowMaterial transparent opacity={.24} depthWrite={false}/></mesh>
        {kind!=='print'&&<CacheRenderedFrame ready={ready} frameKey={key} host={host??local}/>}
      </View>}
    </span>
    {!rendering.available&&<div className="physical-render-error" role="alert"><p>3D unavailable.</p><small>{rendering.error}</small><button type="button" onClick={rendering.retry}>Retry 3D</button></div>}
  </>;
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
function CacheRenderedFrame({ready,frameKey,host}:{ready:boolean;frameKey:string;host:RefObject<HTMLElement|null>}){
  const saved=useRef(''),gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate),wait=useRef(0);
  useEffect(()=>{wait.current=performance.now()+750;invalidate();},[frameKey,ready,invalidate]);
  useFrame(()=>{
    if(!ready||saved.current===frameKey)return;
    if(performance.now()<wait.current){invalidate();return;}
    const node=host.current,rect=node?.getBoundingClientRect(),canvas=gl.domElement.getBoundingClientRect();if(!rect||!rect.width||rect.top<0||rect.bottom>canvas.bottom)return;
    const scale=gl.domElement.width/canvas.width,copy=document.createElement('canvas');copy.width=Math.round(rect.width*scale);copy.height=Math.round(rect.height*scale);
    try{copy.getContext('2d')!.drawImage(gl.domElement,(rect.left-canvas.left)*scale,(rect.top-canvas.top)*scale,rect.width*scale,rect.height*scale,0,0,copy.width,copy.height);cacheInstrumentFrame(frameKey,copy.toDataURL('image/png'));saved.current=frameKey;}catch(error){console.error('[InstrumentKit] Could not cache a model-rendered PNG.',error);}
  },2);return null;
}
const exportThemes=[['#f4f4f2','#242723','#b6382e'],['#e4eadc','#27352d','#a23e34'],['#e0e8ee','#293039','#9f3e39'],['#efe2d7','#352c28','#aa3b30'],['#e6e6e6','#171917','#a1322b']];
const ExportSwatch=lazy(()=>import('./instrument-export-swatch'));
function InstrumentExportGallery(){
  const sizes:Partial<Record<InstrumentKind,[number,number]>>={dial:[280,300],shutter:[200,220],keys:[240,96],voice:[260,96],swatch:[560,420],lever:[96,140],rocker:[96,72],tally:[240,120],drawer:[560,360],loupe:[160,160],tray:[400,250],print:[208,184]};
  const specimen=useMemo(()=>new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0))],'export-specimen.png',{type:'image/png'}),[]);
  return <main className="instrument-export-gallery" data-testid="instrument-export-gallery">{Object.entries(sizes).map(([key,[width,height]])=><section key={key}><h2>{key}</h2><div className="physical-footprint" style={{width,height}}>{key==='swatch'?<Suspense fallback={null}><ExportSwatch/></Suspense>:<InstrumentView kind={key as InstrumentKind} value={key==='tally'?37:0} amount={key==='tally'?37:0} count={key==='drawer'?4:0} media={key==='print'?specimen:undefined} labels={['CASE 001 / Arden Vale','CASE 002 / Mina Ross','CASE 003 / Theo Wells','CASE 004 / Imani Shaw']} colors={exportThemes}/>}</div></section>)}</main>;
}
