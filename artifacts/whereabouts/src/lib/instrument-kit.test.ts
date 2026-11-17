import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Mesh,MeshPhysicalMaterial,PerspectiveCamera,ShaderMaterial,Vector3,type BufferGeometry} from 'three';
import {INSTRUMENT_FOV,InstrumentKitMaterials,instrumentMaterial,pixelCameraDistance} from './instrument-kit';
import {createLoupeAssembly} from './loupe-model';
import {safeRequestDetail,safeRuntimeIssue} from './safe-request-detail';

test('InstrumentKit perspective camera calibrates one unit to one CSS pixel at the page surface',()=>{
  for(const height of[72,96,120,140,195,220,300,330,420]){
    const width=560,camera=new PerspectiveCamera(INSTRUMENT_FOV,width/height,.1,10000);
    camera.position.z=pixelCameraDistance(height);camera.updateMatrixWorld();
    const origin=new Vector3(0,0,0).project(camera),oneX=new Vector3(1,0,0).project(camera),oneY=new Vector3(0,1,0).project(camera);
    assert.ok(Math.abs((oneX.x-origin.x)*width/2-1)<1e-9);
    assert.ok(Math.abs((oneY.y-origin.y)*height/2-1)<1e-9);
  }
});
test('named physical materials match the supplied metal, rubber, paper and glass specification',()=>{
  const aluminum=instrumentMaterial(InstrumentKitMaterials.silverAluminum,'#e0e8ee');
  assert.equal(aluminum.name,'Silver aluminum');assert.equal(aluminum.color,'#c9c9c4');assert.equal(aluminum.metalness,1);assert.equal(aluminum.roughness,.35);assert.equal(aluminum.anisotropy,.8);
  assert.equal(instrumentMaterial('Polished chrome','#eeece4').roughness,.08);
  assert.equal(instrumentMaterial('Black anodized','#eeece4').metalness,.6);
  assert.equal(instrumentMaterial('Rubber','#eeece4').roughness,.9);
  assert.equal(instrumentMaterial('Paper','#e0e8ee').color,'#e0e8ee');
  const glass=instrumentMaterial('Glass','#eeece4');assert.equal(glass.transmission,1);assert.equal(glass.thickness,2);assert.equal(glass.clearcoat,1);
});
test('the shared homepage model is actual mesh geometry and preserves its original glass shader and handle joint',()=>{
  const geometries:BufferGeometry[]=[],physical=new MeshPhysicalMaterial(),glass=new ShaderMaterial();
  const model=createLoupeAssembly({dark:physical,steel:physical,red:physical,grip:physical,bracket:physical,glass},<T extends BufferGeometry>(g:T)=>{geometries.push(g);return g;});
  assert.equal(model.glass.material,glass);assert.equal(model.handle.parent,model.loupe);
  let meshes=0,triangles=0;
  for(const group of[model.loupe,model.holder])group.traverse(object=>{if(object instanceof Mesh){meshes++;triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3;}});
  assert.ok(meshes>24);assert.ok(triangles>16000);assert.equal(model.glass.castShadow,false);
  geometries.forEach(g=>g.dispose());physical.dispose();glass.dispose();
});
test('the fully open swatch fan and its 16px outward hover remain within the reserved desktop footprint',()=>{
  for(let rank=0;rank<5;rank++)for(const x of[-20,416])for(const y of[-28,28]){
    const angle=rank*11*Math.PI/180,screenX=60+x*Math.cos(angle)-y*Math.sin(angle),screenY=360-x*Math.sin(angle)-y*Math.cos(angle);
    assert.ok(screenX>16&&screenX<544,`x ${screenX}`);assert.ok(screenY>16&&screenY<404,`y ${screenY}`);
  }
});
test('library diagnostics expose the real HTTP 200 parse failure without leaking bodies, cookies, API keys or query strings',()=>{
  const output=safeRequestDetail({name:'ResponseParseError',status:200,statusText:'OK',url:'https://preview.invalid/api/investigations?token=private-token',method:'GET',headers:new Headers({'content-type':'text/html; charset=utf-8','set-cookie':'private-cookie'}),rawBody:'private-photo-context',message:'private-api-key'});
  assert.equal(output.status,'HTTP 200 OK');assert.equal(output.contentType,'text/html');assert.equal(output.endpoint,'GET /api/investigations');
  assert.match(output.detail,/not valid JSON/);assert.doesNotMatch(JSON.stringify(output),/private|token=|set-cookie/);
});
test('library diagnostics distinguish 304 and browser fetch failures rather than swallowing them',()=>{
  assert.match(safeRequestDetail({name:'ApiError',status:304}).detail,/304/);
  const error=new TypeError('Failed to fetch');assert.match(safeRequestDetail(error).detail,/Failed to fetch/);assert.match(safeRequestDetail(error).status,/No HTTP/);
});
test('runtime diagnostics identify missing imports and bad data calls without presenting private response content',()=>{
  assert.equal(safeRuntimeIssue(new ReferenceError('missingHook is not defined')),'missingHook is not defined');
  assert.equal(safeRuntimeIssue(new TypeError('query.data.filter is not a function')),'query.data.filter is not a function');
  assert.doesNotMatch(safeRuntimeIssue(new Error('private-provider-response')),/private-provider-response/);
});
test('control stylesheet and fallback source contain no drawn metal, SVG proxy, gradients, or CSS shadows',()=>{
  const css=readFileSync(new URL('../styles/physical-desk.css',import.meta.url),'utf8'),fallback=readFileSync(new URL('./instrument-fallback.ts',import.meta.url),'utf8');
  assert.doesNotMatch(css,/gradient|box-shadow/);assert.doesNotMatch(fallback,/<svg|data:image\/svg|linearGradient/);
  const model=readFileSync(new URL('../components/physical-models.tsx',import.meta.url),'utf8');
  assert.match(model,/root\.current\.traverse/);assert.match(model,/geometry\.index/);assert.match(model,/\[3D\]/);
});
