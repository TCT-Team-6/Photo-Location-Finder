import {useEffect,useMemo} from 'react';
import {Color,ExtrudeGeometry,Shape} from 'three';
import {Solid} from './instrument-meshes';
import type {InstrumentPalette} from './physical-models';
import {FONT_KNOB_RADIUS,fontSliderMetrics,fontSliderPosition} from '@/lib/font-slider';

export function FontSliderModel({value,width=320,palette:p}:{value:number;width?:number;palette:InstrumentPalette}){
  const {travel}=fontSliderMetrics(width);
  const railPalette={...p,paper:new Color(p.paper).lerp(new Color(p.ink),.24).getStyle()};
  const knob=useMemo(()=>{
    const shape=new Shape();shape.absarc(0,0,FONT_KNOB_RADIUS-.8,0,Math.PI*2,false);
    return new ExtrudeGeometry(shape,{depth:3.6,bevelEnabled:true,bevelSize:.8,bevelThickness:.8,bevelSegments:3,curveSegments:48});
  },[]);
  useEffect(()=>()=>knob.dispose(),[knob]);
  return <group>
    <Solid size={[travel+FONT_KNOB_RADIUS*2,1.6,1]} at={[0,0,.6]} palette={railPalette} name="Paper" radius={.49}/>
    <mesh geometry={knob} position={[fontSliderPosition(value,travel),0,1]} castShadow receiveShadow>
      <meshPhysicalMaterial name="Matte text-size knob" color={p.ink} roughness={.88} metalness={.03}/>
    </mesh>
  </group>;
}
