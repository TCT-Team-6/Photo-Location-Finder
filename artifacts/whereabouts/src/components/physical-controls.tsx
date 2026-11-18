import {useEffect,useRef,useState,type ButtonHTMLAttributes,type MutableRefObject} from 'react';
import {Link,useLocation} from 'wouter';
import {InstrumentView as PhysicalView} from './InstrumentKit';
import {deskSound} from '@/lib/desk-sound';
import {toggleDeskFilter} from '@/lib/desk-filters';
import {useReducedInstrumentMotion} from '@/hooks/use-instrument-motion';
import {crossfadeInstrumentTheme} from '@/lib/instrument-theme-transition';
import type {SwatchMotion} from './physical-models';
import {feedbackSpring} from '@/lib/lens-feedback';
import {activateInstrumentButton,SWATCH_SELECTION_MS,SWATCH_SELECTED_RETURN_MS,SWATCH_THEME_FADE_MS} from '@/lib/instrument-interaction';

export function ShutterButton(props:ButtonHTMLAttributes<HTMLButtonElement>){
  const[pressed,setPressed]=useState(false),button=useRef<HTMLButtonElement>(null),down=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  const press=(next:boolean)=>{if(next){down.current=performance.now();setPressed(true);}else timers.current.push(setTimeout(()=>setPressed(false),Math.max(0,80-(performance.now()-down.current))));};
  const activate=()=>{timers.current.push(setTimeout(()=>button.current?.click(),Math.max(0,80-(performance.now()-down.current))));};
  useEffect(()=>{if(props.disabled)setPressed(false);},[props.disabled]);
  return <div className="physical-footprint physical-shutter" data-control="Investigation shutter">
    <PhysicalView kind="shutter" pressed={pressed} interaction={{disabled:props.disabled,onPress:press,onSelect:activate}}/>
    <button {...props} ref={button} className="physical-accessible" onKeyDown={e=>{props.onKeyDown?.(e);if(['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)press(true);}}} onKeyUp={e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();press(false);activate();}}} onBlur={()=>setPressed(false)}/>
  </div>;
}
export function TallyCounter({value,label}:{value:number;label:string}){
  const[pressed,setPressed]=useState(false),[displayed,setDisplayed]=useState(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),reduced=useReducedInstrumentMotion();
  useEffect(()=>{if(reduced){setDisplayed(value);return;}let frame=0,start=0,last=0,motion={position:0,velocity:0};const roll=(now:number)=>{if(!start)start=now;const dt=last?Math.min(.032,(now-last)/1000):.016;last=now;motion=feedbackSpring(motion,value,dt,340,30);if(now-start>=580){setDisplayed(value);return;}setDisplayed(Math.max(0,motion.position));frame=requestAnimationFrame(roll);};frame=requestAnimationFrame(roll);return()=>cancelAnimationFrame(frame);},[value,reduced]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const check=()=>{deskSound('detent');setPressed(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setPressed(false),150);};
  return <div className="physical-footprint physical-tally" data-control={label}><PhysicalView kind="tally" value={value} amount={displayed} pressed={pressed} interaction={{onPress:setPressed,onSelect:check}}/>
    <button type="button" className="physical-accessible" aria-label={`${label}: ${value}. Check the counter; value does not change.`} data-testid={`button-counter-${label.toLowerCase().replaceAll(' ','-')}`} onClick={check} onKeyDown={e=>{if(['Enter',' '].includes(e.key))setPressed(true);}} onKeyUp={()=>setPressed(false)}/><span className="sr-only">{value} {label}</span>
  </div>;
}
export function DeskFilterKeys({value,onChange}:{value:number;onChange:(value:number)=>void}){
  const[focused,setFocused]=useState(0),refs=useRef<(HTMLButtonElement|null)[]>([]);
  const toggle=(i:number)=>{deskSound('switch');onChange(toggleDeskFilter(value,i));};
  return <div className="physical-footprint physical-keys" role="group" aria-label="Filter library by desk" data-control="Library desk filter">
    <PhysicalView kind="keys" value={value} interaction={{onSelect:toggle}}/>
    {['Investigations','Recreation','Journalism'].map((label,i)=><button key={label} ref={node=>{refs.current[i]=node;}} type="button" className="physical-accessible" role="checkbox" aria-checked={Boolean(value&(1<<i))} aria-label={label} tabIndex={focused===i?0:-1} data-testid={`button-filter-desk-${i}`} onFocus={()=>setFocused(i)} onClick={()=>toggle(i)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;refs.current[next]?.focus();}}}/>)}
  </div>;
}
export function PhysicalSwitch({kind,value,onChange,label,testId}:{kind:'lever'|'rocker';value:boolean;onChange:(next:boolean)=>void;label:string;testId?:string}){
  const flip=()=>{onChange(!value);if(kind!=='rocker')deskSound('switch');};
  return <div className={`physical-footprint physical-${kind}`} data-control={label}>
    <PhysicalView kind={kind} active={value} interaction={{onSelect:flip}}/><button type="button" className="physical-accessible" role="switch" aria-checked={value} aria-label={label} data-testid={testId} onClick={event=>{event.stopPropagation();flip();}} onKeyDown={event=>activateInstrumentButton(event,'down')} onKeyUp={event=>activateInstrumentButton(event,'up')}/>
  </div>;
}
export function FileDrawer({items,createRef}:{items:{id:string;title:string}[];createRef?:MutableRefObject<(()=>Promise<void>)|null>}){
  const[focused,setFocused]=useState(0),[hovered,setHovered]=useState<number|null>(null),[page,setPage]=useState(0),[opening,setOpening]=useState(false),[creating,setCreating]=useState(0),[,navigate]=useLocation();
  const root=useRef<HTMLDivElement>(null),refs=useRef<(HTMLButtonElement|null)[]>([]),current=useRef(0),touch=useRef(0),timers=useRef<ReturnType<typeof setTimeout>[]>([]),alive=useRef(true),reduced=useReducedInstrumentMotion();
  current.current=focused;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;timers.current.forEach(clearTimeout);};},[]);
  if(createRef)createRef.current=async()=>{if(reduced)return;setCreating(1);await new Promise<void>(resolve=>{timers.current.push(setTimeout(()=>{if(alive.current)setCreating(3);},220));timers.current.push(setTimeout(resolve,460));});};
  const choose=(local:number)=>{const i=page*6+local;if(!items[i])return;setFocused(i);if(reduced){navigate(`/cases/${items[i].id}`);return;}setOpening(true);timers.current.push(setTimeout(()=>{if(alive.current)navigate(`/cases/${items[i].id}`);},180));};
  useEffect(()=>{
    const node=root.current;if(!node)return;
    const step=(direction:number,event:Event)=>{const index=current.current,next=Math.max(0,Math.min(items.length-1,index+direction));if(next===index)return;event.preventDefault();current.current=next;setFocused(next);setHovered(next);setPage(Math.floor(next/6));deskSound('detent');};
    const wheel=(event:WheelEvent)=>step(event.deltaY>0?1:-1,event),start=(event:TouchEvent)=>{touch.current=event.touches[0].clientY;},move=(event:TouchEvent)=>{const dy=touch.current-event.touches[0].clientY,index=current.current;if(dy>0&&index<items.length-1||dy<0&&index>0)event.preventDefault();if(Math.abs(dy)>28){step(dy>0?1:-1,event);touch.current=event.touches[0].clientY;}};
    node.addEventListener('wheel',wheel,{passive:false});node.addEventListener('touchstart',start,{passive:true});node.addEventListener('touchmove',move,{passive:false});
    return()=>{node.removeEventListener('wheel',wheel);node.removeEventListener('touchstart',start);node.removeEventListener('touchmove',move);};
  },[items.length]);
  const visible=items.slice(page*6,page*6+6);
  return <div ref={root} className="physical-footprint physical-drawer" aria-label="Private case file drawer" data-control="Private case drawer">
    <PhysicalView kind="drawer" active value={hovered===null?-1:hovered%6} count={visible.length} amount={creating||(opening?2:0)} labels={visible.map((item,i)=>`CASE ${String(page*6+i+1).padStart(3,'0')} / ${item.title}`)} interaction={{onHover:i=>setHovered(i===null?null:page*6+i),onSelect:choose}}/>
    {visible.map((item,local)=>{const i=page*6+local;return <button key={item.id} ref={node=>{refs.current[i]=node;}} type="button" className="physical-accessible" tabIndex={focused===i?0:-1} aria-label={`CASE ${String(i+1).padStart(3,'0')} / ${item.title}`} data-testid={`card-case-${item.id}`} onFocus={()=>{setFocused(i);setHovered(i);}} onBlur={()=>setHovered(null)} onClick={()=>choose(local)} onKeyDown={e=>{
      if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
      const next=e.key==='Home'?0:e.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,i+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)));setFocused(next);setHovered(next);setPage(Math.floor(next/6));requestAnimationFrame(()=>refs.current[next]?.focus());
    }}/>;})}
    <ul className="sr-only">{items.map(item=><li key={item.id}><Link href={`/cases/${item.id}`}>{item.title}</Link></li>)}</ul>
  </div>;
}
type Theme={id:string;label:string;colors:string[]};
export function SwatchBook({themes,selected,onSelect}:{themes:Theme[];selected:string;onSelect:(id:string)=>void}){
  const selectedIndex=Math.max(0,themes.findIndex(t=>t.id===selected)),reduced=useReducedInstrumentMotion(),[phase,setPhase]=useState<SwatchMotion['phase']>('closed');
  const[order,setOrder]=useState(()=>[selectedIndex,...themes.map((_,i)=>i).filter(i=>i!==selectedIndex)]),[highlight,setHighlight]=useState(-1),[selection,setSelection]=useState<number|null>(null);
  const refs=useRef<(HTMLButtonElement|null)[]>([]),leaveTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),timers=useRef<ReturnType<typeof setTimeout>[]>([]),alive=useRef(true),tapOpened=useRef(false),phaseRef=useRef(phase),pendingSelection=useRef<number|null>(null);
  phaseRef.current=phase;
  useEffect(()=>{setOrder(previous=>[selectedIndex,...previous.filter(i=>i!==selectedIndex)]);},[selectedIndex]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;clearTimeout(leaveTimer.current);timers.current.forEach(clearTimeout);};},[]);
  const open=()=>{clearTimeout(leaveTimer.current);if(phaseRef.current==='select'||phaseRef.current==='closing')return;setPhase('open');};
  const close=()=>{clearTimeout(leaveTimer.current);if(phaseRef.current==='select'||phaseRef.current==='closing')return;setHighlight(-1);setPhase('closed');};
  const closeRef=useRef(close);closeRef.current=close;
  useEffect(()=>{if(phase!=='open')return;const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();closeRef.current();}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[phase]);
  const finishSelection=()=>{const index=pendingSelection.current;if(index===null||!alive.current)return;pendingSelection.current=null;setPhase('closed');setSelection(null);crossfadeInstrumentTheme(()=>onSelect(themes[index].id),SWATCH_THEME_FADE_MS);};
  const finishRef=useRef(finishSelection);finishRef.current=finishSelection;
  const choose=(i:number)=>{
    if(tapOpened.current){tapOpened.current=false;return;}if(phaseRef.current==='select'||phaseRef.current==='closing')return;
    if(!reduced&&phaseRef.current==='closed'){open();return;}deskSound('switch');clearTimeout(leaveTimer.current);setHighlight(i);setSelection(i);
    if(reduced){setPhase('closed');crossfadeInstrumentTheme(()=>onSelect(themes[i].id),150);return;}
    pendingSelection.current=i;setPhase('select');timers.current.push(setTimeout(()=>{if(!alive.current)return;setOrder(previous=>[i,...previous.filter(index=>index!==i)]);setPhase('closing');setHighlight(-1);},SWATCH_SELECTED_RETURN_MS));
    timers.current.push(setTimeout(()=>finishRef.current(),SWATCH_SELECTION_MS));
  };
  return <div className="physical-footprint physical-swatch" data-reduced={reduced} data-fan-state={phase} data-control="Theme swatch book" aria-label="Color theme swatch book"
    onPointerEnter={event=>{if(event.pointerType!=='touch')open();}} onPointerLeave={()=>{clearTimeout(leaveTimer.current);leaveTimer.current=setTimeout(close,400);}}
    onPointerDown={event=>{if(event.pointerType==='touch'&&phaseRef.current==='closed'&&!reduced){tapOpened.current=true;open();}}}
    onFocusCapture={open} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))leaveTimer.current=setTimeout(close,400);}}>
    <PhysicalView kind="swatch" value={selectedIndex} active={phase!=='closed'} colors={themes.map(theme=>theme.colors)} labels={themes.map(theme=>theme.label)} swatch={{order,highlight,closingSelection:selection,reduced,phase}} interaction={{onSelect:choose,onSettled:()=>{if(phaseRef.current==='closing')finishRef.current();},onHover:i=>{if(phaseRef.current==='open')setHighlight(i??-1);}}}/>
    <div className="sr-only" role="radiogroup" aria-label="Color theme">{themes.map((theme,i)=><button key={theme.id} type="button" role="radio" className="physical-accessible" aria-checked={selected===theme.id} tabIndex={highlight===i||highlight===-1&&i===selectedIndex?0:-1} data-testid={`button-theme-${theme.id}`} ref={node=>{refs.current[i]=node;}} onFocus={()=>setHighlight(i)} onClick={()=>choose(i)} onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const rank=order.indexOf(i),next=event.key==='Home'?order[0]:event.key==='End'?order.at(-1)!:order[(rank+(['ArrowDown','ArrowRight'].includes(event.key)?1:order.length-1))%order.length];refs.current[next]?.focus();}
    }}>{theme.label}</button>)}</div>
  </div>;
}
export function PhysicalTray({active=false}:{active?:boolean}){return <div className="physical-tray" aria-hidden="true"><div className="physical-footprint"><PhysicalView kind="tray" active={active}/></div></div>;}
