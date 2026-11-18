import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { isFilingAcknowledged } from '@/lib/filing-signals';
import {deskSound} from '@/lib/desk-sound';
import {ODOMETER_CELL_EM,odometerTransform} from '@/lib/odometer-layout';

const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function FieldDeskFilingNotice(){
  const client=useQueryClient(),[stamp,setStamp]=useState(0);
  useEffect(()=>{let timer:ReturnType<typeof setTimeout>|undefined;const unsubscribe=client.getMutationCache().subscribe(event=>{
    if(event.type==='removed'){setStamp(0);return;}
    if(event.type!=='updated'||event.action.type!=='success'||!isFilingAcknowledged(event.mutation.options.mutationKey,event.mutation.state.data))return;
    clearTimeout(timer);deskSound('stamp');setStamp(previous=>previous+1);timer=setTimeout(()=>setStamp(0),1150);
  });return()=>{unsubscribe();clearTimeout(timer);};},[client]);
  return stamp?<div key={stamp} className="fd-global-filed" data-testid="status-field-desk-filed" role="status"><strong>FILED</strong><span>Record saved</span></div>:null;
}
export function CropMarks(){return <>{[0,1,2,3].map(n=><i key={n} className={`fd-crop fd-crop-${n}`} aria-hidden="true"/>)}</>;}
export function SpecimenTray({label='TRAY EMPTY / 00 ITEMS',title,text,action,testId='content-empty-state'}:{label?:string;title:string;text:string;action?:ReactNode;testId?:string}){
  return <div className="fd-tray" data-testid={testId}><p>{label}</p><h3>{title}</h3><p>{text}</p>{action}</div>;
}
export function DeskRuler(){
  const marker=useRef<HTMLDivElement>(null),ruler=useRef<HTMLDivElement>(null);
  useEffect(()=>{let frame=0;const paint=()=>{frame=0;const max=document.documentElement.scrollHeight-window.innerHeight,progress=max>0?Math.min(1,Math.max(0,window.scrollY/max)):0;
    if(marker.current&&ruler.current){marker.current.style.transform=`translateX(${progress*(ruler.current.clientWidth-2)}px)`;ruler.current.dataset.scrollProgress=String(Math.round(progress*100));}};
    const request=()=>{if(!frame)frame=requestAnimationFrame(paint);};request();window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request);
    const observer=new ResizeObserver(request);observer.observe(document.body);return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',request);window.removeEventListener('resize',request);};
  },[]);
  return <div className="fd-ruler" ref={ruler} aria-hidden="true" data-testid="field-desk-ruler"><div ref={marker} className="fd-ruler-marker"/><span>MM / SCROLL</span></div>;
}
export function DeskHeadline({children,className='',as='h1',testId}:{children:string;className?:string;as?:'h1'|'h2'|'span';testId?:string}){
  const ref=useRef<HTMLElement>(null),[lines,setLines]=useState<string[]>([children]);
  useLayoutEffect(()=>{const element=ref.current;if(!element)return;const measure=()=>{const style=getComputedStyle(element),c=document.createElement('canvas').getContext('2d');if(!c)return;c.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;const max=element.clientWidth;let line='';const result:string[]=[];
      for(const word of children.split(/\s+/)){const next=line?`${line} ${word}`:word;const tracking=parseFloat(style.letterSpacing)||0;if(line&&c.measureText(next).width+tracking*next.length>max){result.push(line);line=word;}else line=next;}if(line)result.push(line);setLines(previous=>previous.join('\n')===result.join('\n')?previous:result);};
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[children]);
  useLayoutEffect(()=>{if(reduced())return;const animations=Array.from(ref.current?.querySelectorAll('.fd-headline-line>span')??[]).map((line,i)=>line.animate([{transform:'translateY(105%)',clipPath:'inset(100% 0 0 0)',opacity:0},{transform:'translateY(0)',clipPath:'inset(0 0 0 0)',opacity:1}],{duration:260,delay:Math.min(i*55,165),fill:'backwards',easing:'cubic-bezier(.2,.7,.2,1)'}));return()=>animations.forEach(a=>a.cancel());},[lines]);
  const Tag=as;
  return <Tag ref={ref as React.RefObject<HTMLHeadingElement>} className={`fd-headline ${className}`} role={as==='span'?'heading':undefined} aria-level={as==='span'?2:undefined} aria-label={children} data-testid={testId}>{lines.map((line,i)=><span className="fd-headline-line" aria-hidden="true" key={`${i}-${line}`}><span>{line}</span></span>)}</Tag>;
}
export function FieldSheet({children,code,className=''}:{children:ReactNode;code:string;className?:string}){
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{const el=ref.current;if(!el)return;const animation=el.animate([{opacity:0,transform:reduced()?'none':'translateY(12px)'},{opacity:1,transform:'none'}],{duration:350,easing:'cubic-bezier(.2,.7,.2,1)'});return()=>animation.cancel();},[]);
  return <div ref={ref} className={`fd-sheet ${className}`} data-sheet-code={code} data-testid="field-desk-sheet">{children}</div>;
}
export type IndexItem={href:string;label:string;testId?:string};
let lastVisibleIndexTop:number|undefined;
export function FieldIndex({items,location,start=1,onNavigate,label='Index'}:{items:IndexItem[];location:string;start?:number;onNavigate?:()=>void;label?:string}){
  const ref=useRef<HTMLElement>(null),indicator=useRef<HTMLSpanElement>(null),position=useRef(0);
  const section=location.startsWith('/cases/')?'/cases':location.startsWith('/investigation/')?'/library':location==='/guide'||location.startsWith('/guide/')?'/start':location;
  const active=items.findIndex(item=>section===item.href);
  useLayoutEffect(()=>{const el=ref.current?.querySelector<HTMLElement>('[aria-current="page"]'),mark=indicator.current;if(!el||!mark||!ref.current?.getClientRects().length)return;const y=el.offsetTop,base=ref.current.getBoundingClientRect().top,from=lastVisibleIndexTop===undefined?position.current:lastVisibleIndexTop-base;mark.style.transform=`translateY(${y}px)`;lastVisibleIndexTop=base+y;const animation=!reduced()?mark.animate([{transform:`translateY(${from}px)`},{transform:`translateY(${y+1.6}px)`,offset:.75},{transform:`translateY(${y}px)`}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'}):null;position.current=y;return()=>animation?.cancel();},[location,active]);
  return <nav ref={ref} className="fd-index" aria-label={label}>{active>=0&&<span ref={indicator} className="fd-index-indicator" aria-hidden="true"/>}{items.map((item,i)=><Link key={item.href} href={item.href} aria-current={i===active?'page':undefined} onClick={onNavigate} data-testid={item.testId}><span>{String(start+i).padStart(2,'0')}</span><span>{item.label}</span></Link>)}</nav>;
}
/** Each column rolls to its REAL value; assistive technology receives the final count. */
export function Odometer({value,digits=2}:{value:number;digits?:number}){
  const ref=useRef<HTMLSpanElement>(null),text=Math.max(0,Math.round(value)).toString().padStart(digits,'0');
  useLayoutEffect(()=>{if(reduced())return;const animations=Array.from(ref.current?.querySelectorAll<HTMLElement>('.fd-odo-digit')??[]).map((column,i)=>column.animate([{transform:'translateY(0)'},{transform:column.style.transform}],{duration:300,delay:Math.min(100,i*25),fill:'backwards',easing:'cubic-bezier(.2,.7,.2,1)'}));return()=>animations.forEach(a=>a.cancel());},[text]);
  return <span ref={ref} className="fd-odo" role="img" aria-label={String(value)} data-value={value} style={{'--fd-digit-height':`${ODOMETER_CELL_EM}em`} as CSSProperties}>{text.split('').map((digit,i)=><span key={i} className="fd-odo-window" aria-hidden="true"><span className="fd-odo-digit" style={{transform:odometerTransform(digit)}}>{Array.from({length:10},(_,n)=><span key={n} data-active-digit={n===Number(digit)}>{n}</span>)}</span></span>)}</span>;
}
export function ContactSheet({children,orderKey,className=''}:{children:ReactNode;orderKey?:string;className?:string}){
  const ref=useRef<HTMLDivElement>(null),positions=useRef(new Map<string,{left:number;top:number}>());
  useLayoutEffect(()=>{const children=Array.from(ref.current?.children??[]) as HTMLElement[];const next=new Map<string,{left:number;top:number}>();const animations:Animation[]=[];
    children.forEach((child,i)=>{const key=child.dataset.testid??String(i),box=child.getBoundingClientRect(),rect={left:box.left+window.scrollX,top:box.top+window.scrollY},old=positions.current.get(key);next.set(key,rect);if(old&&!reduced()&&(old.left!==rect.left||old.top!==rect.top))animations.push(child.animate([{transform:`translate(${old.left-rect.left}px,${old.top-rect.top}px)`},{transform:'translate(0,0)'}],{duration:300,easing:'cubic-bezier(.2,.7,.2,1)'}));});positions.current=next;return()=>animations.forEach(a=>a.cancel());},[orderKey]);
  return <div ref={ref} className={`fd-contact-sheet ${className}`}>{children}</div>;
}
/** Local authorized image only. Canvas draw does not export pixels; CORS-restricted images retain their ordinary preview. */
export function PixelPrint({src,alt,testId,className=''}:{src:string;alt:string;testId?:string;className?:string}){
  const image=useRef<HTMLImageElement>(null),lens=useRef<HTMLSpanElement>(null),canvas=useRef<HTMLCanvasElement>(null),sample=useRef<HTMLCanvasElement|null>(null);
  const[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
  const inspect=(x:number,y:number)=>{const img=image.current,el=lens.current,c=canvas.current;if(!img?.naturalWidth||!el||!c)return;const r=img.getBoundingClientRect(),px=Math.max(0,Math.min(r.width,x-r.left)),py=Math.max(0,Math.min(r.height,y-r.top)),scale=Math.max(r.width/img.naturalWidth,r.height/img.naturalHeight),sx=(px+(img.naturalWidth*scale-r.width)/2)/scale,sy=(py+(img.naturalHeight*scale-r.height)/2)/scale;
    el.style.transform=`translate(${px-46}px,${py-46}px)`;const dpr=window.devicePixelRatio||1;
    if(!sample.current)sample.current=document.createElement('canvas');const s=sample.current;
    const aperture=92/2.5,side=Math.round(aperture*dpr);if(s.width!==side){s.width=s.height=side;}
    if(c.width!==Math.round(92*dpr)){c.width=c.height=Math.round(92*dpr);}el.style.setProperty('--pixel-cell',`${2.5/dpr}px`);
    const sc=s.getContext('2d'),ctx=c.getContext('2d');if(!ctx||!sc)return;ctx.imageSmoothingEnabled=false;sc.clearRect(0,0,side,side);ctx.clearRect(0,0,c.width,c.height);try{sc.drawImage(img,sx-aperture/(2*scale),sy-aperture/(2*scale),aperture/scale,aperture/scale,0,0,side,side);ctx.drawImage(s,0,0,c.width,c.height);}catch{/* Ordinary preview is still available. */}};
  return <span className={`fd-print ${className}`} data-cursor-crop="" onPointerMove={e=>inspect(e.clientX,e.clientY)}><img ref={image} src={src} alt={alt} data-testid={testId} loading="lazy" onLoad={event=>{const rect=event.currentTarget.getBoundingClientRect();inspect(rect.left+rect.width/2,rect.top+rect.height/2);}} onError={()=>setFailed(true)} style={{opacity:failed?0:1}}/>{failed?<span className="absolute inset-0 grid place-items-center p-4 font-data text-[10px]">PREVIEW UNAVAILABLE / OPEN FILE TO REVIEW</span>:<span ref={lens} className="fd-print-loupe" aria-hidden="true"><canvas ref={canvas} width={92} height={92}/></span>}</span>;
}
export function DeskChecklist({items}:{items:string[]}){
  const[checked,setChecked]=useState<Set<number>>(new Set());
  return <div className="fd-checklist" aria-label="Optional preparation checklist">{items.map((item,i)=><button className="fd-check-card" type="button" key={item} aria-pressed={checked.has(i)} data-testid={`check-preparation-${i}`} onClick={()=>setChecked(old=>{const next=new Set(old);next.has(i)?next.delete(i):next.add(i);return next;})}><span>{String(i+1).padStart(2,'0')}</span><span className="text-xs leading-5">{item}</span><span className="fd-check-box" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none" strokeWidth="1.7"><path d="m3 9 4 4 8-9"/></svg></span></button>)}</div>;
}
export function UploadReceipt({status}:{status:'ready'|'uploading'|'analyzing'|'saved'|'error'}){
  const[show,setShow]=useState(status==='saved');
  useEffect(()=>{setShow(status==='saved');if(status!=='saved')return;const timer=setTimeout(()=>setShow(false),1150);return()=>clearTimeout(timer);},[status]);
  if(status==='saved'&&show)return <span className="fd-filed" role="status" data-testid="stamp-filed">FILED</span>;
  if(status==='uploading')return <span className="fd-upload-status" role="status" data-testid="upload-byte-status">FILING / TRANSFERRING… <span className="sr-only">Indeterminate: upload byte progress is unavailable.</span></span>;
  return null;
}
export function stepProgress(photo:boolean,context:boolean):CSSProperties{return {'--fd-step-progress':photo?context?'100%':'58%':'12%'} as CSSProperties;}
