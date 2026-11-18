import {createContext,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import {RoundedBox} from '@react-three/drei';
import {CanvasTexture,DoubleSide,ExtrudeGeometry,Group,Plane,Shape,Path,SRGBColorSpace,Vector2,Vector3,type MeshPhysicalMaterialParameters,type Texture} from 'three';
import {instrumentMaterial,type MaterialName} from '@/lib/instrument-kit';
import {feedbackSpring} from '@/lib/lens-feedback';
import {tactileAngle} from '@/lib/desk-selector';
import type {InstrumentPalette} from './physical-models';

export const RenderedMesh=createContext<()=>void>(()=>{});
export type InstrumentInteraction={
  disabled?:boolean;onSelect?:(index:number)=>void;onHover?:(index:number|null)=>void;
  onPress?:(pressed:boolean)=>void;onDown?:()=>void;onUp?:()=>void;onCancel?:()=>void;
  onTurn?:(radians:number,phase:'start'|'move'|'end'|'click')=>void;
  onTranslate?:(x:number,y:number,phase:'start'|'move'|'end')=>void;
  onSettled?:()=>void;
};
export function Material({name,palette, ...rest}:{name:MaterialName;palette:InstrumentPalette}&MeshPhysicalMaterialParameters){
  return <meshPhysicalMaterial {...instrumentMaterial(name,palette.paper)} {...rest}/>;
}
export function Solid({size,at=[0,0,0],name='Black anodized',palette,radius=1}:{size:[number,number,number];at?:[number,number,number];name?:MaterialName;palette:InstrumentPalette;radius?:number}){
  const ready=useContext(RenderedMesh);
  return <RoundedBox args={size} radius={Math.min(radius,...size.map(v=>v/2-.001))} smoothness={3} position={at} castShadow={name!=='Glass'} receiveShadow onAfterRender={ready}><Material name={name} palette={palette}/></RoundedBox>;
}
export function Disc({radius,height,at=[0,0,0],name='Silver aluminum',palette,segments=128}:{radius:number;height:number;at?:[number,number,number];name?:MaterialName;palette:InstrumentPalette;segments?:number}){
  const ready=useContext(RenderedMesh);
  return <mesh rotation={[Math.PI/2,0,0]} position={at} castShadow receiveShadow onAfterRender={ready}><cylinderGeometry args={[radius,radius,height,segments]}/><Material name={name} palette={palette}/></mesh>;
}
export function Annulus({inner,outer,height,at=[0,0,0],name='Polished chrome',palette}:{inner:number;outer:number;height:number;at?:[number,number,number];name?:MaterialName;palette:InstrumentPalette}){
  const geometry=useMemo(()=>{const s=new Shape();s.absarc(0,0,outer,0,Math.PI*2,false);const hole=new Path();hole.absarc(0,0,inner,0,Math.PI*2,true);s.holes.push(hole);return new ExtrudeGeometry(s,{depth:height,bevelEnabled:true,bevelThickness:.35,bevelSize:.35,bevelSegments:2,curveSegments:128});},[inner,outer,height]);
  const ready=useContext(RenderedMesh);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} position={at} castShadow receiveShadow onAfterRender={ready}><Material name={name} palette={palette}/></mesh>;
}
export function ToothedRing({radius,inner=0,depth,teeth,toothDepth=1.5,palette,at=[0,0,0],name='Silver aluminum',roughness,bevel=.25}:{radius:number;inner?:number;depth:number;teeth:number;toothDepth?:number;palette:InstrumentPalette;at?:[number,number,number];name?:MaterialName;roughness?:number;bevel?:number}){
  const geometry=useMemo(()=>{
    const shape=new Shape();
    for(let i=0;i<teeth;i++)for(const[f,r]of[[0,radius-toothDepth],[.2,radius],[.68,radius],[.9,radius-toothDepth]]){const a=(i+f)/teeth*Math.PI*2,x=Math.sin(a)*r,y=Math.cos(a)*r;if(!i&&!f)shape.moveTo(x,y);else shape.lineTo(x,y);}
    shape.closePath();if(inner){const hole=new Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);}
    return new ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3,curveSegments:128});
  },[radius,inner,depth,teeth,toothDepth,bevel]);
  const ready=useContext(RenderedMesh);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} position={at} castShadow receiveShadow onAfterRender={ready}><Material name={name} palette={palette} roughness={roughness??instrumentMaterial(name,palette.paper).roughness}/></mesh>;
}
export function TactileRotation({angle,axis='x',duration=60,children}:{angle:number;axis?:'x'|'y'|'z';duration?:number;children:ReactNode}){
  const initial=useRef(angle),group=useRef<Group>(null),motion=useRef({from:angle,target:angle,start:0}),invalidate=useThree(s=>s.invalidate);
  useLayoutEffect(()=>{motion.current={from:group.current?.rotation[axis]??angle,target:angle,start:performance.now()};invalidate();},[angle,axis,invalidate]);
  useFrame(()=>{const node=group.current;if(!node)return;const elapsed=performance.now()-motion.current.start;node.rotation[axis]=tactileAngle(motion.current.from,motion.current.target,elapsed,matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,'out');if(elapsed<duration)invalidate();});
  return <group ref={group} rotation={axis==='x'?[initial.current,0,0]:axis==='y'?[0,initial.current,0]:[0,0,initial.current]}>{children}</group>;
}
export function Spring({target=0,axis='z',position=false,delay=0,stiffness=340,damping=27,children,onRest,motionKey,settleWithinMs}:{target?:number;axis?:'x'|'y'|'z';position?:boolean;delay?:number;stiffness?:number;damping?:number;children:ReactNode;onRest?:()=>void;motionKey?:string;settleWithinMs?:number}){
  const group=useRef<Group>(null),velocity=useRef(0),start=useRef(0),deadline=useRef(Infinity),invalidate=useThree(s=>s.invalidate),wanted=useRef(target);
  const resting=useRef(false),restCallback=useRef(onRest);restCallback.current=onRest;
  useEffect(()=>{const now=performance.now();start.current=now+delay;deadline.current=settleWithinMs===undefined?Infinity:now+settleWithinMs;wanted.current=target;resting.current=false;invalidate();},[target,delay,motionKey,settleWithinMs,invalidate]);
  useFrame((_,delta)=>{
    const node=group.current;if(!node||document.hidden)return;const property=position?node.position:node.rotation;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||performance.now()>=deadline.current){property[axis]=wanted.current;velocity.current=0;if(!resting.current){resting.current=true;restCallback.current?.();}return;}
    if(performance.now()<start.current){invalidate();return;}
    // Analytic integration advances real elapsed time even at software-rendered
    // frame rates; a 16ms simulation cap stretched 450ms motions into seconds.
    const next=feedbackSpring({position:property[axis],velocity:velocity.current},wanted.current,delta,stiffness,damping);property[axis]=next.position;velocity.current=next.velocity;
    if(Math.abs(wanted.current-property[axis])+Math.abs(velocity.current)>.001)invalidate();else{property[axis]=wanted.current;velocity.current=0;if(!resting.current){resting.current=true;restCallback.current?.();}}
  });
  return <group ref={group}>{children}</group>;
}
export function useEngraving(width:number,height:number,paint:(ctx:CanvasRenderingContext2D)=>void,deps:unknown[]){
  const[fontReady,setFontReady]=useState(document.fonts.status==='loaded');
  useEffect(()=>{let alive=true;void document.fonts.ready.then(()=>{if(alive)setFontReady(true);});return()=>{alive=false;};},[]);
  const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*4);canvas.height=Math.ceil(height*4);const c=canvas.getContext('2d')!;c.scale(4,4);c.font='11px "DM Mono",monospace';c.textAlign='center';c.textBaseline='middle';paint(c);const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.anisotropy=8;return map;},[width,height,fontReady,...deps]);
  useEffect(()=>()=>texture.dispose(),[texture]);return texture;
}
export function Surface({width,height,palette,paint,deps,at=[0,0,.1],engraved=false,dark=false,circle=false,name='Paper',metalnessMap,bumpDepth}:{width:number;height:number;palette:InstrumentPalette;paint:(ctx:CanvasRenderingContext2D)=>void;deps:unknown[];at?:[number,number,number];engraved?:boolean;dark?:boolean;circle?:boolean;name?:MaterialName;metalnessMap?:Texture;bumpDepth?:number}){
  const map=useEngraving(width,height,paint,deps),ready=useContext(RenderedMesh);
  // Every surface painter fills its background; its shape is defined by actual
  // plane/circle geometry. It must be opaque: Three's transmission pass only
  // includes opaque objects, so transparent printed faces disappear under glass.
  return <mesh position={at} receiveShadow onAfterRender={ready}>{circle?<circleGeometry args={[width/2,128]}/>:<planeGeometry args={[width,height]}/>}<Material name={name} palette={palette} color="#ffffff" map={map} metalnessMap={metalnessMap} bumpMap={engraved?map:undefined} bumpScale={engraved?(bumpDepth??(dark?-.6:.6)):0} transparent={false} side={DoubleSide} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>;
}
export function EngravedText({text,width,height,palette,at=[0,0,0],dark=false}:{text:string;width:number;height:number;palette:InstrumentPalette;at?:[number,number,number];dark?:boolean}){
  return <Surface width={width} height={height} palette={palette} at={at} engraved dark={dark} name={dark?'Black anodized':'Silver aluminum'} deps={[text,palette.paper,palette.ink,dark]} paint={ctx=>{ctx.fillStyle=dark?'#1c1c1c':'#c9c9c4';ctx.fillRect(0,0,width,height);ctx.fillStyle=dark?palette.paper:palette.ink;ctx.font=`${Math.min(11,height*.7)}px "DM Mono",monospace`;ctx.fillText(text,width/2,height/2,width-2);}}/>;
}
export function GlassCover({width,height,palette,at=[0,0,0]}:{width:number;height:number;palette:InstrumentPalette;at?:[number,number,number]}){
  return <Solid size={[width,height,2]} at={at} name="Glass" palette={palette} radius={.7}/>;
}
type CaptureTarget={setPointerCapture:(id:number)=>void;hasPointerCapture:(id:number)=>boolean;releasePointerCapture:(id:number)=>void};
export function pressCapture(event:ThreeEvent<PointerEvent>){(event.target as unknown as CaptureTarget).setPointerCapture(event.pointerId);}
export function releaseCapture(event:ThreeEvent<PointerEvent>){const target=event.target as unknown as CaptureTarget;if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);}
export function Interactive({children,interaction,index=0,drag=false}:{children:ReactNode;interaction?:InstrumentInteraction;index?:number;drag?:boolean}){
  const held=useRef(false),moved=useRef(false),origin=useRef(new Vector2()),invalidate=useThree(s=>s.invalidate);
  const angle=(e:ThreeEvent<PointerEvent|MouseEvent>)=>{const center=e.eventObject.getWorldPosition(new Vector3()),point=new Vector3();e.ray.intersectPlane(new Plane(new Vector3(0,0,1),-center.z),point);return Math.atan2(point.x-center.x,point.y-center.y);};
  return <group onPointerOver={e=>{if(interaction?.disabled)return;e.stopPropagation();interaction?.onHover?.(index);invalidate();}} onPointerOut={()=>{interaction?.onHover?.(null);invalidate();}}
    onPointerDown={e=>{if(interaction?.disabled)return;e.stopPropagation();held.current=true;moved.current=false;origin.current.set(e.clientX,e.clientY);pressCapture(e);interaction?.onPress?.(true);interaction?.onDown?.();interaction?.onTranslate?.(e.clientX,e.clientY,'start');if(drag)interaction?.onTurn?.(angle(e),'start');invalidate();}}
    onPointerMove={e=>{if(!held.current)return;if(Math.hypot(e.clientX-origin.current.x,e.clientY-origin.current.y)>4)moved.current=true;if(drag)interaction?.onTurn?.(angle(e),'move');interaction?.onTranslate?.(e.clientX,e.clientY,'move');invalidate();}}
    onPointerUp={e=>{if(!held.current)return;e.stopPropagation();releaseCapture(e);held.current=false;interaction?.onPress?.(false);interaction?.onUp?.();interaction?.onTranslate?.(e.clientX,e.clientY,'end');if(drag)interaction?.onTurn?.(0,'end');invalidate();}}
    onPointerCancel={e=>{releaseCapture(e);held.current=false;interaction?.onPress?.(false);interaction?.onCancel?.();invalidate();}}
    onClick={e=>{if(interaction?.disabled)return;e.stopPropagation();if(!moved.current){if(drag)interaction?.onTurn?.(angle(e),'click');else interaction?.onSelect?.(index);}moved.current=false;invalidate();}}>{children}</group>;
}
