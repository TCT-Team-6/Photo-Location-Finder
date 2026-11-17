import type {LoupePoint,LoupePhase} from './loupe-dwell';
export const DECRYPT_WAIT=1000,DECRYPT_DURATION=600,DECRYPT_REVERSE=250;
export const SCRAMBLE_GLYPHS='0123456789ABCDEF{}[]:,"';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export function decryptFrame(elapsed:number,reduced=false){
  const duration=reduced?150:600,t=clamp(elapsed/duration);
  return {resolution:reduced?t:clamp((elapsed-250)/350),elapsed:Math.max(0,elapsed),complete:t>=1,flash:!reduced&&elapsed<100?Math.sin(Math.PI*elapsed/100)*.1:0,rgbSplit:!reduced&&elapsed>=130&&elapsed<210,scramble:!reduced&&elapsed>=100&&elapsed<350};
}
export function createDecryptTimeline(){
  let anchor:LoupePoint|null=null,stillSince=0,started=0,kind:'binary'|'forward'|'json'|'reverse'='binary',reverseFrom=0,lastReduced=false;
  const frame=(now:number,reduced=lastReduced)=>{
    lastReduced=reduced;
    if(kind==='binary'&&anchor&&now-stillSince>=DECRYPT_WAIT){kind='forward';started=stillSince+DECRYPT_WAIT;}
    if(kind==='forward'&&now-started>=(reduced?150:600))kind='json';
    if(kind==='reverse'&&now-started>=250)kind='binary';
    const reverse=kind==='reverse',elapsed=kind==='json'?600:kind==='forward'?now-started:reverse?reverseFrom*(1-clamp((now-started)/250)):0;
    const view=decryptFrame(elapsed,reduced),phase:LoupePhase=kind==='json'?'json':kind==='binary'?'binary':'decoding';
    return {...view,phase,reverse,reverseAge:reverse?now-started:0,reverseStart:reverseFrom,wait:kind==='forward'?1:kind==='binary'&&anchor?clamp((now-stillSince)/1000):0,resolution:kind==='json'?1:kind==='binary'?0:view.resolution};
  };
  return{frame,move(point:LoupePoint,now:number){
    const current=frame(now),distance=anchor?Math.hypot(point.x-anchor.x,point.y-anchor.y):Infinity;
    if((kind==='forward'||kind==='json')&&distance>6){reverseFrom=kind==='json'?(lastReduced?150:600):current.elapsed;kind='reverse';started=now;anchor={...point};stillSince=now;}
    else if((kind==='binary'||kind==='reverse')&&distance>=2){anchor={...point};stillSince=now;}
  },reset(){anchor=null;stillSince=0;started=0;kind='binary';reverseFrom=0;}};
}
