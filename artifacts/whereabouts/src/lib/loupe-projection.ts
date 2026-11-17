/** Stage coordinates from world geometry, independent of the active render viewport. */
export function projectStagePoint(point:{x:number;y:number;z:number},stage:{width:number;height:number},cameraZ:number){
  const perspective=cameraZ/(cameraZ-point.z);
  return{x:stage.width/2+point.x*perspective,y:stage.height/2-point.y*perspective};
}
export function lensSurface(point:{x:number;y:number},stage:{width:number;height:number},photo:{width:number;height:number}){
  if(point.x<0||point.y<0||point.x>stage.width||point.y>stage.height)return 'page';
  return point.x<=photo.width&&point.y<=photo.height?'data':'scene';
}
export const STAGE_PROJECTION_GLSL=`
vec2 projectStagePoint(vec3 world){
 float perspective=uCameraZ/(uCameraZ-world.z);
 return vec2(uStage.x*.5+world.x*perspective,uStage.y*.5-world.y*perspective);
}`;
