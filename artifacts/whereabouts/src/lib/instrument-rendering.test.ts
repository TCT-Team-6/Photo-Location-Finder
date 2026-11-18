import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Mesh,MeshPhysicalMaterial,PCFShadowMap,Raycaster,Vector3} from 'three';
import {counterDrum,counterDrumRotation,createCounterApertureGeometry} from './instrument-counter';
import {instrumentMaterial,instrumentRenderer,instrumentStudioSurround} from './instrument-kit';

test('printed geometry participates in the opaque transmission prepass, without changing the glass specification',()=>{
  const source=readFileSync(new URL('../components/instrument-meshes.tsx',import.meta.url),'utf8');
  assert.match(source,/transparent=\{false\}/);
  const glass=instrumentMaterial('Glass','#f4f4f2');
  assert.equal(glass.transmission,1);assert.equal(glass.roughness,.05);
  assert.equal(glass.thickness,2);assert.equal(glass.clearcoat,1);
  assert.equal(glass.depthWrite,false);
});
test('the key glass is a 3px upper hemisphere entirely above its printed paper',()=>{
  const source=readFileSync(new URL('../components/physical-models.tsx',import.meta.url),'utf8');
  assert.match(source,/position=\{\[0,0,15\.12\]\} rotation=\{\[Math\.PI\/2,0,0\]\} scale=\{\[1,3\/26,1\]\}/);
  assert.match(source,/sphereGeometry args=\{\[26,64,32,0,Math\.PI\*2,0,Math\.PI\/2\]\}/);
  assert.ok(15.12>15.03);
  assert.ok(15.12+3<18.35);
});
test('both environment paths share a neutral reflecting studio surround and supported PCF shadows',()=>{
  assert.equal(instrumentRenderer.shadowType,PCFShadowMap);
  assert.equal(instrumentStudioSurround,'#b8b9b2');
  const kit=readFileSync(new URL('../components/InstrumentKit.tsx',import.meta.url),'utf8');
  const shared=readFileSync(new URL('./instrument-kit.ts',import.meta.url),'utf8');
  assert.match(kit,/<color attach="background" args=\{\[instrumentStudioSurround\]\}/);
  assert.match(kit,/gl\.setClearAlpha\(0\);gl\.clear\(true,true,true\)/);
  assert.match(shared,/room\.background=new Color\(instrumentStudioSurround\)/);
  assert.doesNotMatch(kit,/shadows="soft"/);
});
test('all ten drum UV centers face the viewer, with upright glyphs after the horizontal-axis rotation',()=>{
  const axisY=new Vector3(0,1,0),axisZ=new Vector3(0,0,1);
  for(let digit=0;digit<10;digit++){
    const theta=2*Math.PI*(digit+.5)/10,rotation=counterDrumRotation(digit);
    const normal=new Vector3(Math.sin(theta),0,Math.cos(theta)).applyAxisAngle(axisY,rotation).applyAxisAngle(axisZ,Math.PI/2);
    assert.ok(normal.z>.999999);
    // Canvas +90° maps glyph-right down the atlas; flipY maps that to
    // negative cylinder Y, then the horizontal barrel rotation maps it right.
    const glyphRight=new Vector3(0,-Math.sin(counterDrum.textRotation),0).applyAxisAngle(axisZ,Math.PI/2);
    const glyphUp=new Vector3(Math.cos(theta),0,-Math.sin(theta)).multiplyScalar(Math.sin(counterDrum.textRotation)).applyAxisAngle(axisY,rotation).applyAxisAngle(axisZ,Math.PI/2);
    assert.ok(glyphRight.x>.999999);assert.ok(glyphUp.y>.999999);
  }
  assert.ok(Math.abs(counterDrum.atlasWidth/(Math.PI*2*counterDrum.radius)-counterDrum.atlasHeight/counterDrum.width)<.05);
});
test('the extruded counter bezel has two real openings and physically masks neighboring digit rows',()=>{
  const geometry=createCounterApertureGeometry(),material=new MeshPhysicalMaterial(),mesh=new Mesh(geometry,material);
  mesh.updateMatrixWorld();
  const hits=(x:number,y:number)=>new Raycaster(new Vector3(x,y,100),new Vector3(0,0,-1)).intersectObject(mesh).length;
  for(const x of counterDrum.localCenters){
    assert.equal(hits(x,counterDrum.centerY),0);
    assert.ok(hits(x,counterDrum.centerY+12)>0);
    assert.ok(hits(x,counterDrum.centerY-12)>0);
  }
  assert.ok(hits(0,counterDrum.centerY)>0);
  assert.equal(geometry.parameters.shapes.holes.length,2);
  geometry.dispose();material.dispose();
});
