import {useEffect,useRef,type KeyboardEvent} from 'react';
import {InstrumentView} from './InstrumentKit';
import {deskSound} from '@/lib/desk-sound';
import {clampSelectorAngle,caughtDeskAngle,createSelectorMotion,crossedDeskDetents,nearestDeskDetent,selectorStop,startSelectorMotion,unwrappedPointer} from '@/lib/desk-selector';

const options=[{label:'Investigations',description:'Original images you are looking into.'},{label:'Recreation',description:'Personal, travel, or leisure photos.'},{label:'Journalism',description:'Reporting images and visual leads.'}];
export function DeskSelector({value,onChange,disabled=false}:{value:number;onChange:(index:number)=>void;disabled?:boolean}){
  const motion=useRef(createSelectorMotion(value)),current=useRef({value,onChange,disabled}),radios=useRef<(HTMLButtonElement|null)[]>([]);
  const drag=useRef({held:false,pointer:0,unwrapped:0,stop:0});
  current.current={value,onChange,disabled};
  const redraw=()=>window.dispatchEvent(new Event('whereabouts:instrument-motion'));
  const choose=(index:number,duration=120,curve:'out'|'in-out'='in-out')=>{if(current.current.disabled)return;startSelectorMotion(motion.current,index,performance.now(),matchMedia('(prefers-reduced-motion: reduce)').matches?0:duration,curve);current.current.onChange(index);redraw();};
  useEffect(()=>{if(motion.current.index!==value){startSelectorMotion(motion.current,value,performance.now(),120,'in-out');redraw();}},[value]);
  const turn=(angle:number,phase:'start'|'move'|'end'|'click')=>{
    const state=drag.current;if(phase==='click')return;
    if(current.current.disabled){state.held=false;return;}
    if(phase==='end'){state.held=false;state.stop=0;choose(nearestDeskDetent(motion.current.angle),70,'out');return;}
    if(phase==='start'){state.held=true;state.pointer=angle;state.unwrapped=angle;state.stop=0;}
    else{if(!state.held)return;state.unwrapped+=unwrappedPointer(state.pointer,angle);state.pointer=angle;}
    const raw=state.unwrapped,previous=motion.current.angle,next=caughtDeskAngle(raw),{stop,thock}=selectorStop(raw,state.stop);
    if(thock)deskSound('stop');state.stop=stop;
    for(const index of crossedDeskDetents(previous,next))if(!(stop<0&&index===0||stop>0&&index===2))deskSound('detent');
    motion.current.angle=next;motion.current.target=clampSelectorAngle(raw);motion.current.mode='drag';redraw();
  };
  const key=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();if(event.repeat)return;
    const next=event.key==='Home'?0:event.key==='End'?2:Math.max(0,Math.min(2,index+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)));
    if(next===index){deskSound('stop');return;}choose(next);radios.current[next]?.focus({preventScroll:true});
  };
  return <div className="physical-footprint physical-dial" data-control="Desk selector" data-testid="dial-desk" role="radiogroup" aria-label="Choose photo field desk">
    <InstrumentView kind="dial" value={value} selector={motion} interaction={{disabled,onTurn:turn,onCancel:()=>{drag.current.held=false;choose(current.current.value,70,'out');}}}/>
    {options.map((option,index)=><button key={option.label} ref={node=>{radios.current[index]=node;}} type="button" role="radio" aria-checked={value===index} disabled={disabled} tabIndex={value===index?0:-1} className="desk-selector-radio" data-testid={`button-selector-desk-${index}`} onKeyDown={event=>key(event,index)} onClick={()=>choose(index)}>{option.label}<i aria-hidden="true"/></button>)}
    <ul className="desk-selector-legend" data-testid="list-desk-descriptions">{options.map((option,index)=><li key={option.label} data-active={value===index}><strong>{option.label}</strong><span data-testid={`text-desk-description-${index}`}>{option.description}</span></li>)}</ul>
  </div>;
}
