const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** Channel-linear display emitters; optics add their own reflection/vignette afterward. */
export function rgbEmitter(values:readonly number[],x:number,y:number){
  const stripe=Math.floor(x*3),strip=x*3-stripe;
  const body=(1-smooth(.34,.48,Math.abs(strip-.5)))*(1-smooth(.42,.5,Math.abs(y-.5)));
  const glow=Math.exp(-Math.pow((strip-.5)*2,2)*2.5)*.16;
  return values.map((value,channel)=>value*(.015+(stripe===channel?body+glow:0)));
}
export const RGB_SCREEN_GLSL=`
vec3 rgbEmitter(vec3 values,vec2 cell){
 float stripe=floor(cell.x*3.),strip=fract(cell.x*3.);
 vec3 channel=stripe<1.?vec3(1.,0.,0.):stripe<2.?vec3(0.,1.,0.):vec3(0.,0.,1.);
 float body=(1.-smoothstep(.34,.48,abs(strip-.5)))*(1.-smoothstep(.42,.5,abs(cell.y-.5)));
 float d=(strip-.5)*2.,glow=exp(-d*d*2.5)*.16;
 return values*.015+values*channel*(body+glow);
}`;
