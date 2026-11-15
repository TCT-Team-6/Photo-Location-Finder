import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,PerspectiveCamera,ShaderMaterial,Texture,Vector3,WebGLRenderTarget,type Material} from 'three';
import {configureOverlayCamera,maskLoupeForShadowPass} from './loupe-layer';
test('fixed-canvas projection remains attached to stage across scroll and horizontal offsets',()=>{
  const size={width:1440,height:900},viewport={width:1440,height:900};
  const camera=new PerspectiveCamera(35,size.width/size.height,.1,12000);camera.position.z=size.height/(2*Math.tan(35*Math.PI/360));camera.updateMatrixWorld();
  for(const origin of[{x:0,y:720},{x:17,y:-100},{x:-12,y:40}]){
    configureOverlayCamera(camera,size,origin,viewport);
    const pixel=new Vector3(410-size.width/2,size.height/2-230,0).project(camera);
    assert.ok(Math.abs((pixel.x*.5+.5)*viewport.width-(origin.x+410))<1e-8);
    assert.ok(Math.abs((.5-pixel.y*.5)*viewport.height-(origin.y+230))<1e-8);
    camera.clearViewOffset();
  }
});
test('shadow-only copy hides tool colors without hiding shared holder bolts and reuses materials',()=>{
  const steel=new MeshBasicMaterial(),geometry=new BoxGeometry(),tool=new Group(),ring=new Mesh(geometry,steel),bolt=new Mesh(geometry,steel),cache=new Map<Material,Material>();
  tool.add(ring);const restore=maskLoupeForShadowPass(tool,cache);
  assert.equal((ring.material as Material).colorWrite,false);assert.equal(bolt.material.colorWrite,true);assert.equal(steel.colorWrite,true);assert.notEqual(ring.material,steel);
  restore();assert.equal(ring.material,steel);
  const second=maskLoupeForShadowPass(tool,cache);assert.equal(cache.size,1);second();cache.forEach(material=>material.dispose());geometry.dispose();steel.dispose();
});
test('shadow mask never clones or allocates glass render-texture uniforms',()=>{
  const target=new WebGLRenderTarget(8,8),wall=new Texture(),geometry=new BoxGeometry(),shader=new ShaderMaterial({uniforms:{scene:{value:target.texture},wall:{value:wall}}}),group=new Group(),mesh=new Mesh(geometry,shader),cache=new Map<Material,Material>();
  let clones=0;wall.clone=()=>{clones++;return new Texture();};group.add(mesh);
  const restore=maskLoupeForShadowPass(group,cache);assert.equal(clones,0);assert.ok(mesh.material instanceof MeshBasicMaterial);assert.equal(shader.uniforms.scene.value,target.texture);
  restore();assert.equal(mesh.material,shader);cache.forEach(material=>material.dispose());shader.dispose();target.dispose();wall.dispose();geometry.dispose();
});
