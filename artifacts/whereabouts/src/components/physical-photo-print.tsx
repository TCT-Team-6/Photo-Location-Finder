import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Texture } from 'three';
import { createLiveCanvasTexture } from '@/lib/live-canvas-texture';
import type { InstrumentPalette } from './physical-models';
/** A private, local-only photo card. Each upload allocation is immutable. */
export function PhysicalPhotoPrint({file,palette,onRendered}:{file:File;palette:InstrumentPalette;onRendered:()=>void}){
  const[texture,setTexture]=useState<Texture|null>(null),group=useRef<Group>(null),velocity=useRef(-2),entered=useRef(false),gl=useThree(s=>s.gl),invalidate=useThree(s=>s.invalidate);
  useEffect(()=>{
    let disposed=false;const image=new Image(),url=URL.createObjectURL(file),placeholder=new Texture(),uniform={value:placeholder},upload=createLiveCanvasTexture(uniform,t=>gl.initTexture(t));
    image.onload=()=>{if(disposed)return;const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle=palette.paper;ctx.fillRect(0,0,1024,768);const scale=Math.min(944/image.naturalWidth,668/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;ctx.drawImage(image,(1024-w)/2,(768-h)/2,w,h);setTexture(upload.update(canvas));invalidate();};
    image.onerror=()=>{if(disposed)return;const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=768;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle=palette.paper;ctx.fillRect(0,0,1024,768);ctx.fillStyle=palette.ink;ctx.font='40px "DM Mono",monospace';ctx.textAlign='center';ctx.fillText('Preview unavailable',512,370);ctx.font='28px "DM Mono",monospace';ctx.fillText('The original file is kept.',512,430);setTexture(upload.update(canvas));invalidate();};
    image.src=url;return()=>{disposed=true;image.onload=null;image.onerror=null;URL.revokeObjectURL(url);upload.dispose();placeholder.dispose();};
  },[file,palette.paper,palette.ink,gl,invalidate]);
  useFrame((_,elapsed)=>{
    const node=group.current;if(!node||!texture)return;
    if(!entered.current){entered.current=true;node.position.z=matchMedia('(prefers-reduced-motion: reduce)').matches?0:44;}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){node.position.z=0;return;}
    const dt=Math.min(.025,elapsed);velocity.current+=(-node.position.z*230-velocity.current*22)*dt;node.position.z+=velocity.current*dt;
    if(Math.abs(node.position.z)+Math.abs(velocity.current)>.001)invalidate();else node.position.z=0;
  });
  return <group ref={group}>
    <mesh castShadow receiveShadow><boxGeometry args={[112,84,1]}/><meshPhysicalMaterial name="Paper" color={palette.paper} metalness={0} roughness={.85}/></mesh>
    {texture&&<mesh position={[0,0,.8]} onAfterRender={onRendered}><planeGeometry args={[111.8,83.8]}/><meshPhysicalMaterial name="Paper / photo print" map={texture} metalness={0} roughness={.85} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>}
  </group>;
}
