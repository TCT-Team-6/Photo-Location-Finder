import test from 'node:test';
import assert from 'node:assert/strict';
import {countDigits,createFlapState,flapPose,FLAP_DROP_MS,FLAP_FOLLOW_MS,FLAP_SETTLE_MS,FLAP_SNAP_MS,requestFlap,settleFlap} from './split-flap';

test('archive counts retain all digits beyond 99; zeros are padding, never invented increments',()=>{
  for(const[value,expected]of [[0,'00'],[7,'07'],[99,'99'],[100,'100'],[12893,'12893'],[1289345623,'1289345623'],[-1,'00'],[NaN,'00'],[7.9,'07']] as const)assert.equal(countDigits(value),expected);
  assert.equal(countDigits(Number.MAX_SAFE_INTEGER),'9007199254740991');
});
test('initial values are stationary and a real change flips directly to the new digit',()=>{
  const initial=createFlapState('7');
  assert.equal(initial.moving,false);
  assert.equal(requestFlap(initial,'7',100),initial);
  const next=requestFlap(initial,'3',100);
  assert.deepEqual(next,{from:'7',to:'3',queued:'3',started:100,moving:true});
  assert.equal(settleFlap(next,100+FLAP_SETTLE_MS-1),next);
  assert.deepEqual(settleFlap(next,100+FLAP_SETTLE_MS),createFlapState('3'));
});
test('updates during a cycle queue the latest real value without corrupting the falling card',()=>{
  const first=requestFlap(createFlapState('2'),'4',0);
  const queued=requestFlap(requestFlap(first,'8',40),'1',70);
  assert.equal(queued.from,'2');assert.equal(queued.to,'4');assert.equal(queued.queued,'1');
  const second=settleFlap(queued,FLAP_SETTLE_MS);
  assert.equal(second.from,'4');assert.equal(second.to,'1');assert.equal(second.started,FLAP_SETTLE_MS);
  assert.deepEqual(settleFlap(second,FLAP_SETTLE_MS*2),createFlapState('1'));
});
test('gravity fall crosses horizontal, exposes reverse, lower follows and settles perfectly flush',()=>{
  assert.equal(flapPose(0).upper,0);
  assert.ok(flapPose(FLAP_FOLLOW_MS).upper>Math.PI/2);
  assert.ok(flapPose(FLAP_DROP_MS-1).upper>Math.PI*.98);
  assert.equal(flapPose(FLAP_FOLLOW_MS-1).following,false);
  assert.equal(flapPose(FLAP_FOLLOW_MS).following,true);
  assert.equal(flapPose(FLAP_DROP_MS).falling,false);
  assert.equal(flapPose(FLAP_SNAP_MS).lower,0);
  assert.notEqual(flapPose(FLAP_SNAP_MS+20).lower,0);
  assert.deepEqual(flapPose(FLAP_SETTLE_MS),{upper:0,lower:0,falling:false,following:false,settled:true});
  assert.deepEqual(flapPose(FLAP_SETTLE_MS+900),flapPose(FLAP_SETTLE_MS));
});
test('reduced motion cancels any ongoing transition and goes straight to the true count',()=>{
  const moving=requestFlap(createFlapState('1'),'4',10);
  assert.deepEqual(requestFlap(moving,'7',40,true),createFlapState('7'));
  assert.equal(flapPose(20,true).settled,true);
  assert.equal(flapPose(20,true).lower,0);
});
