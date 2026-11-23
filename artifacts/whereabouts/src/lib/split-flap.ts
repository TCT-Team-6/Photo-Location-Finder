/** One real archive update, one mechanical cycle. Never count through invented values. */
export const FLAP_DROP_MS=300;
export const FLAP_FOLLOW_MS=260;
export const FLAP_SNAP_MS=460;
export const FLAP_SETTLE_MS=540;
export function countDigits(value:number):string{
  const safe=Number.isFinite(value)?Math.max(0,Math.trunc(value)):0;
  return safe.toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:0}).padStart(2,'0');
}
export type FlapState={from:string;to:string;queued:string;started:number;moving:boolean};
export function createFlapState(digit:string):FlapState{return{from:digit,to:digit,queued:digit,started:0,moving:false};}
export function requestFlap(state:FlapState,digit:string,now:number,reduced=false):FlapState{
  if(reduced)return createFlapState(digit);
  if(state.moving)return{...state,queued:digit};
  return state.to===digit?state:{from:state.to,to:digit,queued:digit,started:now,moving:true};
}
export function settleFlap(state:FlapState,now:number):FlapState{
  if(!state.moving||now-state.started<FLAP_SETTLE_MS)return state;
  return requestFlap(createFlapState(state.to),state.queued,now);
}
export function flapPose(elapsed:number,reduced=false){
  if(reduced||elapsed>=FLAP_SETTLE_MS)return{upper:0,lower:0,falling:false,following:false,settled:true};
  const t=Math.max(0,elapsed),drop=Math.min(1,t/FLAP_DROP_MS);
  // Accelerating fall, followed by a short, damped stop. Both halves end exactly flush.
  const follow=Math.min(1,Math.max(0,(t-FLAP_FOLLOW_MS)/(FLAP_SNAP_MS-FLAP_FOLLOW_MS)));
  const bounce=t>FLAP_SNAP_MS?Math.sin((t-FLAP_SNAP_MS)/80*Math.PI*2)*.028*(1-(t-FLAP_SNAP_MS)/80):0;
  return{upper:Math.PI*Math.pow(drop,1.65),lower:follow<1?-Math.PI/2*(1-follow*follow):bounce,falling:t<FLAP_DROP_MS,following:t>=FLAP_FOLLOW_MS,settled:false};
}
