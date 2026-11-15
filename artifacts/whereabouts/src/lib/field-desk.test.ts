import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPromptTypewriter} from './prompt-typewriter';
import {boundPoint,rubberbandPoint} from './loupe-bounds';
import {advanceTool,createToolMotion,pickUpTool,returnTool} from './loupe-kinematics';
import {GLASS_MAGNIFICATION} from './lens-feedback';
import {isFilingAcknowledged} from './filing-signals';

test('FILED requires an actual successful record acknowledgement, never a URL, demo, delete or failed result',()=>{
  assert.equal(isFilingAcknowledged(['createInvestigation'],{id:'record-41'}),true);
  assert.equal(isFilingAcknowledged(['createMissingPersonCase'],{id:'case-18'}),true);
  assert.equal(isFilingAcknowledged(['createCaseLead'],{id:'lead-27'}),true);
  for(const key of ['requestUploadUrl','deleteInvestigation','updateInvestigation','demo'])assert.equal(isFilingAcknowledged([key],{id:'record-41'}),false);
  for(const data of [null,{url:'signed-url'},{id:''},{error:'upload failed'}])assert.equal(isFilingAcknowledged(['createInvestigation'],data),false);
});
test('photo bounds resist exactly 20% of excess in either direction',()=>{const size={width:1000,height:800};assert.deepEqual(rubberbandPoint({x:-100,y:900},size),{x:-20,y:820});assert.deepEqual(rubberbandPoint({x:500,y:400},size),{x:500,y:400});assert.deepEqual(boundPoint({x:-20,y:820},size),{x:0,y:800});});
test('typing cancels example writer immediately, including already queued callbacks',()=>{let value='',pending:(()=>void)[]=[];const writer=createPromptTypewriter(v=>{value=v;},fn=>{pending.push(fn);return 1 as unknown as ReturnType<typeof setTimeout>;},()=>{});writer.start('Review the original');pending.shift()?.();assert.equal(value,'R');writer.stop();value='My real context';pending.shift()?.();assert.equal(value,'My real context');writer.start('Other',true);assert.equal(value,'Other');writer.stop();pending=[];});
test('out-of-bounds release reaches edge before cradle; new input interrupts immediately',()=>{const m=createToolMotion({x:500,y:250});pickUpTool(m,{x:-20,y:300});m.x.position=-20;m.y.position=300;returnTool(m,{width:1000,height:800});assert.deepEqual(m.returnEdge,{x:0,y:300});advanceTool(m,.21);assert.equal(m.x.position,0);assert.equal(m.returnEdge,null);assert.equal(m.mode,'returning');pickUpTool(m,{x:100,y:100});assert.equal(m.mode,'held');assert.equal(m.returnEdge,null);returnTool(m);for(let i=0;i<9;i++)advanceTool(m,.1);assert.equal(m.mode,'docked');});
test('pixel zoom is explicitly 2.5x',()=>assert.equal(GLASS_MAGNIFICATION,2.5));
