import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanvasTexture,Texture,RGBAFormat,UnsignedByteType,Group,Mesh,PlaneGeometry,ShaderMaterial,type Material} from 'three';
import {WebGLTextures} from 'three/src/renderers/webgl/WebGLTextures.js';
import {createLiveCanvasTexture} from './live-canvas-texture';
import {maskLoupeForShadowPass} from './loupe-layer';

/** Executes Three's REAL uploader against an immutable-storage GL recorder,
 * including source.version caching, texStorage2D and texSubImage2D. */
function uploadHarness(){
  type Allocation={width:number;height:number;pixels:Uint8Array};
  let next=0,bound:object;
  const allocations=new Map<object,Allocation>(),constants=new Map<string,number>();
  const gl=new Proxy({}, {get:(_,key:string)=>{
    if(key==='createTexture')return()=>({id:++next});
    if(key==='deleteTexture')return(texture:object)=>allocations.delete(texture);
    if(key==='texParameteri'||key==='texParameterf'||key==='pixelStorei')return()=>{};
    if(!constants.has(key))constants.set(key,constants.size+1);return constants.get(key);
  }}) as WebGLRenderingContext;
  const propertiesMap=new WeakMap<object,Record<string,unknown>>();
  const properties={get(object:object){if(!propertiesMap.has(object))propertiesMap.set(object,{});return propertiesMap.get(object)!;},remove(object:object){propertiesMap.delete(object);}};
  const state={
    bindTexture(_target:number,texture:object){bound=texture;},activeTexture(){},pixelStorei(){},
    texStorage2D(_target:number,_levels:number,_format:number,width:number,height:number){assert.ok(!allocations.has(bound),'texStorage2D cannot resize immutable storage');allocations.set(bound,{width,height,pixels:new Uint8Array()});},
    texSubImage2D(...args:unknown[]){
      const image=args.at(-1) as {width:number;height:number;pixels:Uint8Array},allocation=allocations.get(bound)!;
      assert.ok(image.width<=allocation.width&&image.height<=allocation.height,'INVALID_VALUE: texSubImage2D exceeds immutable allocation');
      allocation.pixels=image.pixels.slice();
    },
  };
  const args=[gl,{has:()=>false},state,properties,{maxTextureSize:16384},{convert:(value:number)=>value===RGBAFormat?gl.RGBA:value===UnsignedByteType?gl.UNSIGNED_BYTE:value},{memory:{textures:0},render:{frame:0}}] as unknown as ConstructorParameters<typeof WebGLTextures>;
  const uploader=new WebGLTextures(...args);
  return{upload:(texture:Texture)=>uploader.setTexture2D(texture,0),allocations};
}
const image=(width:number,height:number,ink=23)=>({width,height,pixels:new Uint8Array(width*height*4).map((_,i)=>i%4===3?255:i<12?ink:244)}) as unknown as HTMLCanvasElement;
test('reproduces Three immutable canvas resize failure, then replaces and uploads the real resource safely',()=>{
  const oldGPU=uploadHarness(),canvas=image(1,1),old=new CanvasTexture(canvas);old.generateMipmaps=false;
  oldGPU.upload(old);Object.assign(canvas,image(8,8));old.needsUpdate=true;
  assert.throws(()=>oldGPU.upload(old),/exceeds immutable/);old.dispose();
  const gpu=uploadHarness(),uniform={value:new Texture()},binding=createLiveCanvasTexture(uniform,gpu.upload);
  const first=binding.update(canvas);assert.equal(gpu.allocations.size,1);
  assert.ok([...gpu.allocations.values()][0].pixels.includes(23));
  Object.assign(canvas,image(16,12,44));
  const second=binding.update(canvas);assert.notEqual(second,first);assert.equal(uniform.value,second);
  assert.equal(gpu.allocations.size,1);assert.equal([...gpu.allocations.values()][0].width,16);
  assert.equal([...gpu.allocations.values()][0].pixels[0],44);
  Object.assign(canvas,image(16,12,81));
  assert.equal(binding.update(canvas),second);assert.equal([...gpu.allocations.values()][0].pixels[0],81);
  binding.dispose();assert.equal(gpu.allocations.size,0);
});
test('page and data uniforms upload distinct payloads and remain live through the actual shadow-mask restoration',()=>{
  const gpu=uploadHarness(),page={value:new Texture()},wall={value:new Texture()},pageBinding=createLiveCanvasTexture(page,gpu.upload),wallBinding=createLiveCanvasTexture(wall,gpu.upload);
  const material=new ShaderMaterial({uniforms:{uPage:page,uWall:wall}}),geometry=new PlaneGeometry(),tool=new Group(),mesh=new Mesh(geometry,material),cache=new Map<Material,Material>();
  tool.add(mesh);const restore=maskLoupeForShadowPass(tool,cache);
  let clones=0;material.clone=()=>{clones++;throw new Error('must not clone glass uniforms');};
  pageBinding.update(image(4,4,17));wallBinding.update(image(8,8,57));
  restore();assert.equal(clones,0);assert.equal(mesh.material,material);
  assert.equal(material.uniforms.uPage,page);assert.equal(material.uniforms.uWall,wall);
  assert.notEqual(page.value,wall.value);
  assert.deepEqual([...gpu.allocations.values()].map(value=>value.pixels[0]).sort((a,b)=>a-b),[17,57]);
  pageBinding.update(image(6,6,92));assert.equal(material.uniforms.uPage.value,page.value);
  assert.equal(gpu.allocations.size,2);assert.ok([...gpu.allocations.values()].some(value=>value.width===6&&value.pixels[0]===92));
  pageBinding.dispose();wallBinding.dispose();cache.forEach(value=>value.dispose());material.dispose();geometry.dispose();assert.equal(gpu.allocations.size,0);
});
