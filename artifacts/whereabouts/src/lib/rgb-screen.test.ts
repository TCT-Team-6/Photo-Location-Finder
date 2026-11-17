import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rgbEmitter,RGB_SCREEN_GLSL} from './rgb-screen';
import {wallGlyphLayout} from './loupe-wall';
test('RGB emitter lights each separate strip with its own source channel, and black has no emitted light',()=>{
  for(let channel=0;channel<3;channel++){
    const radiance=rgbEmitter([1,1,1],(channel+.5)/3,.5);
    assert.ok(radiance[channel]>1);assert.equal(radiance[(channel+1)%3],.015);
    assert.deepEqual(rgbEmitter([0,0,0],(channel+.5)/3,.5),[0,0,0]);
    const bright=rgbEmitter([.8,.8,.8],(channel+.5)/3,.5),dim=rgbEmitter([.4,.4,.4],(channel+.5)/3,.5);assert.equal(dim[channel]/bright[channel],.5);
  }
  assert.ok(rgbEmitter([1,1,1],0,0)[0]<rgbEmitter([1,1,1],1/6,.5)[0]/8);
});
test('default data typography fits roughly twelve characters across the desktop tool at 6x',()=>{
  const font=wallGlyphLayout({actualBoundingBoxAscent:8,actualBoundingBoxDescent:0}),characters=178/(font.fontSize*.6*6);assert.ok(characters>=10&&characters<=14);
});
test('actual optical material includes shared RGB emitters, nearest DPR pixel sampling, real page capture and live-scene compositing',()=>{
  const code=readFileSync(new URL('./optical-loupe.ts',import.meta.url),'utf8'),capture=readFileSync(new URL('./page-capture.ts',import.meta.url),'utf8');
  assert.ok(code.includes('${RGB_SCREEN_GLSL}'));assert.ok(code.includes('rgbEmitter(values,cell)'));assert.ok(RGB_SCREEN_GLSL.includes('values*channel'));
  assert.ok(code.includes('floor((wallPoint+uStageOrigin)*uPixelDpr)'));assert.ok(code.includes('texture2D(uPage'));assert.ok(code.includes('texture2D(uScene'));assert.ok(code.includes('texture2D(uWall'));
  assert.ok(capture.includes('html2canvas(document.body'));assert.ok(capture.includes("window.addEventListener('scroll',schedule"));
  assert.ok(code.includes('[3,6,10].includes(next)'));
});
