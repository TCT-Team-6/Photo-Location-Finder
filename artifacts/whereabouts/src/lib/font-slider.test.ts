import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {FONT_KNOB_RADIUS,fontSliderMetrics,fontSliderPosition,fontSliderValue} from './font-slider';

test('pointer track positions and actual mesh positions share stepped endpoints and midpoint',()=>{
  for(const width of[160,224,280,320,420]){
    const {travel,projectedTravel}=fontSliderMetrics(width),left=37.5;
    for(let value=100;value<=150;value+=5){
      const x=left+width/2+fontSliderPosition(value,projectedTravel);
      assert.equal(fontSliderValue(x,left,width),value);
    }
    assert.equal(fontSliderPosition(100,travel),-travel/2);
    assert.equal(fontSliderPosition(150,travel),travel/2);
    assert.equal(fontSliderValue(left+width/2,left,width),125);
    assert.ok(projectedTravel+FONT_KNOB_RADIUS*2<width);
  }
});
test('drag capture outside the rail stays bounded without overshoot or elastic motion',()=>{
  assert.equal(fontSliderValue(-10000,20,320),100);
  assert.equal(fontSliderValue(10000,20,320),150);
  const {projectedTravel}=fontSliderMetrics(320);
  assert.equal(fontSliderValue(160+projectedTravel*.1,0,320),130);
});
test('slider is a real shared View with direct mesh placement and complete keyboard/pointer paths',()=>{
  const control=readFileSync(new URL('../components/font-size-slider.tsx',import.meta.url),'utf8');
  const model=readFileSync(new URL('../components/font-slider-model.tsx',import.meta.url),'utf8');
  assert.match(control,/<InstrumentView kind="fontslider" value=\{value\}/);
  assert.match(control,/role="slider" tabIndex=\{0\}/);
  for(const attr of ['aria-labelledby','aria-describedby','aria-valuemin','aria-valuemax','aria-valuenow','aria-valuetext','aria-orientation'])assert.ok(control.includes(attr));
  for(const event of ['onPointerDown','onPointerMove','onPointerUp','onPointerCancel','onLostPointerCapture','onKeyDown'])assert.ok(control.includes(event));
  assert.match(control,/setPointerCapture/);assert.match(control,/releasePointerCapture/);
  assert.match(control,/onClick=\{\(\)=>change\(100\)\}/);
  assert.match(model,/new ExtrudeGeometry/);assert.match(model,/bevelSize:\.8/);
  assert.match(model,/position=\{\[fontSliderPosition\(value,travel\),0,1\]\}/);
  assert.doesNotMatch(model,/Spring|useFrame|animate|transition|lerp\(.*value/);
  assert.doesNotMatch(control,/<Canvas|setTimeout|requestAnimationFrame/);
});
