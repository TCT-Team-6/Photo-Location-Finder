import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDecryptTimeline,decryptFrame,SCRAMBLE_GLYPHS} from './decrypt-timeline';
test('one-second stillness then exact 600ms lock/scramble/resolve; held JSON is stable',()=>{
  const clock=createDecryptTimeline();clock.move({x:40,y:50},0);
  assert.equal(clock.frame(999).phase,'binary');assert.equal(clock.frame(1000).elapsed,0);
  assert.equal(clock.frame(1099).scramble,false);assert.equal(clock.frame(1100).scramble,true);
  assert.equal(clock.frame(1130).rgbSplit,true);assert.equal(clock.frame(1210).rgbSplit,false);
  assert.equal(clock.frame(1250).resolution,0);assert.equal(clock.frame(1350).scramble,false);
  assert.equal(clock.frame(1599).phase,'decoding');assert.equal(clock.frame(1600).phase,'json');
  assert.equal(clock.frame(99999).resolution,1);assert.match(SCRAMBLE_GLYPHS,/^[0-9A-F{}[\]:,"]+$/);
});
test('jitter under 2px does not restart; movement before reveal resets dwell',()=>{
  const c=createDecryptTimeline();c.move({x:0,y:0},0);c.move({x:1,y:1},500);assert.equal(c.frame(1000).phase,'decoding');
  c.reset();c.move({x:0,y:0},0);c.move({x:2,y:0},700);assert.equal(c.frame(1699).phase,'binary');assert.equal(c.frame(1700).phase,'decoding');
});
test('movement over 6 reverses from the currently resolved radius, never finishes first',()=>{
  const c=createDecryptTimeline();c.move({x:0,y:0},0);const prior=c.frame(1450);
  c.move({x:7,y:0},1450);assert.equal(c.frame(1450).resolution,prior.resolution);assert.equal(c.frame(1450).reverse,true);
  assert.ok(c.frame(1500).resolution<prior.resolution);assert.equal(c.frame(1700).phase,'binary');
  assert.equal(c.frame(2449).phase,'binary');assert.equal(c.frame(2450).phase,'decoding');
});
test('JSON reverses in 250ms; reset cancels all pending states; reduced motion resolves in 150ms',()=>{
  const c=createDecryptTimeline();c.move({x:1,y:2},0);c.frame(1600);c.move({x:8,y:2},1700);
  assert.equal(c.frame(1949).phase,'decoding');assert.equal(c.frame(1950).phase,'binary');c.reset();assert.equal(c.frame(99999).phase,'binary');
  c.move({x:0,y:0},0);assert.equal(c.frame(1149,true).phase,'decoding');assert.equal(c.frame(1150,true).phase,'json');
  for(let t=0;t<150;t+=10){const frame=decryptFrame(t,true);assert.equal(frame.scramble,false);assert.equal(frame.rgbSplit,false);assert.equal(frame.flash,0);}
});
