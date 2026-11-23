import {pixelCameraDistance} from './instrument-kit';
import {snapTextSize,TEXT_SIZE_MAX,TEXT_SIZE_MIN} from './app-preferences';
export const FONT_KNOB_RADIUS=8;
export function fontSliderMetrics(width:number,height=48){
  const travel=Math.min(240,Math.max(16,width-48)),distance=pixelCameraDistance(height+64);
  return{travel,projectedTravel:travel*distance/(distance-5)};
}
export function fontSliderPosition(value:number,travel:number){
  return((snapTextSize(value)-TEXT_SIZE_MIN)/(TEXT_SIZE_MAX-TEXT_SIZE_MIN)-.5)*travel;
}
export function fontSliderValue(clientX:number,left:number,width:number,height=48){
  const {projectedTravel}=fontSliderMetrics(width,height);
  return snapTextSize(TEXT_SIZE_MIN+((clientX-left-width/2)/projectedTravel+.5)*(TEXT_SIZE_MAX-TEXT_SIZE_MIN));
}
