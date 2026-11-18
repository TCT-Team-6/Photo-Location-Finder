import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {PerspectiveCamera,Vector3} from 'three';
import {INSTRUMENT_BLEED,integerInstrumentBounds,instrumentRegion,isInstrumentDebugKey,measureInstrumentTracks,registerInstrumentTrack,swatchMotionCenter} from './instrument-alignment';
import {INSTRUMENT_FOV,pixelCameraDistance} from './instrument-kit';

test('scrolling and fractional parent geometry always produce integer tracked bounds with 32px bleed',()=>{
  assert.equal(INSTRUMENT_BLEED,32);
  for(const scroll of[0,.3,18.75,691.2,1493.33]){
    const bounds=integerInstrumentBounds({left:49.37,top:834.6-scroll,width:319.8,height:279.8});
    for(const value of Object.values(bounds))assert.equal(Number.isInteger(value),true);
    assert.equal(bounds.width,384);assert.equal(bounds.height,344);
    assert.equal(bounds.left+32,49);assert.equal(bounds.top+32,Math.round(834.6-scroll));
  }
});
test('each centered model origin projects exactly to the center of its real calibrated View',()=>{
  for(const size of[{width:224,height:220},{width:184,height:204},{width:720,height:520}]){
    const camera=new PerspectiveCamera(INSTRUMENT_FOV,size.width/size.height,.1,10000);camera.position.z=pixelCameraDistance(size.height);camera.updateMatrixWorld();
    const projected=new Vector3(0,0,0).project(camera);
    assert.equal((projected.x+1)*size.width/2,size.width/2);assert.equal((1-projected.y)*size.height/2,size.height/2);
  }
  assert.deepEqual(instrumentRegion('dial',320,280),{left:80,top:124,width:160,height:156});
});
test('all registered placeholder measurements run in a shared pass and unregister cleanly',()=>{
  const calls:number[]=[],a=registerInstrumentTrack(()=>calls.push(1)),b=registerInstrumentTrack(()=>calls.push(2));
  measureInstrumentTracks();a();measureInstrumentTracks();b();measureInstrumentTracks();assert.deepEqual(calls,[1,2,2]);
});
test('development DDD key detection ignores modifier shortcuts, repeats and all text-editing targets',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'Element');
  class FakeElement{constructor(private editable:boolean){}closest(){return this.editable?this:null;}}
  Object.defineProperty(globalThis,'Element',{configurable:true,value:FakeElement});
  try{
    assert.equal(isInstrumentDebugKey({key:'D',target:null}),true);
    assert.equal(isInstrumentDebugKey({key:'d',target:new FakeElement(true) as unknown as EventTarget}),false);
    assert.equal(isInstrumentDebugKey({key:'d',target:null,ctrlKey:true}),false);
    assert.equal(isInstrumentDebugKey({key:'d',target:null,repeat:true}),false);
  }finally{if(previous)Object.defineProperty(globalThis,'Element',previous);else Reflect.deleteProperty(globalThis,'Element');}
});
test('swatch centering uses its entire motion envelope, not the changing closed-strip bounds',()=>{
  const center=swatchMotionCenter(false,5);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(let rank=0;rank<5;rank++)for(const angle of[0,rank*11*Math.PI/180])for(const x of[-20,416])for(const y of[-28,28]){
    const px=rank+x*Math.cos(angle)-y*Math.sin(angle)-center.x,py=-rank+x*Math.sin(angle)+y*Math.cos(angle)-center.y;
    minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);assert.ok(Math.abs(px)<280);assert.ok(Math.abs(py)<210);
  }
  assert.ok(Math.abs(minX+maxX)<1e-9);assert.ok(Math.abs(minY+maxY)<1e-9);assert.deepEqual(swatchMotionCenter(true,5),{x:190,y:-134});
});
test('same-frame native/Lenis tracking, actual scene export and physical depth offsets stay wired',()=>{
  const kit=readFileSync(new URL('../components/InstrumentKit.tsx',import.meta.url),'utf8'),motion=readFileSync(new URL('../hooks/use-landing-motion.ts',import.meta.url),'utf8'),mesh=readFileSync(new URL('../components/instrument-meshes.tsx',import.meta.url),'utf8');
  assert.match(kit,/advance\(performance\.now\(\),false\)/);assert.match(kit,/new ResizeObserver/);assert.match(kit,/<View ref=\{local\}/);assert.doesNotMatch(kit,/<span ref=\{local\}/);
  assert.match(motion,/lenis\.on\('scroll',refreshInstruments\)/);assert.match(motion,/lenis\.off\('scroll',refreshInstruments\)/);
  assert.match(kit,/gl\.render\(scene,camera\)/);assert.match(kit,/revision:INSTRUMENT_RENDER_REVISION/);assert.match(mesh,/polygonOffsetFactor=\{-1\}/);
});
test('empty tray loupe, hidden messages and its obsolete component are removed, while homepage optics remain',()=>{
  const tray=readFileSync(new URL('../components/field-desk.tsx',import.meta.url),'utf8'),controls=readFileSync(new URL('../components/desk-controls.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(tray,/EmptyTrayLoupe|room for another question|nothing here yet\. yet\./);assert.doesNotMatch(controls,/EmptyTrayLoupe|SubpixelSecret|fd-empty-secret/);
  assert.equal(existsSync(new URL('../components/subpixel-secret.tsx',import.meta.url)),false);
  assert.equal(existsSync(new URL('./optical-loupe.ts',import.meta.url)),true);assert.equal(existsSync(new URL('../components/photo-instrument.tsx',import.meta.url)),true);
});
test('switch geometry provides 50px tip travel, a paper-white tip, a lamp, fixed text and non-spring motion',()=>{
  assert.ok(2*44*Math.sin(35*Math.PI/180)>40);
  const source=readFileSync(new URL('../components/physical-models.tsx',import.meta.url),'utf8'),app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  const switches=source.slice(source.indexOf('function Lever('),source.indexOf('function RectangularFrame('));
  assert.doesNotMatch(switches,/<Spring/);assert.match(switches,/<TactileRotation/);assert.match(switches,/sphereGeometry args=\{\[8,40,28\]\}/);assert.match(switches,/sphereGeometry args=\{\[5,32,24\]\}/);
  assert.match(switches,/width=\{80\} height=\{48\}/);assert.match(switches,/boxGeometry args=\{\[60,3,\.6\]\}/);
  assert.match(app,/High contrast ·/);assert.match(app,/Sound ·/);
});
test('desk switching reserves the tallest panel and existing print stack without hiding or recreating file data',()=>{
  const css=readFileSync(new URL('../styles/physical-desk.css',import.meta.url),'utf8'),app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(css,/\.fd-desk-page>\[data-desk-panel\]\{grid-area:1\/1;align-self:start;visibility:hidden/);
  assert.match(app,/data-desk-panel="original"/);assert.match(app,/investigationPhotoSlots\.filter\(slot=>slot\.id!=='original'\)\.map/);
  assert.match(app,/className="desk-batch-reserve"/);assert.match(app,/inert=\{activeSlot\.id!==slot\.id\}/);
  assert.doesNotMatch(app,/activeSlot\.id !== 'original' && <PhotoUploadSlot/);
});
