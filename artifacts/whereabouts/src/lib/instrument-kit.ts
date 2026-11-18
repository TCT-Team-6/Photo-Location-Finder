import {ACESFilmicToneMapping,SRGBColorSpace,PCFShadowMap,Color,DoubleSide,Mesh,MeshBasicMaterial,PlaneGeometry,PMREMGenerator,Scene,type WebGLRenderer,type MeshPhysicalMaterialParameters} from 'three';

export const instrumentRenderer={toneMapping:ACESFilmicToneMapping,outputColorSpace:SRGBColorSpace,shadowType:PCFShadowMap};
/** A lit neutral studio surround, not a black void. Flat chrome faces reflect
 * the surround when their normal does not point at either off-axis softbox. */
export const instrumentStudioSurround='#b8b9b2';
export const INSTRUMENT_FOV=18;
/** At z=0 the vertical view frustum is exactly the CSS pixel height. */
export function pixelCameraDistance(cssHeight:number){return cssHeight/(2*Math.tan(INSTRUMENT_FOV*Math.PI/360));}
export type MaterialName='Silver aluminum'|'Polished chrome'|'Black anodized'|'Rubber'|'Paper'|'Glass';
export const InstrumentKitMaterials={silverAluminum:'Silver aluminum',polishedChrome:'Polished chrome',blackAnodized:'Black anodized',rubber:'Rubber',paper:'Paper',glass:'Glass'} as const;
export function instrumentMaterial(name:MaterialName,paper:string):MeshPhysicalMaterialParameters{
  switch(name){
    case 'Silver aluminum':return{name,color:'#c9c9c4',metalness:1,roughness:.35,anisotropy:.8};
    case 'Polished chrome':return{name,color:'#e2e2de',metalness:1,roughness:.08};
    case 'Black anodized':return{name,color:'#1c1c1c',metalness:.6,roughness:.45};
    case 'Rubber':return{name,color:'#222222',metalness:0,roughness:.9};
    case 'Paper':return{name,color:paper,metalness:0,roughness:.85};
    case 'Glass':return{name,color:'#f6f5ee',metalness:0,transmission:1,roughness:.05,thickness:2,clearcoat:1,ior:1.5,transparent:true,depthWrite:false};
  }
}
/** Shared softboxes; the homepage's geometry is shared separately without changing its optical shader. */
export const instrumentSoftboxes=[
  {position:[-360,420,500] as [number,number,number],scale:[520,280,1] as [number,number,number],intensity:3},
  {position:[420,0,360] as [number,number,number],scale:[48,520,1] as [number,number,number],intensity:1.7},
];
/** The raw-three homepage and the R3F kit bake the very same pair of softboxes.
 * No optical uniforms, data sampling, or homepage capture passes are altered.
 */
export function createInstrumentEnvironment(renderer:WebGLRenderer){
  const room=new Scene(),resources:{geometry:PlaneGeometry;material:MeshBasicMaterial}[]=[];
  room.background=new Color(instrumentStudioSurround);
  for(const box of instrumentSoftboxes){
    const geometry=new PlaneGeometry(box.scale[0],box.scale[1]),material=new MeshBasicMaterial({color:new Color('#faf9f4').multiplyScalar(box.intensity),side:DoubleSide,toneMapped:false});
    const softbox=new Mesh(geometry,material);softbox.position.set(...box.position);room.add(softbox);resources.push({geometry,material});
  }
  const generator=new PMREMGenerator(renderer),target=generator.fromScene(room,.04,1,2000);
  resources.forEach(({geometry,material})=>{geometry.dispose();material.dispose();});generator.dispose();
  return{texture:target.texture,dispose:()=>target.dispose()};
}
