export const INSTRUMENT_BLEED=32;
export const INSTRUMENT_RENDER_REVISION='aligned-selector-v3';
export type InstrumentRect={left:number;top:number;width:number;height:number};
export type InstrumentRegion={left:number;top:number;width:number;height:number};
export function instrumentRegion(kind:string,width:number,height:number):InstrumentRegion{
  if(kind==='dial')return{left:(width-160)/2,top:height-156,width:160,height:156};
  return{left:0,top:0,width,height};
}
export function integerInstrumentBounds(rect:InstrumentRect,bleed=INSTRUMENT_BLEED){
  const left=Math.round(rect.left)-bleed,top=Math.round(rect.top)-bleed;
  const width=Math.round(rect.width)+bleed*2,height=Math.round(rect.height)+bleed*2;
  return{left,top,width,height,right:left+width,bottom:top+height};
}
export function swatchMotionCenter(reduced:boolean,count:number){
  if(reduced)return{x:190,y:-(count-1)*67/2};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let rank=0;rank<count;rank++)for(const angle of[0,rank*11*Math.PI/180])for(const x of[-20,416])for(const y of[-28,28]){
    const px=rank+x*Math.cos(angle)-y*Math.sin(angle),py=-rank+x*Math.sin(angle)+y*Math.cos(angle);
    minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
  }
  return{x:(minX+maxX)/2,y:(minY+maxY)/2};
}
export function isInstrumentDebugKey(event:{key:string;repeat?:boolean;altKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;target:EventTarget|null}){
  if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.key.toLowerCase()!=='d')return false;
  return !(typeof Element!=='undefined'&&event.target instanceof Element&&event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));
}
const tracks=new Set<()=>void>();
export function registerInstrumentTrack(measure:()=>void){tracks.add(measure);return()=>{tracks.delete(measure);};}
export function measureInstrumentTracks(){tracks.forEach(measure=>measure());}
