import type { LoupePoint } from './loupe-dwell';
export function boundPoint(point:LoupePoint,size:{width:number;height:number}):LoupePoint{return {x:Math.max(0,Math.min(size.width,point.x)),y:Math.max(0,Math.min(size.height,point.y))};}
export function rubberbandPoint(point:LoupePoint,size:{width:number;height:number},resistance=.2):LoupePoint{const edge=boundPoint(point,size);return {x:edge.x+(point.x-edge.x)*resistance,y:edge.y+(point.y-edge.y)*resistance};}
