import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {originalPhotoFile,overviewPhotoState} from './overview-photo';

const base={exists:true,video:false,loading:false,error:false,decoded:true};
test('original photo states distinguish empty, video, loading, failure and a decoded image',()=>{
  assert.equal(overviewPhotoState({...base,exists:false}),'empty');
  assert.equal(overviewPhotoState({...base,video:true,loading:true}),'video');
  assert.equal(overviewPhotoState({...base,loading:true}),'loading');
  assert.equal(overviewPhotoState({...base,decoded:false}),'loading');
  assert.equal(overviewPhotoState({...base,error:true}),'error');
  assert.equal(overviewPhotoState(base),'ready');
  assert.equal(overviewPhotoState({...base,error:true,loading:true}),'error');
});
test('only authenticated image blobs become original files; reject video, JSON and empty bodies',()=>{
  assert.equal(originalPhotoFile(undefined),null);
  assert.equal(originalPhotoFile('https://example.org/stock.jpg'),null);
  assert.equal(originalPhotoFile(new Blob([],{type:'image/png'})),null);
  assert.equal(originalPhotoFile(new Blob(['denied'],{type:'application/json'})),null);
  assert.equal(originalPhotoFile(new Blob(['video'],{type:'video/mp4'})),null);
  const file=originalPhotoFile(new Blob(['real original bytes'],{type:'image/jpeg'}));
  assert.ok(file instanceof File);assert.equal(file.type,'image/jpeg');assert.equal(file.size,19);
});
test('Overview uses the generated authenticated hook and shared Canvas; title, date and report remain HTML',()=>{
  const source=readFileSync(new URL('../components/overview-instruments.tsx',import.meta.url),'utf8');
  assert.match(source,/useGetInvestigationPhoto\(id/);
  assert.match(source,/enabled:Boolean\(id\)&&!video,queryKey:getGetInvestigationPhotoQueryKey\(id\)/);
  assert.match(source,/URL\.revokeObjectURL\(url\)/);
  assert.match(source,/image\.onerror/);
  assert.match(source,/setRetry\(value=>value\+1\)/);
  assert.match(source,/kind="archiveprint" media=\{file\}/);
  assert.match(source,/href=\{`\/investigation\/\$\{item\.id\}`\}/);
  assert.match(source,/\{date\}/);
  assert.doesNotMatch(source,/<Canvas|\bfetch\(|https:\/\//);
});
test('personal counts and photographs cannot fall back to another value or specimen image',()=>{
  const source=readFileSync(new URL('../components/InstrumentKit.tsx',import.meta.url),'utf8');
  assert.match(source,/if\(kind==='splitflap'\|\|kind==='archiveprint'\|\|kind==='fontslider'\|\|kind==='leadpaper'\)\{setPng\(undefined\);return;\}/);
});
