import assert from 'node:assert/strict';
import test from 'node:test';
import type { Investigation } from '@workspace/api-client-react';
import { deskMatchesFilter, toggleDeskFilter } from './desk-filters';
import { interactionShiftIsRelevant } from './control-layout';
import { emptyReport, mayStartNext, pendingQueue, realStageStates } from './report-lifecycle';
import { awaitCompletedReport, SavedAnalysisFailure } from './report-polling';
import { processInvestigationPhotoUploads } from './investigation-photo-uploads';

test('elapsed time cannot advance unavailable pipeline substages', () => {
  for(let elapsed=0;elapsed<100000;elapsed+=117)assert.deepEqual(realStageStates('analyzing'),['done','running','waiting','waiting','waiting']);
  assert.deepEqual(realStageStates('uploading'),['running','waiting','waiting','waiting','waiting']);
  assert.deepEqual(realStageStates('completed'),Array(5).fill('done'));
  assert.equal(emptyReport.open,false);
});
test('video completion waits for an actual done record, not accepted or analyzing', async () => {
  let reads=0,waits=0;
  const record=await awaitCompletedReport('saved-video',{get:async id=>({id,status:++reads===4?'done':'analyzing'}) as Investigation,stopped:()=>false,wait:async()=>{waits++;}});
  assert.equal(record.status,'done');assert.equal(reads,4);assert.equal(waits,3);
});
test('unknown video status does not claim completion',async()=>{
  let stopped=false;
  await assert.rejects(awaitCompletedReport('pending',{get:async()=>({status:null}) as Investigation,stopped:()=>stopped,wait:async()=>{stopped=true;}}),{name:'AbortError'});
});
test('cancel stops polling locally without claiming server cancellation',async()=>{
  let stopped=false,reads=0;
  await assert.rejects(awaitCompletedReport('server-accepted',{get:async()=>{reads++;return {status:'analyzing'} as Investigation;},stopped:()=>stopped,wait:async()=>{stopped=true;}}),{name:'AbortError'});
  assert.equal(reads,1);
  const abort=new AbortController();assert.equal(mayStartNext(false,abort.signal),true);abort.abort();assert.equal(mayStartNext(false,abort.signal),false);assert.equal(mayStartNext(true,new AbortController().signal),false);
});
test('failed saved analysis carries its ID for retry instead of creating another record',async()=>{
  await assert.rejects(awaitCompletedReport('saved-id',{get:async()=>({status:'failed',analysisError:'Provider unavailable'}) as Investigation,stopped:()=>false}),(error:unknown)=>error instanceof SavedAnalysisFailure&&error.recordId==='saved-id'&&error.message==='Provider unavailable');
  assert.deepEqual(pendingQueue([{id:'saved',status:'saved'},{id:'failed',status:'error'},{id:'new',status:'ready'}]).map(i=>i.id),['failed','new']);
});
test('desk filter keys latch independently and an empty selection restores all desks',()=>{
  let value=toggleDeskFilter(0,0);assert.equal(deskMatchesFilter('original',value),true);assert.equal(deskMatchesFilter('recreation',value),false);
  value=toggleDeskFilter(value,2);assert.equal(deskMatchesFilter('fake-news',value),true);assert.equal(deskMatchesFilter('recreation',value),false);
  value=toggleDeskFilter(toggleDeskFilter(value,0),2);assert.equal(value,0);assert.equal(deskMatchesFilter('recreation',value),true);
});
test('layout monitor includes interaction shifts for exactly 500ms',()=>{
  assert.equal(interactionShiftIsRelevant(1000,999),false);assert.equal(interactionShiftIsRelevant(1000,1000),true);
  assert.equal(interactionShiftIsRelevant(1000,1500),true);assert.equal(interactionShiftIsRelevant(1000,1501),false);
});
test('cancel after a transfer prevents analysis and unstarted queue uploads, retaining input objects',async()=>{
  const abort=new AbortController(),files=[new File(['a'],'a.jpg',{type:'image/jpeg'}),new File(['b'],'b.jpg',{type:'image/jpeg'})];
  let uploads=0,creates=0,requests=0;
  const selected=files.map((file,i)=>({slot:{id:'original' as const,label:'Investigations',description:'Selected photo'},file,requestId:`stable-${i}`}));
  const result=await processInvestigationPhotoUploads({selected,title:'Retain this',context:'Private note',shotAt:'',signal:abort.signal,getContentType:()=> 'image/jpeg',
    requestUploadUrl:async()=>{requests++;return {uploadURL:'https://local.invalid/upload',objectPath:'/objects/test'};},
    uploadFile:async()=>{uploads++;abort.abort();},createInvestigation:async()=>{creates++;return{id:'unexpected',title:'unexpected'};}});
  assert.equal(uploads,1);assert.equal(creates,0);assert.equal(requests,1);assert.equal(selected[0].file,files[0]);assert.ok(result.failed.original);
});
