import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {caughtDeskAngle,clampSelectorAngle,createSelectorMotion,crossedDeskDetents,DESK_DETENTS,nearestDeskDetent,selectorStop,startSelectorMotion,tactileAngle,unwrappedPointer} from './desk-selector';

test('selector has exactly three finite detents and clamps at both physical stops',()=>{
  assert.deepEqual(DESK_DETENTS,[-Math.PI/3,0,Math.PI/3]);
  for(let angle=-9;angle<9;angle+=.03){assert.ok(clampSelectorAngle(angle)>=-Math.PI/3);assert.ok(clampSelectorAngle(angle)<=Math.PI/3);}
  assert.equal(nearestDeskDetent(-.9),0);assert.equal(nearestDeskDetent(.1),1);assert.equal(nearestDeskDetent(.9),2);
});
test('direct pointer angles catch only inside the inclusive six-degree band, without adding lag',()=>{
  for(const detent of DESK_DETENTS)for(const degrees of[-6,-3,0,3,6])assert.equal(caughtDeskAngle(detent+degrees*Math.PI/180),detent);
  for(const degrees of[-48,-20,18,47])assert.equal(caughtDeskAngle(degrees*Math.PI/180),degrees*Math.PI/180);
  assert.equal(unwrappedPointer(179*Math.PI/180,-179*Math.PI/180).toFixed(9),(2*Math.PI/180).toFixed(9));
});
test('a stop emits one thock until the pointer actually leaves and re-enters it',()=>{
  let previous=0,thocks=0;for(const angle of[1.2,1.4,2.5,3.2,1.8,.9,1.3]){const result=selectorStop(angle,previous);previous=result.stop;if(result.thock)thocks++;}
  assert.equal(thocks,2);assert.equal(selectorStop(-1.4,0).thock,true);assert.equal(selectorStop(-1.5,-1).thock,false);
});
test('detent crossings are ordered and do not replay the starting catch',()=>{
  assert.deepEqual(crossedDeskDetents(DESK_DETENTS[0],DESK_DETENTS[2]),[1,2]);
  assert.deepEqual(crossedDeskDetents(DESK_DETENTS[2],DESK_DETENTS[0]),[1,0]);
  assert.deepEqual(crossedDeskDetents(0,0),[]);assert.deepEqual(crossedDeskDetents(-.15,0),[1]);
});
test('70ms release and 120ms label motion stop exactly, monotonically, without spring overshoot',()=>{
  for(const duration of[60,70,120])for(const curve of['out','in-out'] as const)for(const[from,to]of[[-1,1],[1,-1]]){
    let last=from;for(let elapsed=0;elapsed<=duration;elapsed++){const next=tactileAngle(from,to,elapsed,duration,curve);assert.ok(next>=-1&&next<=1);assert.ok(to>from?next>=last:next<=last);last=next;}
    assert.equal(last,to);assert.equal(tactileAngle(from,to,duration+300,duration,curve),to);
  }
  const motion=createSelectorMotion(0);motion.angle=-.3;startSelectorMotion(motion,2,87,70,'out');
  assert.equal(motion.from,-.3);assert.equal(motion.started,87);assert.equal(motion.duration,70);assert.equal(motion.target,Math.PI/3);
});
test('new selector has fixed visible HTML radios and no legacy rotating labels or readout',()=>{
  const ui=readFileSync(new URL('../components/desk-selector.tsx',import.meta.url),'utf8'),model=readFileSync(new URL('../components/physical-models.tsx',import.meta.url),'utf8');
  assert.match(ui,/role="radiogroup"/);assert.match(ui,/role="radio"/);assert.match(ui,/label:'Investigations'/);assert.match(ui,/label:'Recreation'/);assert.match(ui,/label:'Journalism'/);assert.doesNotMatch(ui,/<output|role="slider"/);
  const dial=model.slice(model.indexOf('function Dial('),model.indexOf('function Shutter('));
  assert.doesNotMatch(dial,/<Spring|ArcText|fillText/);
  assert.match(dial,/teeth=\{60\}/);assert.match(dial,/toothDepth=\{2\}/);assert.match(dial,/roughness=\{\.5\}/);assert.match(dial,/c\.lineWidth=3/);
});
