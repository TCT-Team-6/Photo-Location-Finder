import { Mesh, MeshBasicMaterial, type Group, type Material, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import type { LoupePoint } from './loupe-dwell';

export function configureOverlayCamera(camera:PerspectiveCamera,size:{width:number;height:number},origin:LoupePoint,viewport:{width:number;height:number}){
  camera.setViewOffset(size.width,size.height,-origin.x,-origin.y,viewport.width,viewport.height);
}
export function maskLoupeForShadowPass(loupe:Group,cache:Map<Material,Material>){
  const originals=new Map<Mesh,Material|Material[]>();
  // A plain depth-writing mask avoids ShaderMaterial.clone(): that would clone
  // canvas uniforms and try to clone the scene render texture unnecessarily.
  const shadowOnly=(material:Material)=>{let mask=cache.get(material);if(!mask){mask=new MeshBasicMaterial({colorWrite:false,depthWrite:material.depthWrite,depthTest:material.depthTest,side:material.side,transparent:material.transparent,opacity:material.opacity});cache.set(material,mask);}return mask;};
  loupe.traverse(object=>{if(object instanceof Mesh){originals.set(object,object.material);object.material=Array.isArray(object.material)?object.material.map(shadowOnly):shadowOnly(object.material);}});
  return ()=>originals.forEach((material,object)=>{object.material=material;});
}

/** One GPU context. Copy the desk into its attached 2D canvas; draw only the tool
 * into a fixed transparent canvas. No DOM screenshot, cross-context RT or bitmap loupe. */
export function createLoupeLayer(stage:HTMLCanvasElement){
  const context=stage.getContext('2d');if(!context)throw new Error('Photo layer could not initialize. Reload to switch rendering layers.');
  const canvas=document.createElement('canvas');canvas.className='wa-loupe-overlay';canvas.setAttribute('aria-hidden','true');canvas.dataset.testid='canvas-loupe-overlay';document.body.appendChild(canvas);
  const shadowOnlyMaterials=new Map<Material,Material>();
  const lost=(event:Event)=>{event.preventDefault();canvas.style.visibility='hidden';stage.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));};
  const restored=()=>stage.dispatchEvent(new Event('webglcontextrestored'));
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
  return {canvas,
    render(renderer:WebGLRenderer,scene:Scene,camera:PerspectiveCamera,loupe:Group,width:number,height:number){
      const viewportWidth=window.innerWidth,viewportHeight=window.innerHeight,rect=stage.getBoundingClientRect();
      camera.clearViewOffset();renderer.setViewport(0,0,width,height);
      // Real meshes still cast their physical shadow on the attached photo/panel.
      // Do not mutate shared steel/red materials: the real holder bolts use them too.
      const restore=maskLoupeForShadowPass(loupe,shadowOnlyMaterials);
      try{renderer.render(scene,camera);context.clearRect(0,0,stage.width,stage.height);context.drawImage(canvas,0,Math.max(0,canvas.height-stage.height),Math.min(canvas.width,stage.width),Math.min(canvas.height,stage.height),0,0,stage.width,stage.height);}
      finally{restore();}
      const hidden=scene.children.filter(object=>object!==loupe&&!(object as unknown as {isLight?:boolean}).isLight);
      const visibility=hidden.map(object=>object.visible);hidden.forEach(object=>{object.visible=false;});
      configureOverlayCamera(camera,{width,height},{x:rect.left,y:rect.top},{width:viewportWidth,height:viewportHeight});
      renderer.setViewport(0,0,viewportWidth,viewportHeight);renderer.shadowMap.needsUpdate=false;
      try{renderer.clear();renderer.render(scene,camera);}
      finally{hidden.forEach((object,i)=>{object.visible=visibility[i];});camera.clearViewOffset();}
    },
    dispose(){shadowOnlyMaterials.forEach(material=>material.dispose());shadowOnlyMaterials.clear();canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);canvas.remove();},
  };
}
