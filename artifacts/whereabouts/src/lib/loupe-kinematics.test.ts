import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTool, createToolMotion, pickUpTool, returnTool, REST_ANGLE } from './loupe-kinematics';
test('hover never picks up; docked look is limited to four degrees and near lift to four pixels',()=>{
  const m=createToolMotion({x:1000,y:240});
  for(let i=0;i<120;i++)advanceTool(m,1/60);
  assert.equal(m.lift.position,28);
  m.hover={x:1080,y:245};for(let i=0;i<180;i++)advanceTool(m,1/60);
  assert.equal(m.mode,'docked');assert.ok(Math.abs(m.lift.position-32)<.001);
  assert.ok(Math.abs(m.tiltX.position)<=Math.PI/45&&Math.abs(m.tiltY.position)<=Math.PI/45);
});
test('held position genuinely lags with speed tilt and a separate handle spring, capped at six degrees',()=>{
  const m=createToolMotion({x:1100,y:250});pickUpTool(m,{x:100,y:600});advanceTool(m,1/60);
  assert.ok(m.x.position>100&&m.x.position<1100);
  for(let i=0;i<60;i++){advanceTool(m,1/60);assert.ok(Math.abs(m.tiltX.position)<=Math.PI/30&&Math.abs(m.tiltY.position)<=Math.PI/30);}
  assert.ok(Math.abs(m.x.position-100)<1);
});
test('three different releases return to exactly the same cradle pose in about 0.8 seconds',()=>{
  const dock={x:1100,y:250},m=createToolMotion(dock);
  for(const [index,point]of[{x:120,y:180},{x:550,y:760},{x:900,y:450}].entries()){
    pickUpTool(m,point);for(let i=0;i<120;i++)advanceTool(m,1/60);
    returnTool(m);for(let i=0;i<49;i++)advanceTool(m,1/60);
    assert.equal(m.mode,'docked');assert.equal(m.returnedAt,index+1);
    assert.equal(m.x.position,dock.x);assert.equal(m.y.position,dock.y);assert.equal(m.roll.position,REST_ANGLE);
    assert.equal(m.tiltX.position,0);assert.equal(m.tiltY.position,0);assert.equal(m.swing.position,0);
  }
});
test('return clock does not slow down on a low frame-rate device; reduced motion returns directly',()=>{
  const m=createToolMotion({x:1000,y:250});pickUpTool(m,{x:100,y:400});advanceTool(m,1/60);returnTool(m);
  for(let i=0;i<9;i++)advanceTool(m,.1);assert.equal(m.mode,'docked');
  pickUpTool(m,{x:500,y:400});advanceTool(m,.01,true);assert.equal(m.x.position,500);returnTool(m);advanceTool(m,.01,true);
  assert.equal(m.mode,'docked');assert.equal(m.x.position,1000);assert.equal(m.returnedAt,2);
});
