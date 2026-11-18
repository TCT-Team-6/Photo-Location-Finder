import type {PerspectiveCamera,WebGLRenderer} from 'three';
import type {InstrumentRect} from './instrument-alignment';

/** Use a nonnegative framebuffer viewport, cropping the projection by exactly
 * the same amount. A smaller viewport without that crop would shrink the model.
 * Rectangles are CSS/browser viewport coordinates, not drawing-buffer pixels. */
export function instrumentViewViewport(canvas:InstrumentRect,track:InstrumentRect){
  const left=track.left-canvas.left,bottom=canvas.top+canvas.height-track.top-track.height;
  const x=Math.min(canvas.width,Math.max(0,left)),y=Math.min(canvas.height,Math.max(0,bottom));
  const width=Math.max(0,Math.min(canvas.width,left+track.width)-x);
  const height=Math.max(0,Math.min(canvas.height,bottom+track.height)-y);
  const viewport={left:x,bottom:y,width,height};
  const offsetX=x-left,offsetY=canvas.height-y-height-(track.top-canvas.top);
  const cropped=width>0&&height>0&&(offsetX!==0||offsetY!==0||width!==track.width||height!==track.height);
  return{viewport,scissor:{...viewport},crop:cropped?{fullWidth:track.width,fullHeight:track.height,offsetX,offsetY,width,height}:null};
}
export function applyInstrumentViewViewport(
  renderer:Pick<WebGLRenderer,'setViewport'|'setScissor'|'setScissorTest'>,
  canvas:InstrumentRect,track:InstrumentRect,camera:PerspectiveCamera,
){
  const{viewport,scissor,crop}=instrumentViewViewport(canvas,track),fullAspect=track.width>0&&track.height>0?track.width/track.height:1;
  const aspect=Number.isFinite(camera.aspect)&&camera.aspect>0?camera.aspect:fullAspect,previous=camera.view?{...camera.view}:null;
  camera.aspect=fullAspect;
  if(crop)camera.setViewOffset(crop.fullWidth,crop.fullHeight,crop.offsetX,crop.offsetY,crop.width,crop.height);
  else camera.clearViewOffset();
  // An entirely offscreen View may get one final Drei render. Its empty scissor
  // suppresses all pixels, while a 1x1 viewport avoids zero-size transmission RTs.
  renderer.setViewport(viewport.left,viewport.bottom,Math.max(1,viewport.width),Math.max(1,viewport.height));
  renderer.setScissor(scissor.left,scissor.bottom,scissor.width,scissor.height);
  renderer.setScissorTest(true);
  // Native Drei events normalize pointers against the FULL tracked rectangle.
  // Restore synchronously in Scene.onAfterRender, before events can run.
  return()=>{
    if(previous?.enabled)camera.setViewOffset(previous.fullWidth,previous.fullHeight,previous.offsetX,previous.offsetY,previous.width,previous.height);
    else camera.clearViewOffset();
    camera.aspect=aspect;camera.updateProjectionMatrix();
  };
}
/** A fallback must not override an inert ancestor's inherited visibility. */
export function showInstrumentFallback(visible:boolean,loaded:boolean,ready:boolean,available:boolean){
  return visible&&loaded&&(!ready||!available);
}
