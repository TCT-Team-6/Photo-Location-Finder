import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PerspectiveCamera,Raycaster,Vector2,Vector3} from 'three';
import {applyInstrumentViewViewport,instrumentViewViewport,showInstrumentFallback} from './instrument-viewport';
import {INSTRUMENT_FOV,pixelCameraDistance} from './instrument-kit';

const renderer={setViewport:()=>{},setScissor:()=>{},setScissorTest:()=>{}};
function calibratedCamera(track:{width:number;height:number}){
  const camera=new PerspectiveCamera(INSTRUMENT_FOV,track.width/track.height,.1,10000);
  camera.position.z=pixelCameraDistance(track.height);camera.updateMatrixWorld();return camera;
}

test('a bottom-crossing View at 1280x720 clips only at the actual canvas bottom, never at header height',()=>{
  const result=instrumentViewViewport({left:0,top:0,width:1265,height:720},{left:420,top:582,width:224,height:220});
  assert.deepEqual(result.viewport,{left:420,bottom:0,width:224,height:138});
  assert.deepEqual(result.scissor,{left:420,bottom:0,width:224,height:138});
  assert.deepEqual(result.crop,{fullWidth:224,fullHeight:220,offsetX:0,offsetY:0,width:224,height:138});
  // Scissor spans screen y582..720; it must not end 70px early at y650.
  assert.equal(720-result.scissor.bottom,720);
});
test('the exact failing negative-75px viewport becomes a cropped nonnegative viewport',()=>{
  const canvas={left:0,top:0,width:1265,height:720},track={left:588,top:421,width:669,height:374};
  const result=instrumentViewViewport(canvas,track),camera=calibratedCamera(track),restore=applyInstrumentViewViewport(renderer,canvas,track,camera);
  assert.deepEqual(result.viewport,{left:588,bottom:0,width:669,height:299});
  assert.deepEqual(camera.view,{enabled:true,fullWidth:669,fullHeight:374,offsetX:0,offsetY:0,width:669,height:299});
  restore();assert.equal(camera.view?.enabled,false);
});
test('nonzero canvas origins are relative once, not added as an extra header offset',()=>{
  const result=instrumentViewViewport({left:15,top:70,width:1265,height:650},{left:435,top:582,width:224,height:220});
  assert.deepEqual(result.viewport,{left:420,bottom:0,width:224,height:138});
  assert.deepEqual(result.scissor,{left:420,bottom:0,width:224,height:138});
});
test('actual render pass sets viewport before intersected scissor and enables the scissor',()=>{
  const calls:unknown[]=[],renderer={
    setViewport:(...args:unknown[])=>{calls.push(['viewport',...args]);},
    setScissor:(...args:unknown[])=>{calls.push(['scissor',...args]);},
    setScissorTest:(...args:unknown[])=>{calls.push(['test',...args]);},
  };
  const track={left:-18,top:650,width:224,height:220},camera=calibratedCamera(track);
  const restore=applyInstrumentViewViewport(renderer,{left:0,top:0,width:1265,height:720},track,camera);
  assert.deepEqual(calls,[['viewport',0,0,206,70],['scissor',0,0,206,70],['test',true]]);
  assert.deepEqual(camera.view,{enabled:true,fullWidth:224,fullHeight:220,offsetX:18,offsetY:0,width:206,height:70});restore();
});
test('fully offscreen Views have empty scissors rather than invalid negative dimensions',()=>{
  for(const track of[{left:0,top:850,width:224,height:220},{left:1400,top:0,width:224,height:220},{left:-500,top:-400,width:224,height:220}]){
    const{scissor}=instrumentViewViewport({left:0,top:0,width:1265,height:720},track);
    assert.ok(scissor.width>=0&&scissor.height>=0);assert.ok(scissor.width===0||scissor.height===0);
  }
});
test('projection cropping preserves world-to-CSS-pixel positions and scale on all four edges',()=>{
  const canvas={left:0,top:0,width:1265,height:720};
  for(const track of[
    {left:588,top:421,width:669,height:374},{left:-30,top:421,width:669,height:374},
    {left:900,top:-80,width:669,height:374},{left:-30,top:-80,width:669,height:374},
    {left:100,top:100,width:669,height:374},
  ]){
    const camera=calibratedCamera(track),points=[new Vector3(0,0,0),new Vector3(1,0,0),new Vector3(31,-42,38),new Vector3(-37,28,18)];
    const before=points.map(point=>{const p=point.clone().project(camera);return{x:track.left+(p.x+1)*track.width/2,y:track.top+(1-p.y)*track.height/2};});
    const restore=applyInstrumentViewViewport(renderer,canvas,track,camera),{viewport}=instrumentViewViewport(canvas,track);
    const after=points.map(point=>{const p=point.clone().project(camera);return{x:viewport.left+(p.x+1)*viewport.width/2,y:canvas.height-viewport.bottom-(p.y+1)*viewport.height/2};});
    for(let i=0;i<points.length;i++){assert.ok(Math.abs(after[i].x-before[i].x)<1e-9);assert.ok(Math.abs(after[i].y-before[i].y)<1e-9);}
    assert.ok(Math.abs(after[1].x-after[0].x-1)<1e-9);restore();
  }
});
test('restored camera keeps full-track native raycasting identical after cropped rendering',()=>{
  const canvas={left:0,top:0,width:1265,height:720},track={left:588,top:421,width:669,height:374},camera=calibratedCamera(track);
  const pointer=new Vector2(.21,-.33),before=new Raycaster();before.setFromCamera(pointer,camera);
  const restore=applyInstrumentViewViewport(renderer,canvas,track,camera);assert.equal(camera.view?.enabled,true);restore();
  const after=new Raycaster();after.setFromCamera(pointer,camera);
  assert.ok(before.ray.origin.distanceTo(after.ray.origin)<1e-12);assert.ok(before.ray.direction.distanceTo(after.ray.direction)<1e-12);
  assert.equal(camera.aspect,track.width/track.height);assert.equal(camera.view?.enabled,false);
});
test('fully visible Views clear previous offsets and offscreen Views never create invalid projections',()=>{
  const canvas={left:0,top:0,width:1265,height:720},track={left:100,top:100,width:669,height:374},camera=calibratedCamera(track);
  camera.setViewOffset(669,374,0,0,669,299);
  const restore=applyInstrumentViewViewport(renderer,canvas,track,camera);
  assert.equal(camera.view?.enabled,false);restore();
  camera.clearViewOffset();
  const restoreOffscreen=applyInstrumentViewViewport(renderer,canvas,{...track,top:900},camera);
  assert.equal(camera.projectionMatrix.elements.every(Number.isFinite),true);restoreOffscreen();
  // A tracked element can become display:none before its portal unmounts.
  camera.aspect=NaN;
  const restoreHidden=applyInstrumentViewViewport(renderer,canvas,{left:0,top:0,width:0,height:0},camera);
  assert.equal(camera.projectionMatrix.elements.every(Number.isFinite),true);restoreHidden();
  assert.equal(camera.projectionMatrix.elements.every(Number.isFinite),true);
});
test('inactive fallback PNGs cannot paint through a visibility-hidden inert panel',()=>{
  for(const ready of[true,false])for(const available of[true,false])assert.equal(showInstrumentFallback(false,true,ready,available),false);
  assert.equal(showInstrumentFallback(true,true,false,true),true);assert.equal(showInstrumentFallback(true,true,true,true),false);
  assert.equal(showInstrumentFallback(true,true,true,false),true);assert.equal(showInstrumentFallback(true,false,false,false),false);
});
test('inactive tracked placeholders have no Drei clear-owning portal and scene exports bypass screen scissoring',()=>{
  const source=readFileSync(new URL('../components/InstrumentKit.tsx',import.meta.url),'utf8');
  assert.match(source,/visible&&rendering\.available\?<View ref=\{local\}/);
  assert.match(source,/:<div ref=\{local\} className="physical-view instrument-track"/);
  assert.match(source,/setSize\(rect\.width,rect\.height,rect\.top,rect\.left\)/);
  assert.match(source,/if\(capturingInstrumentFrame\)return/);
  assert.match(source,/scene\.onAfterRender=finish/);
  assert.match(source,/finally\{restore\?\.\(\);restore=undefined;\}/);
  assert.match(source,/capturingInstrumentFrame=true;try\{gl\.render\(scene,camera\);\}finally\{capturingInstrumentFrame=false;\}/);
});
