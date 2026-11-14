import { useEffect, useRef } from 'react';
import { advanceCursorFeedback, createCursorFeedback } from '@/lib/lens-feedback';

/** Pointer-only progressive enhancement. No application/auth/data dependencies. */
export function SiteCursor() {
  const dotRef=useRef<HTMLDivElement>(null),ringRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const dot=dotRef.current,ring=ringRef.current;if(!dot||!ring)return;
    const fine=matchMedia('(hover: hover) and (pointer: fine)'),motion=matchMedia('(prefers-reduced-motion: reduce)');
    let x=0,y=0,rx=0,ry=0,frame=0,initialized=false,visible=false,held=false,interactive=false,input=false;
    const feedback=createCursorFeedback();let lastTime=0;
    const photoAt=()=>{const photo=document.querySelector('[data-testid="inspection-photo"]')?.getBoundingClientRect();return !!photo&&x>=photo.left&&x<photo.right&&y>=photo.top&&y<photo.bottom;};
    const paint=(now:number)=>{
      frame=0;
      if(!fine.matches)return;
      const delta=lastTime?Math.max(0,(now-lastTime)/1000):1/60;lastTime=now;
      const gain=motion.matches?1:.15;rx+=(x-rx)*gain;ry+=(y-ry)*gain;
      const photo=photoAt();
      const animating=advanceCursorFeedback(feedback,{visible:visible&&!input,interactive,held,photo},delta,motion.matches);
      const size=feedback.size.position,scale=size/36,mix=feedback.color.value;
      dot.style.transform=`translate3d(${x-3}px,${y-3}px,0) scale(${motion.matches?1:feedback.dot.value})`;dot.style.opacity=String(feedback.dot.value);
      ring.style.transform=`translate3d(${rx-18}px,${ry-18}px,0) scale(${scale})`;ring.style.borderWidth=`${1/scale}px`;
      ring.style.borderColor=`rgb(${[36,39,35].map((value,index)=>Math.round(value+([244,244,242][index]-value)*mix)).join(' ')})`;ring.style.opacity=String(feedback.ring.value);
      ring.dataset.cursorState=held?'held':input?'text':interactive?'interactive':'default';ring.dataset.cursorSurface=photo?'photo':'page';
      ring.dataset.cursorSize=size.toFixed(3);ring.dataset.cursorColorMix=mix.toFixed(3);dot.dataset.cursorAlpha=feedback.dot.value.toFixed(3);
      if(animating||Math.abs(rx-x)+Math.abs(ry-y)>.08)frame=requestAnimationFrame(paint);
    };
    const request=()=>{if(!frame){lastTime=0;frame=requestAnimationFrame(paint);}};
    const updateTarget=(target:EventTarget|null)=>{
      const element=target instanceof Element?target:null;
      interactive=!!element?.closest('a,button,[role="button"],summary,select');
      input=!!element?.closest('input,textarea,[contenteditable="true"],[role="textbox"]');
    };
    const move=(event:PointerEvent)=>{
      if(event.pointerType==='touch'||!fine.matches)return;
      visible=true;x=event.clientX;y=event.clientY;
      if(!initialized){rx=x;ry=y;initialized=true;}
      updateTarget(event.target);
      dot.style.transform=`translate3d(${x-3}px,${y-3}px,0) scale(${motion.matches?1:feedback.dot.value})`;request();
    };
    const leave=()=>{visible=false;request();};
    const hover=(event:PointerEvent)=>{updateTarget(event.target);request();};
    const mode=(event:Event)=>{held=(event as CustomEvent<string>).detail==='held';request();};
    const scroll=()=>{updateTarget(document.elementFromPoint(x,y));request();};
    const availability=()=>{document.documentElement.classList.toggle('wa-custom-cursor-active',fine.matches);if(!fine.matches){dot.style.opacity=ring.style.opacity='0';cancelAnimationFrame(frame);frame=0;}else request();};
    availability();
    document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerover',hover,{passive:true});
    document.documentElement.addEventListener('pointerleave',leave);window.addEventListener('blur',leave);window.addEventListener('scroll',scroll,{passive:true});
    window.addEventListener('whereabouts:loupe-mode',mode);fine.addEventListener('change',availability);motion.addEventListener('change',request);
    return()=>{cancelAnimationFrame(frame);document.documentElement.classList.remove('wa-custom-cursor-active');document.removeEventListener('pointermove',move);document.removeEventListener('pointerover',hover);document.documentElement.removeEventListener('pointerleave',leave);window.removeEventListener('blur',leave);window.removeEventListener('scroll',scroll);window.removeEventListener('whereabouts:loupe-mode',mode);fine.removeEventListener('change',availability);motion.removeEventListener('change',request);};
  },[]);
  return <><div ref={dotRef} className="wa-site-cursor-dot" aria-hidden="true" data-testid="site-cursor-dot"/><div ref={ringRef} className="wa-site-cursor-ring" aria-hidden="true" data-testid="site-cursor-ring"/></>;
}
