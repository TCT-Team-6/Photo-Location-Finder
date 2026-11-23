import {useContext,useEffect,useMemo,useRef,type RefObject} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Center} from '@react-three/drei';
import {DoubleSide,ExtrudeGeometry,Group,Mesh,MeshPhysicalMaterial,Path,Shape,Vector2,type BufferGeometry} from 'three';
import {Annulus,Disc,EngravedText,GlassCover,Interactive,Material,RenderedMesh,Solid,Spring,Surface,TactileRotation,ToothedRing as Toothed,useEngraving,type InstrumentInteraction} from './instrument-meshes';
import {PhysicalPhotoPrint} from './physical-photo-print';
import {SplitFlapModel} from './split-flap-model';
import {FontSliderModel} from './font-slider-model';
import {createLoupeAssembly} from '@/lib/loupe-model';
import {instrumentMaterial} from '@/lib/instrument-kit';
import {counterDrum,counterDrumRotation,createCounterApertureGeometry} from '@/lib/instrument-counter';
import {SWATCH_CLOSE_MS,SWATCH_SELECTION_MS} from '@/lib/instrument-interaction';
import {createSelectorMotion,crossedDeskDetents,tactileAngle,type SelectorMotion} from '@/lib/desk-selector';
import {deskSound} from '@/lib/desk-sound';
import {swatchMotionCenter} from '@/lib/instrument-alignment';

