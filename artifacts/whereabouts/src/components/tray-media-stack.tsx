import {useEffect,useRef,useState} from 'react';
import {InstrumentView as PhysicalView} from './InstrumentKit';
import {PrintInspector} from './desk-controls';
import {feedbackSpring} from '@/lib/lens-feedback';

export function TrayMediaStack({items,onRemove}:{items:{id:string;file:File}[];onRemove:(id:string)=>void}){
  return <div className="tray-media-stack" aria-label="Prints in the specimen tray">{items.filter(item=>!item.file.type.startsWith('video/')).map((item,i)=><TrayPrint key={item.id} item={item} index={i} onRemove={()=>onRemove(item.id)}/>)}</div>;
}
function TrayPrint({item,index,onRemove}:{item:{id:string;file:File};index:number;onRemove:()=>void}){
  const[url,setUrl]=useState(''),[inspect,setInspect]=useState(false),ref=useRef<HTMLDivElement>(null),drag=useRef<{x:number;y:number}|null>(null),offset=useRef({x:0,y:0}),frame=useRef(0),last=useRef(0),velocity=useRef({x:0,y:0});
  useEffect(()=>{const local=URL.createObjectURL(item.file);setUrl(local);return()=>{URL.revokeObjectURL(local);cancelAnimationFrame(frame.current);};},[item.file]);
  const outside=(x:number,y:number)=>{const rect=ref.current?.closest('.photo-upload-dropzone')?.getBoundingClientRect();return rect&&(x<rect.left||x>rect.right||y<rect.top||y>rect.bottom);};
  const paint=(x:number,y:number)=>{offset.current={x,y};ref.current?.style.setProperty('--drag-x',`${x}px`);ref.current?.style.setProperty('--drag-y',`${y}px`);window.dispatchEvent(new Event('whereabouts:instrument-motion'));};
  const settle=()=>{
    cancelAnimationFrame(frame.current);last.current=0;velocity.current={x:0,y:0};
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){paint(0,0);return;}
    const tick=(now:number)=>{const dt=last.current?Math.min(.032,(now-last.current)/1000):.016;last.current=now;const x=feedbackSpring({position:offset.current.x,velocity:velocity.current.x},0,dt,260,24),y=feedbackSpring({position:offset.current.y,velocity:velocity.current.y},0,dt,260,24);velocity.current={x:x.velocity,y:y.velocity};paint(x.position,y.position);if(Math.abs(x.position)+Math.abs(y.position)+Math.abs(x.velocity)+Math.abs(y.velocity)>.1)frame.current=requestAnimationFrame(tick);else paint(0,0);};frame.current=requestAnimationFrame(tick);
  };
  return <div ref={ref} className="tray-stack-print physical-footprint" style={{'--print-x':`${(index%3-1)*12}px`,'--print-y':`${Math.floor(index/3)*8}px`,zIndex:index+3} as React.CSSProperties}>
    <PhysicalView kind="print" media={item.file} layer={index+1} angle={[-3,2,-1,4,-4,1][index%6]*Math.PI/180} interaction={{onSelect:()=>setInspect(true),onCancel:()=>{drag.current=null;settle();},onTranslate:(x,y,phase)=>{
      if(phase==='start'){cancelAnimationFrame(frame.current);drag.current={x:x-offset.current.x,y:y-offset.current.y};}
      else if(phase==='move'&&drag.current)paint(x-drag.current.x,y-drag.current.y);
      else if(phase==='end'){drag.current=null;if(outside(x,y))onRemove();else settle();}
    }}}/>
    <button type="button" className="physical-accessible" aria-label={`Inspect tray print ${item.file.name}`} data-testid={`button-tray-inspect-${item.id}`} onClick={event=>{event.stopPropagation();setInspect(true);}}/>
    <button type="button" className="tray-print-remove" aria-label={`Remove tray print ${item.file.name}`} data-testid={`button-tray-remove-${item.id}`} onClick={event=>{event.stopPropagation();onRemove();}}>×</button>
    {inspect&&url&&<PrintInspector src={url} alt={item.file.name} onClose={()=>setInspect(false)}/>}
  </div>;
}
