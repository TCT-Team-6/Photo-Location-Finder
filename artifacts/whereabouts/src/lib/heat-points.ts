export function normalizeHeatPoints(points:{lat:number;lng:number;confidence:number}[]){
  const percent=points.some(point=>point.confidence>1);
  return points.filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180&&Number.isFinite(point.confidence))
    .map(point=>({...point,confidence:Math.max(0,Math.min(1,point.confidence/(percent?100:1)))}));
}
export const heatOptions={
  radius:6,blur:4.8,minOpacity:0.4,maxZoom:1,max:1.0,
  gradient:{0:'#0B1D51',0.2:'#1E3A8A',0.4:'#06B6D4',0.6:'#84CC16',0.8:'#FACC15',0.92:'#F97316',1:'#DC2626'},
};
/** Visual footprint only; not a measured search radius. */
export function heatRadiusPixels(latitude:number,zoom:number,meters=400){
  const metersPerPixel=156543.03392*Math.cos(latitude*Math.PI/180)/2**zoom;
  return Math.max(6,Math.min(120,meters/metersPerPixel));
}
