import {CanvasTexture,NearestFilter,SRGBColorSpace,type Texture,type MagnificationTextureFilter} from 'three';

/** WebGL2 texStorage2D is immutable. Canvas dimensions must be compared with
 * cached ALLOCATION dimensions, not texture.image (the same mutable canvas).
 * Commit the uniform only after the real uploader has initialized the resource. */
export function createLiveCanvasTexture(uniform:{value:Texture},upload:(texture:Texture)=>void,filter:MagnificationTextureFilter=NearestFilter){
  let current:CanvasTexture|null=null,source:HTMLCanvasElement|null=null,width=0,height=0;
  return{
    update(canvas:HTMLCanvasElement){
      if(canvas.width<1||canvas.height<1)throw new Error('Cannot upload an empty lens texture.');
      if(!current||source!==canvas||width!==canvas.width||height!==canvas.height){
        const next=new CanvasTexture(canvas);
        next.colorSpace=SRGBColorSpace;next.minFilter=next.magFilter=filter;next.generateMipmaps=false;
        try{upload(next);}catch(error){next.dispose();throw error;}
        const previous=current;
        current=next;source=canvas;width=canvas.width;height=canvas.height;
        uniform.value=next;previous?.dispose();
      }else{current.needsUpdate=true;upload(current);}
      return current;
    },
    dispose(){current?.dispose();current=null;source=null;width=height=0;},
  };
}
