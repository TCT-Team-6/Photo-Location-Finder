import assert from 'node:assert/strict';
import test from 'node:test';
import {defaultPreferences,normalizePreferences,PREFERENCES_KEY,readPreferences,snapTextSize,textSizeKey,validTextSize,writePreferences} from './app-preferences';

test('old preferences acquire 100% text size without changing valid theme, font or contrast',()=>{
  assert.deepEqual(normalizePreferences({theme:'ocean',font:'dyslexic',highContrast:true}),{theme:'ocean',font:'dyslexic',highContrast:true,textSize:100});
  assert.deepEqual(normalizePreferences(null),defaultPreferences);
  assert.deepEqual(normalizePreferences([]),defaultPreferences);
  assert.deepEqual(normalizePreferences({theme:'toString',font:'unknown',highContrast:'true',textSize:'125'}),defaultPreferences);
});
test('persisted text size accepts only finite, in-range numeric five-percent steps',()=>{
  for(let size=100;size<=150;size+=5)assert.equal(validTextSize(size),size);
  for(const value of [undefined,null,'125',true,{},[],99,151,102,127.5,Infinity,-Infinity,NaN])assert.equal(validTextSize(value),100);
});
test('preferences round-trip under the existing key; Reset to 100 retains other choices',()=>{
  const data=new Map<string,string>(),storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  assert.equal(writePreferences(storage,{theme:'sunset',font:'sans',highContrast:true,textSize:145}),true);
  assert.equal(data.size,1);assert.ok(data.has(PREFERENCES_KEY));
  const loaded=readPreferences(storage);
  assert.equal(loaded.textSize,145);
  writePreferences(storage,{...loaded,textSize:100});
  assert.deepEqual(readPreferences(storage),{theme:'sunset',font:'sans',highContrast:true,textSize:100});
});
test('broken JSON, missing storage, and storage exceptions never break the desk',()=>{
  for(const raw of ['{bad','null','42','"hello"','[]'])assert.deepEqual(readPreferences({getItem:()=>raw}),defaultPreferences);
  assert.deepEqual(readPreferences({getItem:()=>null}),defaultPreferences);
  assert.deepEqual(readPreferences({getItem:()=>{throw new Error('blocked');}}),defaultPreferences);
  assert.equal(writePreferences({setItem:()=>{throw new Error('quota');}},defaultPreferences),false);
});
test('keyboard values are bounded and precise; repeated arrows step, Home/End jump',()=>{
  assert.equal(textSizeKey(100,'ArrowRight'),105);
  assert.equal(textSizeKey(125,'ArrowUp'),130);
  assert.equal(textSizeKey(125,'ArrowLeft'),120);
  assert.equal(textSizeKey(125,'ArrowDown'),120);
  assert.equal(textSizeKey(150,'ArrowRight'),150);
  assert.equal(textSizeKey(100,'ArrowLeft'),100);
  assert.equal(textSizeKey(125,'Home'),100);
  assert.equal(textSizeKey(125,'End'),150);
  assert.equal(textSizeKey(125,'Tab'),null);
  assert.equal(snapTextSize(126),125);assert.equal(snapTextSize(149),150);assert.equal(snapTextSize(-30),100);assert.equal(snapTextSize(NaN),100);
});
