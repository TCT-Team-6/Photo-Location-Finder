import type { SpringAxis } from './loupe-physics';
import type { LoupePoint } from './loupe-dwell';
export const GLASS_MAGNIFICATION=1.6;
export const PHOTO_FEATHER_PX=12;
export const DATA_RESOLVE_MS=250;
export const HELD_LIFT=48;
/** Exact damped spring step; fast feedback springs remain stable at low frame rates. */
export function feedbackSpring(axis:SpringAxis,target:number,delta:number,stiffness:number,damping:number):SpringAxis {
  const dt=Math.max(0,Math.min(delta,1)),a=damping/2,w=Math.sqrt(stiffness-a*a);
  const offset=axis.position-target,b=(axis.velocity+a*offset)/w,e=Math.exp(-a*dt),s=Math.sin(w*dt),c=Math.cos(w*dt);
  return {position:target+e*(offset*c+b*s),velocity:e*((-a*offset+b*w)*c+(-a*b-offset*w)*s)};
}
export const pickupScale=(axis:SpringAxis,held:boolean,delta:number,reduced=false):SpringAxis=>reduced?{position:held?1.1:1,velocity:0}:feedbackSpring(axis,held?1.1:1,delta,2500,46);
export function compensatedRadius(dockRadius:number,scale:number,cameraZ:number,lift:number) {
  return dockRadius*scale*(cameraZ-lift)/(cameraZ-28);
}
export const smooth=(low:number,high:number,value:number)=>{const t=Math.max(0,Math.min(1,(value-low)/(high-low)));return t*t*(3-2*t);};
/** Point and distance are in sampled/refracted space; gradient converts CSS feather width. */
export function photoFeather(point:LoupePoint,size:{width:number;height:number},sourcePixelsPerCssPixel=1) {
  const distance=Math.min(point.x,size.width-point.x,point.y,size.height-point.y);
  const half=PHOTO_FEATHER_PX/2*Math.max(.0001,sourcePixelsPerCssPixel);
  return smooth(-half,half,distance);
}
export function lensPhotoContact(point:LoupePoint,radius:number,size:{width:number;height:number}) {
  const dx=Math.max(0,-point.x,point.x-size.width),dy=Math.max(0,-point.y,point.y-size.height);
  return smooth(-PHOTO_FEATHER_PX/2,PHOTO_FEATHER_PX/2,radius-Math.hypot(dx,dy));
}
export function advanceDataResolve(value:number,target:number,delta:number,reduced=false) {
  if(reduced)return target;
  const step=Math.max(0,Math.min(delta,1))/(DATA_RESOLVE_MS/1000);
  return value<target?Math.min(target,value+step):Math.max(target,value-step);
}
export function radialDataResolve(distance:number,progress:number) {const front=progress*1.12-.06;return 1-smooth(front-.06,front+.06,distance);}
export type TimedFade={value:number;from:number;target:number;elapsed:number};
export const fade=(value:number):TimedFade=>({value,from:value,target:value,elapsed:.15});
export function advanceFade(state:TimedFade,target:number,delta:number) {
  if(state.target!==target){state.from=state.value;state.target=target;state.elapsed=0;}
  state.elapsed=Math.min(.15,state.elapsed+Math.max(0,delta));
  state.value=state.from+(state.target-state.from)*smooth(0,.15,state.elapsed);
  return state.value;
}
export function createCursorFeedback(){return {size:{position:36,velocity:0},dot:fade(0),color:fade(0),ring:fade(0)};}
export function advanceCursorFeedback(state:ReturnType<typeof createCursorFeedback>,target:{visible:boolean;interactive:boolean;held:boolean;photo:boolean},delta:number,reduced=false) {
  state.size=reduced?{position:36,velocity:0}:feedbackSpring(state.size,target.interactive?56:36,delta,900,38);
  advanceFade(state.dot,target.visible&&(!target.interactive||target.held)?1:0,delta);
  advanceFade(state.ring,target.visible&&!target.held?1:0,delta);
  advanceFade(state.color,target.photo?1:0,delta);
  return Math.abs(state.size.position-(target.interactive&&!reduced?56:36))>.01||Math.abs(state.size.velocity)>.02||[state.dot,state.ring,state.color].some(f=>f.elapsed<.15);
}
