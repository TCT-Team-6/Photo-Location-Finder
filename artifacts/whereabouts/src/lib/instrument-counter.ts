import {ExtrudeGeometry,Path,Shape} from 'three';

/** Keep the existing barrel radius, center depth, and horizontal arrangement.
 * A narrow real metal aperture hides adjacent numerals on each curved barrel. */
export const counterDrum={
  radius:26,width:48,centerY:-3,centerZ:-9,
  atlasWidth:320,atlasHeight:96,fontSize:40,
  textRotation:Math.PI/2,
  apertureWidth:44,apertureHeight:16,
  localCenters:[-29,23] as const,
};
export function counterDrumRotation(digit:number){return-Math.PI*2*(digit+.5)/10;}
export function createCounterApertureGeometry(){
  const shape=new Shape();
  shape.moveTo(-62,-29);shape.lineTo(62,-29);shape.lineTo(62,29);shape.lineTo(-62,29);shape.closePath();
  for(const center of counterDrum.localCenters){
    const left=center-counterDrum.apertureWidth/2,right=center+counterDrum.apertureWidth/2;
    const bottom=counterDrum.centerY-counterDrum.apertureHeight/2,top=counterDrum.centerY+counterDrum.apertureHeight/2;
    const hole=new Path();hole.moveTo(left,bottom);hole.lineTo(left,top);hole.lineTo(right,top);hole.lineTo(right,bottom);hole.closePath();shape.holes.push(hole);
  }
  return new ExtrudeGeometry(shape,{depth:.6,bevelEnabled:true,bevelSize:.1,bevelThickness:.1,bevelSegments:2});
}
