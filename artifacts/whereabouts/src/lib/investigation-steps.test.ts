import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceInvestigationStep,canSubmitInvestigation,movePrint} from './investigation-steps';
import {printSpringFrames} from './print-motion';
test('file selection gates step 01; no earlier step or busy/empty form submits',()=>{
  assert.equal(advanceInvestigationStep(1,0),1);assert.equal(advanceInvestigationStep(1,1),2);assert.equal(advanceInvestigationStep(2,6),3);assert.equal(advanceInvestigationStep(3,6),3);
  for(const step of [1,2] as const)assert.equal(canSubmitInvestigation(step,6,false),false);
  assert.equal(canSubmitInvestigation(3,6,false),true);assert.equal(canSubmitInvestigation(3,0,false),false);assert.equal(canSubmitInvestigation(3,1,true),false);
});
test('sorting keeps file objects, request IDs, saved status and desk contracts intact',()=>{
  const rows=[{id:'a',file:{name:'redwood.jpg'},requestId:'stable-a',desk:'fake-news',status:'saved'},{id:'b',file:{name:'scene.png'},requestId:'stable-b',desk:'recreation',status:'selected'}];
  const sorted=movePrint(rows,'a',1);assert.equal(sorted[0],rows[1]);assert.equal(sorted[1],rows[0]);assert.equal(rows[0].id,'a');assert.deepEqual(movePrint(rows,'unknown',0),rows);
});
test('print inertia is a finite spring sequence that returns exactly to its layout position',()=>{
  const frames=printSpringFrames();assert.equal(frames.length,22);assert.equal(frames.at(-1)?.transform,'translateY(0)');assert.ok(frames.every(frame=>!String(frame.transform).includes('NaN')));assert.ok(frames.some(frame=>frame.transform!=='translateY(0)'));
});
