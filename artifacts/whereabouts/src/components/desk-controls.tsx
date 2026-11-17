import {useEffect,useLayoutEffect,useRef,useState,useId,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {deskSound} from '@/lib/desk-sound';
import {MiniPixelInspector} from './mini-pixel-inspector';
import {feedbackSpring} from '@/lib/lens-feedback';
import {SubpixelSecret} from './subpixel-secret';
import {departPrint,settlePrint} from '@/lib/print-motion';

const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export function HelpNote({children}:{children:ReactNode}){
  const id=useId(),[open,setOpen]=useState(false),[position,setPosition]=useState({x:8,y:8,width:280}),button=useRef<HTMLButtonElement>(null),popup=useRef<HTMLSpanElement>(null),pinned=useRef(false);
  useLayoutEffect(()=>{
    if(!open)return;
    const place=()=>{const rect=button.current?.getBoundingClientRect();if(!rect)return;const width=Math.min(300,innerWidth-32),height=popup.current?.offsetHeight??100;setPosition({width,x:Math.max(8,Math.min(innerWidth-width-8,rect.left-width/2+rect.width/2)),y:rect.top-height>8?rect.top-height-8:Math.min(innerHeight-height-8,rect.bottom+8)});};
    const outside=(event:Event)=>{const target=event.target as Node;if(!button.current?.contains(target)&&!popup.current?.contains(target)){pinned.current=false;setOpen(false);}};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){pinned.current=false;setOpen(false);}};
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape);
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape);};
  },[open,children]);
  const close=()=>{pinned.current=false;setOpen(false);};
  return <span className="fd-question" data-open={open}>
    <button ref={button} type="button" aria-label="More information" aria-describedby={open?id:undefined} aria-expanded={open}
      onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>{if(!pinned.current&&document.activeElement!==button.current)setOpen(false);}}
      onFocus={()=>setOpen(true)} onBlur={event=>{if(!pinned.current&&!popup.current?.contains(event.relatedTarget as Node))setOpen(false);}}
      onClick={()=>{pinned.current=!pinned.current;setOpen(pinned.current);}}
      onKeyDown={event=>{if(event.key==='Escape')close();if(event.key==='ArrowDown'){event.preventDefault();popup.current?.focus();}}}>?</button>
    {open&&createPortal(<span id={id} ref={popup} role="tooltip" tabIndex={-1} className="fd-help-popup" style={{left:position.x,top:Math.max(8,position.y),width:position.width}} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){button.current?.focus();close();}}}>{children}</span>,document.body)}
  </span>;
}
export function HangingTag({children}:{children:ReactNode}){
  const node=useRef<HTMLDivElement>(null),model=useRef({position:0,velocity:0}),raf=useRef(0),last=useRef(0);
  useEffect(()=>()=>cancelAnimationFrame(raf.current),[]);
  const tick=(now:number)=>{const dt=last.current?Math.min(.032,(now-last.current)/1000):.016;last.current=now;model.current=feedbackSpring(model.current,0,dt,220,22);model.current.position=Math.max(-2.8,Math.min(2.8,model.current.position));if(node.current)node.current.style.rotate=`${model.current.position}deg`;if(Math.abs(model.current.position)>.012||Math.abs(model.current.velocity)>.03)raf.current=requestAnimationFrame(tick);else{raf.current=0;last.current=0;if(node.current)node.current.style.rotate='0deg';}};
  const nudge=(velocity:number)=>{if(reduced())return;model.current.velocity=Math.max(-72,Math.min(72,velocity));if(!raf.current)raf.current=requestAnimationFrame(tick);};
  return <div ref={node} className="fd-tag" onPointerMove={e=>nudge(e.movementX*8)} onFocusCapture={()=>nudge(60)}>{children}</div>;
}
export function RotaryDial({value,labels,onChange,label,disabled=false}:{value:number;labels:string[];onChange:(value:number)=>void;label:string;disabled?:boolean}){
  const button=useRef<HTMLButtonElement>(null),current=useRef({value,onChange,disabled});current.current={value,onChange,disabled};
  const drag=useRef<{x:number;value:number}|null>(null),suppress=useRef(false);
  const change=(next:number)=>{const c=current.current,n=Math.max(0,Math.min(labels.length-1,next));if(!c.disabled&&n!==c.value){deskSound('detent');c.onChange(n);}};
  const changeRef=useRef(change);changeRef.current=change;
  useEffect(()=>{const node=button.current;if(!node)return;const wheel=(e:WheelEvent)=>{if(current.current.disabled)return;e.preventDefault();e.stopPropagation();changeRef.current(current.current.value+(e.deltaY>0?1:-1));};node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);},[]);
  return <div className="fd-dial" data-testid={`dial-${label.toLowerCase().replaceAll(' ','-')}`}>
    <button ref={button} type="button" className="fd-dial-knob" disabled={disabled} role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={labels.length-1} aria-valuenow={value} aria-valuetext={labels[value]}
      onPointerDown={e=>{e.stopPropagation();drag.current={x:e.clientX,value};suppress.current=false;e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{e.stopPropagation();if(!drag.current)return;const dx=e.clientX-drag.current.x;if(Math.abs(dx)>4)suppress.current=true;change(drag.current.value+Math.round(dx/36));}}
      onPointerUp={e=>{e.stopPropagation();drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
      onPointerCancel={()=>{drag.current=null;suppress.current=true;}}
      onClick={e=>{e.stopPropagation();if(suppress.current&&e.detail!==0){suppress.current=false;return;}change((value+1)%labels.length);}}
      onKeyDown={e=>{e.stopPropagation();if(['ArrowRight','ArrowUp','ArrowLeft','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();change(e.key==='Home'?0:e.key==='End'?labels.length-1:value+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1));}}}>
      <span style={{transform:`rotate(${-55+value*55}deg)`}}/>
    </button>
    <div className="fd-dial-labels">{labels.map((text,i)=><button key={text} type="button" disabled={disabled} aria-pressed={value===i} onClick={()=>change(i)}>{text}</button>)}</div>
    <output>{label.toUpperCase()} {labels[value]}</output>
  </div>;
}
const titles=['Keep the whole frame.','Choose the right desk.','Unknown is a valid answer.','Review before acting.'];
const explanations=['Keep the original frame and visible context. Avoid edits that remove useful scene clues.','Investigations and Recreation estimate places; Journalism reviews image authenticity. Private cases remain a separate, authorized evidence workspace.','Leave unavailable dates and context blank. A guess is not a recorded fact.','Review estimates and sources independently before acting. Image analysis is not forensic proof or emergency assistance.'];
export function FlipChecklist(){const[flipped,setFlipped]=useState<number[]>([]);return <div><p className="font-data text-[10px] mt-8">FIELD CHECKLIST / OPTIONAL</p><div className="fd-flip-checklist">{titles.map((title,i)=><div key={title}><button type="button" className="fd-flip-card" data-flipped={flipped.includes(i)} aria-expanded={flipped.includes(i)} onClick={()=>setFlipped(items=>items.includes(i)?items.filter(n=>n!==i):[...items,i])}><span><i><b>0{i+1} / TURN TO READ</b>{title}</i><i>{explanations[i]}</i></span></button><label className="flex gap-2 text-[10px] items-center py-3"><input type="checkbox"/>Noted · optional</label></div>)}</div></div>;}
export function PrintInspector({src,alt,onClose}:{src:string;alt:string;onClose:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const node=ref.current;node?.showModal();return()=>node?.close();},[]);
  return <dialog ref={ref} className="fd-print-inspector" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><p className="font-data text-[10px] mb-4">LOCAL PRINT / PIXEL INSPECTION</p><MiniPixelInspector src={src} alt={alt}/><button type="button" onClick={onClose}>Close inspection</button></dialog>;
}
export function BatchPrints({items,onRemove,onOrder,errors={}}:{items:{id:string;file:File;label:string}[];onRemove:(id:string)=>void;onOrder:(ids:string[])=>void;errors?:Record<string,string>}){
  const drag=useRef<string|null>(null),root=useRef<HTMLDivElement>(null);
  const reorder=(id:string,index:number)=>{const ids=items.map(item=>item.id),from=ids.indexOf(id);if(from<0)return;ids.splice(from,1);ids.splice(Math.max(0,index),0,id);onOrder(ids);};
  return <div ref={root} className="flex flex-wrap gap-6 mt-6" aria-label="Selected desk prints">
    {items.map((item,i)=><div key={item.id} className="fd-batch-print w-36" draggable
      onDragStart={e=>{drag.current=item.id;e.dataTransfer.setData('application/x-whereabouts-print',item.id);e.dataTransfer.effectAllowed='move';}}
      onDragOver={e=>{if(drag.current)e.preventDefault();}} onDrop={e=>{if(drag.current){e.preventDefault();e.stopPropagation();reorder(drag.current,i);drag.current=null;}}}
      onDragEnd={e=>{const rect=root.current?.getBoundingClientRect();if(drag.current&&e.dataTransfer.dropEffect==='none'&&(e.clientX||e.clientY)&&rect&&(e.clientX<rect.left-40||e.clientX>rect.right+40||e.clientY<rect.top-40||e.clientY>rect.bottom+40)){departPrint(e.currentTarget);onRemove(item.id);}drag.current=null;settlePrint(e.currentTarget);}}>
      <LocalPrint file={item.file}/><p className="truncate font-data text-[9px] mt-2">{item.label} / {item.file.name}</p>
      {errors[item.id]&&<p role="alert" className="text-xs mt-2">{errors[item.id]}</p>}
      <div className="fd-print-actions">
        <button type="button" disabled={i===0} onClick={e=>{reorder(item.id,i-1);settlePrint(e.currentTarget.closest<HTMLElement>('.fd-batch-print')!);}} aria-label={`Move ${item.file.name} earlier`}>←</button>
        <button type="button" disabled={i===items.length-1} onClick={e=>{reorder(item.id,i+1);settlePrint(e.currentTarget.closest<HTMLElement>('.fd-batch-print')!);}} aria-label={`Move ${item.file.name} later`}>→</button>
        <button type="button" onClick={e=>{departPrint(e.currentTarget.closest('.fd-batch-print'));onRemove(item.id);}} aria-label={`Remove ${item.file.name}`}>×</button>
      </div>
    </div>)}
  </div>;
}
function LocalPrint({file}:{file:File}){const[url,setUrl]=useState(''),[open,setOpen]=useState(false);useEffect(()=>{const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);return <><button type="button" className="block h-28 w-full" onClick={()=>setOpen(true)} aria-label={`Inspect ${file.name}`}><img src={url||undefined} alt={file.name} draggable={false} className="w-full h-full object-contain"/></button>{open&&url&&<PrintInspector src={url} alt={file.name} onClose={()=>setOpen(false)}/>}</>;}
export function EmptyTrayLoupe({message}:{message:string}){
  const button=useRef<HTMLButtonElement>(null),secret=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number}|null>(null),offset=useRef({x:0,y:0}),moved=useRef(false);
  const[shown,setShown]=useState(false);
  const paint=(x:number,y:number)=>{const node=button.current,parent=node?.parentElement;if(!node||!parent)return;const startX=parent.clientWidth-76,startY=parent.clientHeight-100;offset.current={x:Math.max(-startX,Math.min(12,x)),y:Math.max(-startY,Math.min(10,y))};node.style.transform=`translate(${offset.current.x}px,${offset.current.y}px)`;secret.current?.style.setProperty('--secret-x',`${startX+32+offset.current.x}px`);secret.current?.style.setProperty('--secret-y',`${startY+24+offset.current.y}px`);setShown(true);};
  const home=()=>{const node=button.current;if(node&&!reduced())node.animate([{transform:node.style.transform},{transform:'translate(0,0)'}],{duration:250,easing:'cubic-bezier(.2,1,.3,1)'});if(node)node.style.transform='translate(0,0)';offset.current={x:0,y:0};setShown(false);};
  return <>
    <div ref={secret} className="fd-empty-secret" style={{'--secret-visible':shown?1:0} as React.CSSProperties} aria-hidden="true"><SubpixelSecret text={message}/></div>
    <button ref={button} type="button" className="fd-empty-tool" aria-label={shown?message:'Inspect empty tray; arrows move, Escape returns'}
      onPointerDown={e=>{button.current?.getAnimations().forEach(a=>a.cancel());drag.current={x:e.clientX-offset.current.x,y:e.clientY-offset.current.y};moved.current=false;e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(drag.current){moved.current=true;paint(e.clientX-drag.current.x,e.clientY-drag.current.y);}}}
      onPointerUp={()=>{drag.current=null;if(moved.current)home();}} onPointerCancel={()=>{drag.current=null;home();}}
      onClick={()=>{if(moved.current){moved.current=false;return;}if(shown)home();else{const p=button.current?.parentElement;if(p)paint(-p.clientWidth/2+76,-p.clientHeight/2+100);}}}
      onKeyDown={e=>{const delta:{[key:string]:number[]}={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};if(e.key==='Escape'){home();e.preventDefault();}else if(delta[e.key]){e.preventDefault();button.current?.getAnimations().forEach(a=>a.cancel());paint(offset.current.x+delta[e.key][0],offset.current.y+delta[e.key][1]);}}}/>
    <span className="sr-only" role="status">{shown?message:''}</span>
  </>;
}
export function DeskMargin(){
  const root=useRef<HTMLDivElement>(null),nodes=useRef<(HTMLButtonElement|null)[]>([]),frame=useRef(0);
  const models=useRef([{x:15,y:45,vx:0,vy:0},{x:80,y:105,vx:0,vy:0},{x:34,y:155,vx:0,vy:0}]);
  const drag=useRef<{i:number;x:number;y:number;t:number}|null>(null),tidying=useRef(false),last=useRef(0),moved=useRef(false);
  const save=()=>{try{localStorage.setItem('whereabouts-desk-objects-v1',JSON.stringify(models.current.map(({x,y})=>({x,y}))));}catch{/* Cosmetic positions only. */}};
  const draw=()=>models.current.forEach((m,i)=>{if(nodes.current[i])nodes.current[i]!.style.transform=`translate(${m.x}px,${m.y}px)`;});
  const bounds=()=>({w:Math.max(1,(root.current?.clientWidth??180)-56),h:Math.max(1,(root.current?.clientHeight??230)-56)});
  const home=(i:number)=>{const{w,h}=bounds();return{x:Math.min(w,[15,80,34][i]),y:Math.min(h,[45,105,155][i])};};
  const tick=(now:number)=>{frame.current=0;const dt=Math.min(.032,(now-(last.current||now-16))/1000);last.current=now;const{w,h}=bounds();let moving=false;
    models.current.forEach((m,i)=>{if(drag.current?.i===i)return;if(tidying.current){const p=home(i);m.vx+=(p.x-m.x)*130*dt-m.vx*20*dt;m.vy+=(p.y-m.y)*130*dt-m.vy*20*dt;}else{m.vx*=Math.exp(-6*dt);m.vy*=Math.exp(-6*dt);}m.x+=m.vx*dt;m.y+=m.vy*dt;if(m.x<0||m.x>w){m.x=Math.max(0,Math.min(w,m.x));m.vx*=-.24;}if(m.y<0||m.y>h){m.y=Math.max(0,Math.min(h,m.y));m.vy*=-.24;}const target=home(i);if(Math.abs(m.vx)+Math.abs(m.vy)>.5||tidying.current&&Math.abs(target.x-m.x)+Math.abs(target.y-m.y)>.4)moving=true;});
    draw();if(moving)frame.current=requestAnimationFrame(tick);else{tidying.current=false;last.current=0;save();}
  };
  const animate=()=>{if(!frame.current){last.current=0;frame.current=requestAnimationFrame(tick);}};
  useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('whereabouts-desk-objects-v1')??'null');if(Array.isArray(saved)&&saved.length===3)saved.forEach((p,i)=>{if(Number.isFinite(p.x)&&Number.isFinite(p.y))Object.assign(models.current[i],{x:p.x,y:p.y});});}catch{/* Start tidy. */}const observer=new ResizeObserver(()=>{const{w,h}=bounds();models.current.forEach(m=>{m.x=Math.max(0,Math.min(w,m.x));m.y=Math.max(0,Math.min(h,m.y));});draw();});if(root.current)observer.observe(root.current);draw();return()=>{observer.disconnect();cancelAnimationFrame(frame.current);};},[]);
  return <aside className="fd-overview-play" aria-label="Optional desk margin">
    <div ref={root} className="fd-margin" data-drag-region="desk-margin"><p className="fd-margin-label">DESK MARGIN / OPTIONAL</p>
      {['Pencil','Paper clip','Pin'].map((name,i)=><button key={name} ref={el=>{nodes.current[i]=el;}} type="button" className="fd-object" aria-label={`${name}; click nudges, arrows move, Home resets`}
        onPointerDown={e=>{tidying.current=false;moved.current=false;models.current[i].vx=models.current[i].vy=0;drag.current={i,x:e.clientX,y:e.clientY,t:e.timeStamp};e.currentTarget.setPointerCapture(e.pointerId);}}
        onPointerMove={e=>{const d=drag.current;if(!d||d.i!==i)return;const m=models.current[i],dt=Math.max(.016,(e.timeStamp-d.t)/1000),{w,h}=bounds(),dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>1)moved.current=true;m.x=Math.max(0,Math.min(w,m.x+dx));m.y=Math.max(0,Math.min(h,m.y+dy));m.vx=reduced()?0:Math.max(-700,Math.min(700,dx/dt));m.vy=reduced()?0:Math.max(-700,Math.min(700,dy/dt));drag.current={i,x:e.clientX,y:e.clientY,t:e.timeStamp};draw();}}
        onPointerUp={()=>{drag.current=null;if(reduced())save();else animate();}} onPointerCancel={()=>{drag.current=null;models.current[i].vx=models.current[i].vy=0;save();}}
        onClick={e=>{if(e.detail>0&&moved.current){moved.current=false;return;}tidying.current=false;const m=models.current[i];if(reduced()){const{w}=bounds();m.x=Math.min(w,m.x+10);draw();save();}else{m.vx=120;m.vy=-65;animate();}}}
        onKeyDown={e=>{const directions:Record<string,number[]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};if(directions[e.key]||e.key==='Home'){e.preventDefault();const m=models.current[i],{w,h}=bounds(),d=directions[e.key];Object.assign(m,d?{x:Math.max(0,Math.min(w,m.x+d[0])),y:Math.max(0,Math.min(h,m.y+d[1]))}:home(i),{vx:0,vy:0});draw();save();}}}>
        <svg viewBox="0 0 48 48" aria-hidden="true">{i===0?<path d="m10 37 4-11L34 6l8 8-20 20-12 3Zm4-11 8 8M30 10l8 8"/>:i===1?<path d="M29 12 14 31a7 7 0 0 0 11 9l15-21a11 11 0 0 0-17-13L8 26a4 4 0 0 0 6 5L30 11"/>:<path d="m16 7 18 4-4 10 4 6-11-2-9 15 4-17-7-3 8-3-3-10Z"/>}</svg>
      </button>)}
    </div><button className="fd-margin-tidy" type="button" onClick={()=>{if(reduced()){models.current.forEach((m,i)=>Object.assign(m,home(i),{vx:0,vy:0}));draw();save();}else{tidying.current=true;animate();}}}>Tidy desk</button>
  </aside>;
}
