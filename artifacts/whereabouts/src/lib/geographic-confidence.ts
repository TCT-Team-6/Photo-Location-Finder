export type GeographicPoint=[number,number];
export const EARTH_RADIUS_KM=6371.0088;
export const MERCATOR_LATITUDE_LIMIT=85.05112878;
/** A visualization choice, NOT an estimated search radius or uncertainty bound. */
export const FIELD_SUPPORT_KM=180;
const radians=(degrees:number)=>degrees*Math.PI/180;
export function coordinatesFromMapsUrl(value:string):GeographicPoint|null{
  try{
    const url=new URL(value);
    if(!['https:','http:'].includes(url.protocol))return null;
    const query=url.searchParams.get('query')??url.searchParams.get('q')??'';
    const match=query.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/);
    if(!match)return null;
    const latitude=Number(match[1]),longitude=Number(match[2]);
    return validCoordinates(latitude,longitude)?[latitude,longitude]:null;
  }catch{return null;}
}
export function validCoordinates(latitude:number,longitude:number){
  return Number.isFinite(latitude)&&Number.isFinite(longitude)&&Math.abs(latitude)<=90&&Math.abs(longitude)<=180;
}
export function modelScoreUnit(value:number):number|null{
  if(!Number.isFinite(value)||value<0||value>100)return null;
  return value>1?value/100:value;
}
export function rankCandidates<T extends {confidence:number}>(candidates:T[]):T[]{
  return candidates.map((candidate,index)=>({candidate,index,score:modelScoreUnit(candidate.confidence)??-1}))
    .sort((a,b)=>b.score-a.score||a.index-b.index).map(({candidate})=>candidate);
}
export function greatCircleKm(a:GeographicPoint,b:GeographicPoint){
  const dLat=radians(b[0]-a[0]),dLon=radians(b[1]-a[1]);
  const h=Math.sin(dLat/2)**2+Math.cos(radians(a[0]))*Math.cos(radians(b[0]))*Math.sin(dLon/2)**2;
  return 2*EARTH_RADIUS_KM*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
/** Compact C-infinity falloff: no tails joining distant fields, no additive bridge. */
export function localFieldKernel(distanceKm:number,supportKm=FIELD_SUPPORT_KM){
  if(!Number.isFinite(distanceKm)||distanceKm<0||!Number.isFinite(supportKm)||supportKm<=0||distanceKm>=supportKm)return 0;
  const t=distanceKm/supportKm;
  return Math.exp(-4*t*t/(1-t*t));
}
export type ConfidenceField={position:GeographicPoint;score:number;index:number};
export function geographicFieldValue(point:GeographicPoint,fields:ConfidenceField[]){
  if(!Number.isFinite(point[0])||!Number.isFinite(point[1])||Math.abs(point[0])>90)return 0;
  let value=0;
  for(const field of fields){
    if(!validCoordinates(...field.position)||!Number.isFinite(field.score)||field.score<0||field.score>1)continue;
    const displaySupport=FIELD_SUPPORT_KM*(.5+.5*field.score);
    value=Math.max(value,field.score*localFieldKernel(greatCircleKm(point,field.position),displaySupport));
  }
  return value;
}
export function mapTopCandidates<T extends {mapsUrl:string;confidence:number}>(ranked:T[]){
  return ranked.slice(0,3).map((lead,index)=>{
    const coordinates=coordinatesFromMapsUrl(lead.mapsUrl),score=modelScoreUnit(lead.confidence);
    const reason=!coordinates?'missing_coordinates':Math.abs(coordinates[0])>MERCATOR_LATITUDE_LIMIT?'projection_limit':score===null?'missing_score':null;
    return{lead,index,position:coordinates,score,reason};
  });
}
/** Fit the smallest longitude arc, rather than the almost-whole-world seam. */
export function unwrapGeographicPoints(points:GeographicPoint[]):GeographicPoint[]{
  if(points.length<2)return points.map(point=>[...point]);
  const ordered=points.map(point=>((point[1]%360)+360)%360).sort((a,b)=>a-b);
  let largest=-1,start=ordered[0];
  for(let i=0;i<ordered.length;i++){
    const next=i===ordered.length-1?ordered[0]+360:ordered[i+1],gap=next-ordered[i];
    if(gap>largest){largest=gap;start=next%360;}
  }
  const unwrapped=points.map(([lat,lon]):GeographicPoint=>{let lng=((lon%360)+360)%360;if(lng<start)lng+=360;return[lat,lng];});
  const mean=unwrapped.reduce((sum,p)=>sum+p[1],0)/unwrapped.length,shift=360*Math.floor((mean+180)/360);
  return unwrapped.map(([lat,lng])=>[lat,lng-shift]);
}
export function fieldBounds(points:GeographicPoint[]):GeographicPoint[]{
  return unwrapGeographicPoints(points).flatMap(([lat,lng])=>{
    const degrees=FIELD_SUPPORT_KM/EARTH_RADIUS_KM*180/Math.PI;
    const longitudeSpan=Math.asin(Math.min(1,Math.sin(radians(degrees))/Math.cos(radians(lat))))*180/Math.PI;
    return[[Math.max(-MERCATOR_LATITUDE_LIMIT,lat-degrees),lng-longitudeSpan],[Math.min(MERCATOR_LATITUDE_LIMIT,lat+degrees),lng+longitudeSpan]] as GeographicPoint[];
  });
}