export type InstrumentKind='dial'|'shutter'|'tally'|'splitflap'|'archiveprint'|'fontslider'|'keys'|'drawer'|'voice'|'swatch'|'lever'|'rocker'|'loupe'|'tray'|'print';
export type InstrumentPalette={paper:string;ink:string;accent:string;metal:string};
export type SwatchMotion={order:number[];highlight:number;closingSelection:number|null;reduced:boolean;phase:'closed'|'open'|'select'|'closing'};
type Props={kind:InstrumentKind;value:number;active:boolean;pressed:boolean;amount:number;count:number;palette:InstrumentPalette;colors?:string[][];labels?:string[];media?:File;onRendered:()=>void;interaction?:InstrumentInteraction;width?:number;height?:number;swatch?:SwatchMotion;angle?:number;selector?:RefObject<SelectorMotion>};
const names:Record<InstrumentKind,string>={dial:'Desk selector knob',shutter:'Shutter button',keys:'Library desk keys',voice:'Guide push-to-talk and VU meter',lever:'High contrast lever',rocker:'Sound rocker',tally:'Tally counter',splitflap:'Archive split-flap clock',archiveprint:'Saved original photograph',fontslider:'Text size analog slider',drawer:'Cases file drawer',swatch:'Theme swatch book',loupe:'Small homepage loupe',tray:'Intake tray',print:'Photo print'};
export function PhysicalModel(props:Props){
  const root=useRef<Group>(null),ready=useRef(false),logged=useRef(false);
  const rendered=()=>{if(!ready.current){ready.current=true;props.onRendered();}};
  useFrame(()=>{
    if(logged.current||!root.current||!ready.current)return;
    let meshes=0,triangles=0;root.current.traverse(object=>{if(object instanceof Mesh){meshes++;const geometry=object.geometry;triangles+=(geometry.index?.count??geometry.attributes.position?.count??0)/3;}});
    if(meshes){logged.current=true;console.info(`[3D] ${names[props.kind]}: ${meshes} meshes, ${Math.round(triangles)} triangles`);}
  });
  let model;
  switch(props.kind){
    case'dial':model=<Dial {...props}/>;break;
    case'shutter':model=<Shutter {...props}/>;break;
    case'keys':model=<Keys {...props}/>;break;
    case'voice':model=<Voice {...props}/>;break;
    case'lever':model=<Lever {...props}/>;break;
    case'rocker':model=<Rocker {...props}/>;break;
    case'tally':model=<Tally {...props}/>;break;
    case'splitflap':model=<SplitFlapModel value={props.value} label={props.labels?.[0]??'Saved investigations'} palette={props.palette} width={props.width} height={props.height}/>;break;
    case'fontslider':model=<FontSliderModel value={props.value} palette={props.palette} width={props.width}/>;break;
    case'archiveprint':model=props.media?<group rotation={[-.055,.035,-.045]} scale={Math.min(((props.width??280)-34)/112,((props.height??174)-24)/84)} position={[0,0,8]}><PhysicalPhotoPrint file={props.media} palette={props.palette} onRendered={rendered}/></group>:null;break;
    case'drawer':model=<Drawer {...props}/>;break;
    case'swatch':model=<Swatch {...props}/>;break;
    case'loupe':model=<HomepageLoupe {...props}/>;break;
    case'print':model=props.media?<Interactive interaction={props.interaction}><PhysicalPhotoPrint file={props.media} palette={props.palette} onRendered={rendered}/></Interactive>:null;break;
    default:model=<Tray {...props}/>;
  }
  return <RenderedMesh.Provider value={rendered}><group ref={root} name={`InstrumentKit / ${names[props.kind]}`} rotation={[0,0,props.angle??0]}>{props.kind==='swatch'?model:<Center disableZ cacheKey={`${props.kind}:${props.width}:${props.height}`}>{model}</Center>}</group></RenderedMesh.Provider>;
}
function Dial({value,palette:p,interaction,selector}:Props){
  const rotating=useRef<Group>(null),fallback=useRef(createSelectorMotion(value)),invalidate=useThree(s=>s.invalidate);
  const paintMetalness=useEngraving(88,88,c=>{c.fillStyle='#ffffff';c.fillRect(0,0,88,88);c.strokeStyle='#000000';c.lineWidth=3;c.beginPath();c.moveTo(44,44);c.lineTo(44,2);c.stroke();c.fillStyle='#000000';c.beginPath();c.arc(44,4,2.8,0,Math.PI*2);c.fill();},[]);
  useFrame(()=>{const motion=selector?.current??fallback.current,node=rotating.current;if(!node)return;
    if(motion.mode==='timed'){const before=motion.angle,elapsed=performance.now()-motion.started;motion.angle=tactileAngle(motion.from,motion.target,elapsed,motion.duration,motion.curve);if(selector)for(const _index of crossedDeskDetents(before,motion.angle))deskSound('detent');if(elapsed<motion.duration)invalidate();}
    node.rotation.z=-motion.angle;
  });
  return <Interactive interaction={interaction} drag><group ref={rotating}>
    <Toothed radius={59.4} depth={28.8} teeth={60} toothDepth={2} bevel={.6} name="Black anodized" roughness={.5} palette={p} at={[0,0,.6]}/>
    <Disc radius={44} height={2} at={[0,0,31]} name="Silver aluminum" palette={p}/>
    <Annulus inner={44.35} outer={45.65} height={1.3} at={[0,0,30.35]} name="Silver aluminum" palette={p}/>
    <Surface width={88} height={88} at={[0,0,32.3]} palette={p} circle engraved name="Silver aluminum" metalnessMap={paintMetalness} bumpDepth={-.6} deps={[p.accent]} paint={c=>{
      c.fillStyle='#c9c9c4';c.fillRect(0,0,88,88);c.lineWidth=.14;
      for(let r=2;r<44;r+=.55){c.strokeStyle=r%1>.4?'#bfc0ba':'#d1d2cc';c.beginPath();c.arc(44,44,r,0,Math.PI*2);c.stroke();}
      c.strokeStyle='#f4f4ec';c.lineWidth=3;c.beginPath();c.moveTo(44,44);c.lineTo(44,2);c.stroke();c.fillStyle=p.accent;c.beginPath();c.arc(44,4,2.8,0,Math.PI*2);c.fill();
    }}/>
  </group></Interactive>;
}
function Shutter({pressed,palette:p,interaction}:Props){
  const dish=useMemo(()=>[new Vector2(0,25),new Vector2(10,25.05),new Vector2(25,25.5),new Vector2(38,26.3),new Vector2(46,27),new Vector2(46,20),new Vector2(0,20)],[]);
  return <group><Disc radius={67} height={4} at={[0,0,2]} name="Black anodized" palette={p}/>
    <Toothed radius={66} inner={48} depth={10} teeth={90} at={[0,0,4]} palette={p}/>
    <mesh rotation={[Math.PI/2,0,0]} position={[0,0,13]} receiveShadow><cylinderGeometry args={[48,48,18,128,1,true]}/><Material name="Black anodized" palette={p} side={DoubleSide}/></mesh>
    <Interactive interaction={interaction}><Spring position target={pressed?-8:0} stiffness={2200} damping={65}>
      <mesh rotation={[Math.PI/2,0,0]} castShadow receiveShadow><latheGeometry args={[dish,128]}/><Material name="Black anodized" palette={p}/></mesh>
      <mesh position={[0,0,26.8]}><torusGeometry args={[42,.6,10,128]}/><meshPhysicalMaterial color={p.accent} roughness={.45} metalness={.35}/></mesh>
    </Spring></Interactive>
  </group>;
}
function Keys({value,palette:p,interaction}:Props){
  return <group>{[0,1,2].map(i=><group key={i} position={[(i-1)*78,9,0]}>
    <Disc radius={12} height={9} at={[0,0,5]} name="Black anodized" palette={p}/>
    <Interactive interaction={interaction} index={i}><Spring position target={value&(1<<i)?-6:0}>
      <Annulus inner={26} outer={30} height={5} at={[0,0,13]} palette={p}/>
      <Disc radius={25.9} height={1} at={[0,0,14.5]} palette={p} name="Paper"/>
      <Surface circle width={51.5} height={51.5} at={[0,0,15.03]} palette={p} deps={[p.paper,p.ink,value,i]} paint={c=>{c.fillStyle=p.paper;c.fillRect(0,0,51.5,51.5);c.fillStyle=p.ink;c.font='24px "DM Mono",monospace';c.fillText('ABC'[i],25.75,25.75);if(value&(1<<i)){c.fillStyle=p.accent;c.beginPath();c.arc(39,38,2.5,0,Math.PI*2);c.fill();}}}/>
      <mesh position={[0,0,15.12]} rotation={[Math.PI/2,0,0]} scale={[1,3/26,1]}><sphereGeometry args={[26,64,32,0,Math.PI*2,0,Math.PI/2]}/><Material name="Glass" palette={p}/></mesh>
    </Spring></Interactive>
    <Solid size={[40,14,2]} at={[0,-45,1]} palette={p}/>
    <EngravedText text={['INV','REC','JRN'][i]} width={38} height={12} at={[0,-45,2.04]} palette={p} dark/>
  </group>)}</group>;
}
function Voice({active,pressed,amount,palette:p,interaction}:Props){
  return <group><group position={[-87,0,0]}><Interactive interaction={interaction}>
    <Disc radius={32} height={8} at={[0,0,4]} name="Polished chrome" palette={p}/>
    <Spring position target={pressed?-4:0}>
      <Disc radius={28} height={8} at={[0,0,12]} name="Rubber" palette={p}/>
      {Array.from({length:24},(_,i)=><group key={i} rotation={[0,0,i*Math.PI/12]}><Solid size={[1,7,.7]} at={[0,23,16.3]} name="Rubber" palette={p} radius={.3}/></group>)}
      <Surface width={22} height={26} at={[0,0,16.05]} palette={p} engraved dark name="Rubber" deps={[p.paper]} paint={c=>{c.fillStyle='#222222';c.fillRect(0,0,22,26);c.strokeStyle=p.paper;c.lineWidth=1.4;c.beginPath();c.roundRect(8,3,6,11,3);c.moveTo(5,10);c.lineTo(5,12);c.arc(11,12,6,Math.PI,0,true);c.moveTo(11,18);c.lineTo(11,23);c.moveTo(7,23);c.lineTo(15,23);c.stroke();}}/>
    </Spring>
  </Interactive></group>
    <mesh position={[-46,0,9]}><sphereGeometry args={[3,24,16]}/><meshPhysicalMaterial color={active?p.accent:'#42211e'} emissive={p.accent} emissiveIntensity={active?3:0} roughness={.18}/></mesh>
    {active&&<pointLight position={[-46,0,15]} color={p.accent} intensity={6} distance={22} decay={2}/>}
    <group position={[38,0,0]}>
      <Solid size={[150,72,14]} at={[0,0,7]} palette={p} radius={3}/>
      <Solid size={[142,64,1]} at={[0,0,14.3]} name="Paper" palette={p}/>
      <Surface width={142} height={64} at={[0,0,14.9]} palette={p} deps={[p.paper,p.ink,p.accent]} paint={c=>{
        c.fillStyle=p.paper;c.fillRect(0,0,142,64);c.strokeStyle=p.ink;c.lineWidth=.8;c.beginPath();c.arc(71,61,47,Math.PI*1.1,Math.PI*1.9);c.stroke();
        c.strokeStyle=p.accent;c.beginPath();c.arc(71,61,47,Math.PI*1.72,Math.PI*1.9);c.stroke();
        for(let i=0;i<15;i++){const a=Math.PI*(1.1+i*.8/14);c.strokeStyle=i>10?p.accent:p.ink;c.beginPath();c.moveTo(71+Math.cos(a)*43,61+Math.sin(a)*43);c.lineTo(71+Math.cos(a)*48,61+Math.sin(a)*48);c.stroke();}
        c.font='7px "DM Mono",monospace';[['−20',18,40],['−10',45,17],['0',105,26],['+3',129,43]].forEach(([label,x,y])=>{c.fillStyle=Number(x)>100?p.accent:p.ink;c.fillText(String(label),Number(x),Number(y));});c.fillStyle=p.ink;c.font='9px "DM Mono",monospace';c.fillText('VU',71,48);
      }}/>
      <group position={[0,-28,16]}><Spring target={active?1.2566-amount*2.5132:1.2566} stiffness={220} damping={19}><Solid size={[.8,44,.5]} at={[0,22,0]} palette={p} radius={.2}/></Spring><Disc radius={2.5} height={1} palette={p} name="Black anodized"/></group>
      <GlassCover width={142} height={64} at={[0,0,18.2]} palette={p}/>
    </group>
  </group>;
}
function Lever({active,palette:p,interaction}:Props){
  return <Interactive interaction={interaction}><Solid size={[64,110,3]} at={[0,0,1.5]} palette={p} radius={2}/>
    <Disc radius={20} height={8} at={[0,0,7]} segments={6} name="Polished chrome" palette={p}/>
    <Annulus inner={8} outer={12} height={2} at={[0,0,11]} palette={p}/>
    <group position={[0,0,12]}><TactileRotation angle={(active?-35:35)*Math.PI/180} duration={60}>
      <mesh rotation={[Math.PI/2,0,0]} position={[0,0,22]} castShadow><cylinderGeometry args={[3,2,44,32]}/><meshPhysicalMaterial name="Satin steel" color="#b9bcb8" metalness={1} roughness={.45}/></mesh>
      <mesh position={[0,0,44]} castShadow><sphereGeometry args={[8,40,28]}/><Material name="Paper" palette={p} color="#f4f4ec"/></mesh>
    </TactileRotation></group>
    {[['ON',41],['OFF',-41]].map(([label,y])=><Surface key={label} width={38} height={16} at={[0,Number(y),3.3]} palette={p} name="Black anodized" deps={[]} paint={c=>{c.fillStyle='#1c1c1c';c.fillRect(0,0,38,16);c.fillStyle='#f4f4ec';c.font='bold 11px "DM Mono",monospace';c.fillText(String(label),19,8);}}/>)}
    <mesh position={[46,32,6]}><sphereGeometry args={[5,32,24]}/><meshPhysicalMaterial name="Pilot lamp glass" color={active?p.accent:'#3a3d39'} emissive={p.accent} emissiveIntensity={active?1.7:0} metalness={0} roughness={.15} clearcoat={1}/></mesh>
  </Interactive>;
}
function Rocker({active,palette:p,interaction}:Props){
  return <Interactive interaction={interaction}><RectangularFrame width={80} height={48} holeWidth={70} holeHeight={38} depth={8} palette={p} chrome/>
    <group position={[0,0,11]}><TactileRotation angle={(active?-8:8)*Math.PI/180} duration={60}><Solid size={[69,38,10]} palette={p} name="Rubber" radius={2}/>
      <Surface width={64} height={34} at={[0,0,5.3]} palette={p} name="Rubber" deps={[]} paint={c=>{c.fillStyle='#222222';c.fillRect(0,0,64,34);c.fillStyle='#f4f4ec';c.font='14px "DM Mono",monospace';c.fillText('I',32,8.5);c.fillText('O',32,25.5);}}/>
      {active&&<mesh position={[0,17.5,5.6]}><boxGeometry args={[60,3,.6]}/><meshPhysicalMaterial color={p.accent} roughness={.5}/></mesh>}
    </TactileRotation></group>
  </Interactive>;
}
function RectangularFrame({width,height,holeWidth,holeHeight,depth,palette:p,chrome=false}:{width:number;height:number;holeWidth:number;holeHeight:number;depth:number;palette:InstrumentPalette;chrome?:boolean}){
  const geometry=useMemo(()=>{const s=new Shape();s.moveTo(-width/2,-height/2);s.lineTo(width/2,-height/2);s.lineTo(width/2,height/2);s.lineTo(-width/2,height/2);s.closePath();const h=new Path();h.moveTo(-holeWidth/2,-holeHeight/2);h.lineTo(-holeWidth/2,holeHeight/2);h.lineTo(holeWidth/2,holeHeight/2);h.lineTo(holeWidth/2,-holeHeight/2);h.closePath();s.holes.push(h);return new ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:1,bevelThickness:1,bevelSegments:3});},[width,height,holeWidth,holeHeight,depth]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);return <mesh geometry={geometry} castShadow receiveShadow><Material name={chrome?'Polished chrome':'Black anodized'} palette={p}/></mesh>;
}
function NumberDrum({digit,x,palette:p,pressed}:{digit:number;x:number;palette:InstrumentPalette;pressed:boolean}){
  const map=useEngraving(counterDrum.atlasWidth,counterDrum.atlasHeight,c=>{c.fillStyle='#1c1c1c';c.fillRect(0,0,counterDrum.atlasWidth,counterDrum.atlasHeight);c.fillStyle=p.paper;c.font=`${counterDrum.fontSize}px "DM Mono",monospace`;for(let i=0;i<10;i++){c.save();c.translate(i*32+16,counterDrum.atlasHeight/2);c.rotate(counterDrum.textRotation);c.fillText(String(i),0,0);c.restore();}},[p.paper]);
  return <group position={[x,counterDrum.centerY,counterDrum.centerZ]} rotation={[0,0,Math.PI/2]}><Spring axis="y" target={pressed?-Math.PI/5:0} stiffness={440} damping={23}><mesh rotation={[0,counterDrumRotation(digit),0]} castShadow><cylinderGeometry args={[counterDrum.radius,counterDrum.radius,counterDrum.width,128,1,true]}/><Material name="Black anodized" palette={p} map={map} color="#ffffff"/></mesh></Spring></group>;
}
function CounterAperture({palette}:{palette:InstrumentPalette}){
  const geometry=useMemo(createCounterApertureGeometry,[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} position={[-12,0,17.15]} receiveShadow><Material name="Black anodized" palette={palette}/></mesh>;
}
function Tally({amount,pressed,palette:p,interaction}:Props){
  return <group><Solid size={[200,90,2]} at={[0,0,-34]} palette={p}/>
    <group position={[-12,0,0]}><RectangularFrame width={176} height={90} holeWidth={124} holeHeight={58} depth={16} palette={p}/></group>
    <Solid size={[24,90,16]} at={[88,0,8]} palette={p}/><NumberDrum digit={(Math.floor(amount/10)+Math.max(0,amount%10-9))%10} x={-41} palette={p} pressed={pressed}/><NumberDrum digit={amount%10} x={11} palette={p} pressed={pressed}/>
    <CounterAperture palette={p}/>
    <GlassCover width={124} height={58} at={[-12,0,19]} palette={p}/>
    <Interactive interaction={interaction}><Spring position target={pressed?-4:0}><Disc radius={11} height={7} at={[82,30,20]} name="Polished chrome" palette={p}/></Spring></Interactive>
  </group>;
}
function Tray({width=280,height=250,palette:p}:Props){
  const w=width-24,h=height-24;
  return <group><Solid size={[w,h,2]} at={[0,0,1]} palette={p} name="Paper"/>
    <Surface width={w-8} height={h-8} at={[0,0,2.04]} palette={p} deps={[p.paper,p.ink,w,h]} paint={c=>{c.fillStyle=p.paper;c.fillRect(0,0,w-8,h-8);c.strokeStyle=p.ink;c.lineWidth=.75;for(const x of[12,w-20])for(const y of[12,h-20]){c.beginPath();c.moveTo(x+(x===12?12:-12),y);c.lineTo(x,y);c.lineTo(x,y+(y===12?12:-12));c.stroke();}}}/>
    <Solid size={[w+4,3,6]} at={[0,h/2,3]} palette={p} radius={.8}/><Solid size={[w+4,3,6]} at={[0,-h/2,3]} palette={p} radius={.8}/>
    <Solid size={[3,h,6]} at={[-w/2,0,3]} palette={p} radius={.8}/><Solid size={[3,h,6]} at={[w/2,0,3]} palette={p} radius={.8}/>
  </group>;
}
function Drawer({width=560,height=360,count,value,amount,palette:p,labels,interaction}:Props){
  const w=width-40,h=height-40;
  return <group><Solid size={[w,h,3]} at={[0,0,1.5]} palette={p}/><Solid size={[w-8,h-8,1]} at={[0,0,3.5]} palette={p} name="Paper"/>
    <Solid size={[w,4,12]} at={[0,h/2,6]} palette={p}/><Solid size={[w,4,12]} at={[0,-h/2,6]} palette={p}/><Solid size={[4,h,12]} at={[-w/2,0,6]} palette={p}/><Solid size={[4,h,12]} at={[w/2,0,6]} palette={p}/>
    {Array.from({length:Math.min(count,6)},(_,i)=><group key={labels?.[i]??i} position={[0,40-i*28,5+i*1.3]}><Interactive interaction={interaction} index={i}><Spring position target={value===i?(amount===2?75:14):0} stiffness={340} damping={25}>
      <Solid size={[w-26,200,1]} palette={p} name="Paper" at={[0,0,.5]} radius={.4}/>
      <Solid size={[w-38,24,1]} palette={p} name="Paper" at={[0,106,.5]} radius={.4}/>
      <Surface width={w-42} height={20} at={[0,106,1.04]} palette={p} deps={[labels?.[i],p.paper,p.ink,w]} paint={c=>{c.fillStyle=p.paper;c.fillRect(0,0,w-42,20);c.fillStyle=p.ink;c.textAlign='left';c.font='10px "DM Mono",monospace';c.fillText(labels?.[i]??'',10,10,w-62);}}/>
    </Spring></Interactive></group>)}
    {!count&&<><Solid size={[w-28,h-30,1]} at={[0,0,5]} name="Paper" palette={p}/><Surface width={w-50} height={30} at={[0,0,5.6]} palette={p} deps={[p.paper,p.ink,w]} paint={c=>{c.fillStyle=p.paper;c.fillRect(0,0,w-50,30);c.fillStyle=p.ink;c.fillText('NO CASES YET',(w-50)/2,15);}}/></>}
    {(amount===1||amount===3)&&<Spring position target={amount===1?30:100}><Solid size={[w-30,200,1]} at={[0,0,5]} name="Paper" palette={p}/></Spring>}
  </group>;
}
function Swatch({value,active,palette:p,colors=[],labels=[],swatch,interaction,width=560}:Props){
  const order=swatch?.order??colors.map((_,i)=>i),reduced=swatch?.reduced??false,phase=swatch?.phase??(active?'open':'closed'),highlight=swatch?.highlight??-1,scale=width/560;
  const center=swatchMotionCenter(reduced,Math.max(1,order.length));
  const settled=useRef(new Set<number>()),currentPhase=useRef(phase);currentPhase.current=phase;
  useEffect(()=>{settled.current.clear();},[phase]);
  return <group scale={scale}><group position={[-center.x,-center.y,0]}>
    {[...order].reverse().map(i=>{const rank=order.indexOf(i),strip=colors[i]??[p.paper,p.ink,p.accent],selected=value===i,open=phase==='open'||phase==='select',selecting=phase==='select'&&swatch?.closingSelection===i;
      return <group key={i} position={[reduced?0:rank,reduced?-rank*67:-rank,(order.length-rank)*1.4+(selecting?12:0)]}>
        <Spring motionKey={phase} target={reduced?0:selecting?0:open?rank*11*Math.PI/180:0} delay={reduced?0:(open?rank:order.length-1-rank)*30} stiffness={!open?1800:selecting?900:430} damping={!open?76:selecting?52:29} settleWithinMs={phase==='closing'?SWATCH_CLOSE_MS:SWATCH_SELECTION_MS} onRest={()=>{if(currentPhase.current!=='closing')return;settled.current.add(i);if(settled.current.size===order.length)interaction?.onSettled?.();}}>
          <Spring position axis="x" stiffness={open?340:1800} damping={open?27:76} settleWithinMs={phase==='closing'?SWATCH_CLOSE_MS:SWATCH_SELECTION_MS} target={!reduced&&highlight===i&&open?16:0}><Spring position stiffness={open?340:1800} damping={open?27:76} settleWithinMs={phase==='closing'?SWATCH_CLOSE_MS:SWATCH_SELECTION_MS} target={highlight===i&&open?4:0}>
            <Interactive interaction={interaction} index={i}><group position={[190,0,0]}>
              <Solid size={[420,56,1]} palette={{...p,paper:strip[0]}} name="Paper" at={[0,0,.5]} radius={.3}/>
              <Surface width={420} height={56} at={[0,0,1.04]} palette={{...p,paper:strip[0]}} deps={[...strip,labels[i],selected]} paint={c=>{
                c.fillStyle=strip[0];c.fillRect(0,0,420,56);strip.slice(0,3).forEach((color,j)=>{c.fillStyle=color;c.fillRect(24+j*64,8,64,40);});c.fillStyle=strip[1];c.font='10px "DM Mono",monospace';c.textAlign='right';c.fillText(labels[i]??'',392,28,172);if(selected){c.fillStyle=p.accent;c.beginPath();c.arc(408,28,2.5,0,Math.PI*2);c.fill();}
              }}/>
            </group></Interactive>
          </Spring></Spring>
        </Spring>
      </group>;
    })}
    {!reduced&&<Disc radius={7} height={3} at={[0,0,order.length*1.4+3]} palette={p} name="Polished chrome"/>}
  </group></group>;
}
function HomepageLoupe({active,palette:p,interaction,width=160,height=160}:Props){
  const rendered=useContext(RenderedMesh);
  const resources=useMemo(()=>{
    const geometries:BufferGeometry[]=[],materials=[
      new MeshPhysicalMaterial(instrumentMaterial('Black anodized',p.paper)),
      new MeshPhysicalMaterial(instrumentMaterial('Polished chrome',p.paper)),
      new MeshPhysicalMaterial({color:p.accent,metalness:.2,roughness:.45}),
      new MeshPhysicalMaterial(instrumentMaterial('Rubber',p.paper)),
      new MeshPhysicalMaterial(instrumentMaterial('Black anodized',p.paper)),
      new MeshPhysicalMaterial({...instrumentMaterial('Glass',p.paper),opacity:.24}),
    ];
    const assembly=createLoupeAssembly({dark:materials[0],steel:materials[1],red:materials[2],grip:materials[3],bracket:materials[4],glass:materials[5]},<T extends BufferGeometry>(g:T)=>{geometries.push(g);return g;});
    return {...assembly,geometries,materials};
  },[p.paper,p.ink,p.accent]);
  useEffect(()=>{resources.loupe.traverse(object=>{if(object instanceof Mesh)object.onAfterRender=rendered;});},[resources,rendered]);
  useEffect(()=>()=>{resources.geometries.forEach(g=>g.dispose());resources.materials.forEach(m=>m.dispose());},[resources]);
  return <group position={[0,0,15]} scale={.38*Math.min(width/160,height/160)}><Interactive interaction={interaction}><Spring position target={active?8:0}><primitive object={resources.loupe}/></Spring></Interactive>{!active&&<primitive object={resources.holder} position={[0,-28,-13]} scale={.85}/>}</group>;
}
