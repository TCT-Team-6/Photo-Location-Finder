import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceCursorFeedback,advanceDataResolve,compensatedRadius,createCursorFeedback,lensPhotoContact,photoFeather,pickupScale,radialDataResolve } from './lens-feedback';

test('pickup is 1.1x, peaks around 1.12x and settles in approximately 200ms; return uses the same spring',()=>{
  let scale={position:1,velocity:0},max=1;
  for(let i=0;i<12;i++){scale=pickupScale(scale,true,1/60);max=Math.max(max,scale.position);}
  assert.ok(max>1.11&&max<=1.121);assert.ok(Math.abs(scale.position-1.1)<.003);
  for(let i=0;i<12;i++)scale=pickupScale(scale,false,1/60);
  assert.ok(Math.abs(scale.position-1)<.003);
});
test('lift perspective cannot turn a 1.1x pickup into a larger visible loupe',()=>{
  for(const cameraZ of[750,1500,3000]){
    const dock=90*cameraZ/(cameraZ-28);
    const held=compensatedRadius(90,1.1,cameraZ,48)*cameraZ/(cameraZ-48);
    assert.ok(Math.abs(held/dock-1.1)<1e-10);
  }
});
test('photo blend follows each fragment over a 12px feather, even while lens center is on panel',()=>{
  const size={width:1000,height:800};
  assert.equal(photoFeather({x:994,y:400},size),1);
  assert.equal(photoFeather({x:1000,y:400},size),.5);
  assert.equal(photoFeather({x:1006,y:400},size),0);
  assert.equal(photoFeather({x:1050,y:400},size),0);
  assert.equal(lensPhotoContact({x:1050,y:400},100,size),1);
  let previous=1;
  for(let x=994;x<=1006;x+=.25){const next=photoFeather({x,y:400},size);assert.ok(next<=previous&&previous-next<.04);previous=next;}
});
test('data resolve and reverse take 250ms, and the radial reveal reaches the entire rim without a switch',()=>{
  let value=0;
  for(let i=0;i<10;i++){value=advanceDataResolve(value,1,.025);if(i<9)assert.ok(value<1);}
  assert.ok(value>.999);
  assert.equal(radialDataResolve(0,0),0);
  assert.ok(radialDataResolve(0,.2)>.99);
  assert.equal(radialDataResolve(.9,.2),0);
  assert.equal(radialDataResolve(1,1),1);
  for(let i=0;i<10;i++)value=advanceDataResolve(value,0,.025);
  assert.ok(value<1e-10);
});
test('refracted mask removes the old seam strip and preserves a 12 CSS-pixel feather at different DPR/curvature',()=>{
  const size={width:1000,height:800},center=980;
  for(const slope of[1/1.6,1.075/1.6,1/2.5,1.075/2.5])for(const dpr of[1,1.6,2,3]){
    const boundaryScreen=center+(size.width-center)/slope;
    const sourcePerCssPixel=Math.hypot(slope/dpr*dpr,0);
    const mask=(screenX:number)=>photoFeather({x:center+(screenX-center)*slope,y:400},size,sourcePerCssPixel);
    assert.ok(Math.abs(mask(boundaryScreen)-.5)<1e-10);
    assert.ok(mask(boundaryScreen-6)>1-1e-10);
    assert.ok(mask(boundaryScreen+6)<1e-10);
  }
  // At screen X1006, the old screen-space mask was zero, but refraction still
  // sampled photo X996.25. That mismatch exposed an original-photo strip.
  assert.equal(photoFeather({x:1006,y:400},size),0);
  assert.equal(photoFeather({x:996.25,y:400},size,1/1.6),1);
});
test('three hover/leave cycles spring size and fade dot/color over 150ms, not one frame',()=>{
  const state=createCursorFeedback(),normal={visible:true,interactive:false,held:false,photo:false};
  for(let i=0;i<20;i++)advanceCursorFeedback(state,normal,1/60);
  for(let button=0;button<3;button++){
    const hover={...normal,interactive:true,photo:true};
    advanceCursorFeedback(state,hover,1/60);
    assert.ok(state.size.position>36&&state.size.position<56);
    assert.ok(state.dot.value>0&&state.dot.value<1);
    assert.ok(state.color.value>0&&state.color.value<1);
    let max=state.size.position;
    for(let i=0;i<14;i++){advanceCursorFeedback(state,hover,1/60);max=Math.max(max,state.size.position);}
    assert.ok(max>56&&max<58);assert.ok(Math.abs(state.size.position-56)<.25);
    assert.equal(state.dot.value,0);assert.equal(state.color.value,1);
    advanceCursorFeedback(state,normal,1/60);assert.ok(state.dot.value>0&&state.dot.value<1);
    for(let i=0;i<29;i++)advanceCursorFeedback(state,normal,1/60);
    assert.ok(Math.abs(state.size.position-36)<.02);assert.equal(state.dot.value,1);assert.equal(state.color.value,0);
  }
});
test('reduced motion retains fixed cursor size and immediate loupe scale without overshoot',()=>{
  const state=createCursorFeedback();
  advanceCursorFeedback(state,{visible:true,interactive:true,held:false,photo:true},1/60,true);
  assert.equal(state.size.position,36);assert.equal(state.size.velocity,0);
  assert.equal(pickupScale({position:1,velocity:200},true,.016,true).position,1.1);
});
