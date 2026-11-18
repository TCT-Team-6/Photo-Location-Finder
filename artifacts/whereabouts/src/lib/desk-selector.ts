export const DESK_DETENTS=[-Math.PI/3,0,Math.PI/3] as const;
export const DESK_CATCH_RADIANS=6*Math.PI/180;
export type SelectorMotion={angle:number;from:number;target:number;started:number;duration:number;curve:'out'|'in-out';mode:'drag'|'timed';index:number};
export function createSelectorMotion(index:number):SelectorMotion{const angle=DESK_DETENTS[index]??0;return{angle,from:angle,target:angle,started:0,duration:0,curve:'in-out',mode:'timed',index};}
export function clampSelectorAngle(angle:number){return Math.max(DESK_DETENTS[0],Math.min(DESK_DETENTS[2],angle));}
export function nearestDeskDetent(angle:number){return DESK_DETENTS.reduce((best,item,i)=>Math.abs(item-angle)<Math.abs(DESK_DETENTS[best]-angle)?i:best,0);}
export function caughtDeskAngle(pointerAngle:number){const angle=clampSelectorAngle(pointerAngle),index=nearestDeskDetent(angle);return Math.abs(angle-DESK_DETENTS[index])<=DESK_CATCH_RADIANS+1e-10?DESK_DETENTS[index]:angle;}
export function selectorStop(pointerAngle:number,previous:number){const stop=pointerAngle<DESK_DETENTS[0]?-1:pointerAngle>DESK_DETENTS[2]?1:0;return{stop,thock:stop!==0&&stop!==previous};}
export function crossedDeskDetents(from:number,to:number){return DESK_DETENTS.map((angle,index)=>({angle,index})).filter(({angle})=>to>from?angle>from+1e-8&&angle<=to+1e-8:angle<from-1e-8&&angle>=to-1e-8).sort((a,b)=>to>from?a.angle-b.angle:b.angle-a.angle).map(item=>item.index);}
export function tactileAngle(from:number,to:number,elapsed:number,duration:number,curve:'out'|'in-out'='in-out'){
  const t=duration<=0?1:Math.max(0,Math.min(1,elapsed/duration)),eased=curve==='out'?1-(1-t)**3:t*t*(3-2*t);
  if(t===1)return to;if(t===0)return from;
  return from+(to-from)*eased;
}
export function unwrappedPointer(previous:number,current:number){let delta=current-previous;while(delta>Math.PI)delta-=Math.PI*2;while(delta< -Math.PI)delta+=Math.PI*2;return delta;}
export function startSelectorMotion(motion:SelectorMotion,index:number,now:number,duration:number,curve:'out'|'in-out'){
  motion.from=motion.angle;motion.target=DESK_DETENTS[index];motion.started=now;motion.duration=duration;motion.curve=curve;motion.mode='timed';motion.index=index;
}
