import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instrumentLayout, overPhoto, scrollLight } from './instrument-layout';
test('desktop photo and 22% panel fill one viewport without a gap',()=>{
  const layout=instrumentLayout(1440,1000);
  assert.equal(layout.panelWidth,316.8);
  assert.equal(layout.photoWidth+layout.panelWidth,1440);
  assert.equal(layout.photoHeight,1000);
  assert.equal(instrumentLayout(800,900).panelWidth,280);
  assert.equal(instrumentLayout(2400,1000).panelWidth,380);
});
test('mobile reserves exactly 160px for its horizontal tool strip',()=>{
  const layout=instrumentLayout(390,844);
  assert.equal(layout.photoWidth,390);assert.equal(layout.photoHeight,684);
  assert.equal(overPhoto({x:200,y:683},layout),true);
  assert.equal(overPhoto(layout.dock,layout),false);
  assert.ok(layout.dock.y>layout.photoHeight&&layout.dock.y<844);
});
test('one shared light moves left/high/right; shadows oppose it and shorten at center',()=>{
  const left=scrollLight(0),middle=scrollLight(.5),right=scrollLight(1);
  assert.ok(left.x<0&&right.x>0);assert.equal(middle.x,0);
  assert.ok(left.castX>0&&right.castX<0);assert.equal(middle.castX,0);
  assert.ok(middle.z>left.z&&middle.castY<left.castY&&middle.blur<left.blur);
  assert.ok(Math.abs(left.castX+right.castX)<1e-10);
});
