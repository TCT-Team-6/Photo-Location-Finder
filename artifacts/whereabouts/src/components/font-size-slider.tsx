import {useRef,useState} from 'react';
import {InstrumentView} from './InstrumentKit';
import {fontSliderValue} from '@/lib/font-slider';
import {TEXT_SIZE_MAX,TEXT_SIZE_MIN,TEXT_SIZE_STEP,textSizeKey,validTextSize} from '@/lib/app-preferences';

export function FontSizeSlider({value,onChange}:{value:number;onChange:(value:number)=>void}){
  const[dragging,setDragging]=useState(false),pointer=useRef<number|null>(null),latest=useRef(value);
  latest.current=validTextSize(value);
  const change=(next:number)=>{if(next!==latest.current){latest.current=next;onChange(next);}};
  const fromPointer=(clientX:number,node:HTMLDivElement)=>{const rect=node.getBoundingClientRect();change(fontSliderValue(clientX,rect.left,rect.width,rect.height));};
  const release=(node:HTMLDivElement)=>{if(pointer.current!==null&&node.hasPointerCapture(pointer.current))node.releasePointerCapture(pointer.current);pointer.current=null;setDragging(false);};
  return <div className="fd-text-size">
    <div className="fd-text-size-heading"><h3 id="text-size-label">Text size</h3><output id="text-size-value" data-testid="text-size-value">{value}%</output></div>
    <div className="physical-footprint physical-font-slider" role="slider" tabIndex={0} aria-labelledby="text-size-label" aria-describedby="text-size-help" aria-valuemin={TEXT_SIZE_MIN} aria-valuemax={TEXT_SIZE_MAX} aria-valuenow={value} aria-valuetext={`${value} percent`} aria-orientation="horizontal" data-testid="slider-text-size" data-dragging={dragging} data-step={TEXT_SIZE_STEP}
      onPointerDown={event=>{if(event.button!==0||pointer.current!==null)return;event.preventDefault();event.currentTarget.focus({preventScroll:true});pointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);fromPointer(event.clientX,event.currentTarget);}}
      onPointerMove={event=>{if(pointer.current===event.pointerId)fromPointer(event.clientX,event.currentTarget);}}
      onPointerUp={event=>{if(pointer.current===event.pointerId){fromPointer(event.clientX,event.currentTarget);release(event.currentTarget);}}}
      onPointerCancel={event=>{if(pointer.current===event.pointerId)release(event.currentTarget);}}
      onLostPointerCapture={()=>{pointer.current=null;setDragging(false);}}
      onKeyDown={event=>{const next=textSizeKey(latest.current,event.key);if(next!==null){event.preventDefault();change(next);}}}>
      <InstrumentView kind="fontslider" value={value}/>
    </div>
    <div className="fd-text-size-footer"><p id="text-size-help">100–150%, in 5% steps. Text changes across the app; instruments stay their original size.</p><button type="button" className="fd-text-size-reset" data-testid="button-reset-text-size" disabled={value===100} onClick={()=>change(100)}>Reset to 100%</button></div>
  </div>;
}
