import {useEffect,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Group} from 'three';
import {Solid,Surface} from './instrument-meshes';
import type {InstrumentPalette} from './physical-models';
import {useReducedInstrumentMotion} from '@/hooks/use-instrument-motion';
import {countDigits,createFlapState,flapPose,FLAP_SETTLE_MS,FLAP_SNAP_MS,requestFlap,settleFlap,type FlapState} from '@/lib/split-flap';
import {deskSound} from '@/lib/desk-sound';

function Half({digit,top,palette:p,reverse=false}:{digit:string;top:boolean;palette:InstrumentPalette;reverse?:boolean}){
  return <group position={[0,top?26:-26,0]} rotation={reverse?[Math.PI,0,0]:undefined}>
    <Solid size={[69,51.6,.7]} palette={p} name="Rubber" radius={.8}/>
    <Surface width={68.8} height={51.4} at={[0,0,.4]} palette={p} name="Rubber" deps={[digit,top]} paint={c=>{
      c.fillStyle='#171b1a';c.fillRect(0,0,68.8,51.4);c.fillStyle='#f8faf7';c.font='bold 104px "DM Sans",sans-serif';c.textBaseline='middle';c.textAlign='center';c.fillText(digit,34.4,(reverse?!top:top)?51.4:0,64);
    }}/>
  </group>;
}
function Digit({digit,palette:p,sound}:{digit:string;palette:InstrumentPalette;sound:boolean}){
  const reduced=useReducedInstrumentMotion(),invalidate=useThree(s=>s.invalidate);
  const[state,setState]=useState<FlapState>(()=>createFlapState(digit)),motion=useRef(state),upper=useRef<Group>(null),lower=useRef<Group>(null),oldLower=useRef<Group>(null),soundPlayed=useRef(false);
  useEffect(()=>{const next=requestFlap(motion.current,digit,performance.now(),reduced);motion.current=next;setState(next);invalidate();},[digit,reduced,invalidate]);
  useFrame(()=>{
    const previous=motion.current,next=settleFlap(previous,performance.now());
    if(next!==previous){motion.current=next;setState(next);soundPlayed.current=false;}
    const elapsed=performance.now()-next.started,pose=flapPose(elapsed,reduced);
    if(upper.current){upper.current.visible=next.moving&&!pose.settled&&pose.falling;upper.current.rotation.x=pose.upper;}
    if(lower.current){lower.current.visible=next.moving&&pose.following&&!pose.settled;lower.current.rotation.x=pose.lower;lower.current.position.z=3.2-2.2*Math.min(1,Math.max(0,(elapsed-FLAP_SNAP_MS)/(FLAP_SETTLE_MS-FLAP_SNAP_MS)));}
    if(oldLower.current)oldLower.current.visible=next.moving&&!pose.settled&&elapsed<FLAP_SNAP_MS;
    if(next.moving&&!reduced){if(elapsed>=FLAP_SNAP_MS&&!soundPlayed.current){soundPlayed.current=true;if(sound)deskSound('flap');}invalidate();}
  });
  return <group>
    <Solid size={[76,115,3]} at={[0,0,-1.5]} palette={p} radius={1}/>
    <group position={[0,0,1]}><Half digit={state.to} top palette={p}/><Half digit={state.to} top={false} palette={p}/></group>
    <group ref={oldLower} visible={false} position={[0,0,2]}><Half digit={state.from} top={false} palette={p}/></group>
    <group ref={upper} visible={false} position={[0,0,3]}>
      <Half digit={state.from} top palette={p}/>
      <group position={[0,0,-.9]}><Half digit={state.to} top palette={p} reverse/></group>
    </group>
    <group ref={lower} visible={false} position={[0,0,3.2]}><Half digit={state.to} top={false} palette={p}/></group>
    <Solid size={[69,.7,.65]} at={[0,0,4]} palette={p} name="Rubber" radius={.15}/>
    {[-30,30].map(x=><group key={x} position={[x,0,4]}><Solid size={[7,9,4]} palette={p} radius={1}/><mesh rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[2.5,2.5,8,20]}/><meshPhysicalMaterial color="#111514" roughness={.4} metalness={.5}/></mesh></group>)}
  </group>;
}
export function SplitFlapModel({value,label,palette:p,width=280,height=210}:{value:number;label:string;palette:InstrumentPalette;width?:number;height?:number}){
  const digits=countDigits(value),w=digits.length*80+24,scale=Math.min((width-16)/w,(height-20)/164);
  return <group scale={scale}>
    <Solid size={[w,164,18]} at={[0,-5,-9]} palette={p} radius={4}/>
    <Solid size={[w-10,151,1]} at={[0,-3,.6]} palette={p} name="Rubber" radius={2}/>
    <Solid size={[w,10,16]} at={[0,72,5]} palette={p} radius={2}/>
    <Solid size={[w,32,16]} at={[0,-66,5]} palette={p} radius={2}/>
    {[-1,1].map(side=><Solid key={side} size={[12,138,16]} at={[side*(w/2-6),-1,5]} palette={p} radius={2}/>)}
    {Array.from({length:digits.length-1},(_,i)=><Solid key={i} size={[4,119,13]} at={[(i+1-digits.length/2)*80,10,5]} palette={p} radius={.6}/>)}
    {digits.split('').map((digit,i)=><group key={`${digits.length-i}`} position={[(i-(digits.length-1)/2)*80,10,2]}><Digit digit={digit} palette={p} sound/></group>)}
    <Surface width={w-26} height={15} at={[0,-67,13.1]} palette={p} name="Rubber" deps={[label,w]} paint={c=>{
      c.fillStyle='#171b1a';c.fillRect(0,0,w-20,15);c.fillStyle='#e7e9e1';c.font='7px "DM Mono",monospace';c.textAlign='left';c.fillText(label.toUpperCase(),4,7.5,w-44);c.fillStyle=p.accent;c.fillRect(w-30,5.5,4,4);
    }}/>
  </group>;
}
