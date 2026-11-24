import {useEffect} from 'react';
import L from 'leaflet';
import {useMap} from 'react-leaflet';
import {heatOptions,normalizeHeatPoints} from '@/lib/heat-points';
import {unwrapGeographicPoints,type ConfidenceField} from '@/lib/geographic-confidence';

type HeatLeaflet=typeof L&{heatLayer:(points:number[][],options:typeof heatOptions)=>L.Layer};
let plugin:Promise<HeatLeaflet>|undefined;
function loadHeat(){
  if(!plugin)plugin=new Promise<HeatLeaflet>((resolve,reject)=>{
    // The pinned CDN plugin augments the same Leaflet instance React Leaflet uses.
    (window as unknown as {L:typeof L}).L=L;
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js';
    script.onload=()=>typeof (L as HeatLeaflet).heatLayer==='function'?resolve(L as HeatLeaflet):reject(new Error('Heat renderer unavailable'));
    script.onerror=()=>{script.remove();plugin=undefined;reject(new Error('Heat renderer could not load'));};
    document.head.appendChild(script);
  });
  return plugin;
}
export function ConfidenceHeatLayer({fields,onError}:{fields:ConfidenceField[];onError:(failed:boolean)=>void}){
  const map=useMap();
  useEffect(()=>{
    let disposed=false,layer:L.Layer|undefined;
    onError(false);
    loadHeat().then(leaflet=>{
      if(disposed)return;
      const points=normalizeHeatPoints(fields.map(field=>({lat:field.position[0],lng:field.position[1],confidence:field.score})));
      const positions=unwrapGeographicPoints(points.map(point=>[point.lat,point.lng]));
      layer=leaflet.heatLayer(positions.map((position,index)=>[...position,points[index].confidence**1.5]),heatOptions).addTo(map);
    }).catch(()=>{if(!disposed)onError(true);});
    return()=>{disposed=true;if(layer)map.removeLayer(layer);};
  },[map,fields,onError]);
  return null;
}
