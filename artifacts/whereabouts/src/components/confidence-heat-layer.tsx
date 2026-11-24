import {useEffect} from 'react';
import L from 'leaflet';
import {useMap} from 'react-leaflet';
import {heatOptions,heatRadiusPixels,normalizeHeatPoints} from '@/lib/heat-points';
import {unwrapGeographicPoints,type ConfidenceField} from '@/lib/geographic-confidence';

type HeatLayer=L.Layer&{
  setOptions:(options:{radius:number;blur:number})=>HeatLayer;
  redraw:()=>HeatLayer;
};
type HeatLeaflet=typeof L&{heatLayer:(points:number[][],options:typeof heatOptions)=>HeatLayer};
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
export function ConfidenceHeatLayer({fields,onError,footprintMeters=400}:{fields:ConfidenceField[];onError:(failed:boolean)=>void;footprintMeters?:number}){
  const map=useMap();
  useEffect(()=>{
    let disposed=false,layer:HeatLayer|undefined;
    const updateRadius=()=>{
      if(!layer)return;
      const radius=heatRadiusPixels(map.getCenter().lat,map.getZoom(),footprintMeters);
      layer.setOptions({radius,blur:radius*0.8}).redraw();
    };
    onError(false);
    loadHeat().then(leaflet=>{
      if(disposed)return;
      const points=normalizeHeatPoints(fields.map(field=>({lat:field.position[0],lng:field.position[1],confidence:field.score})));
      const positions=unwrapGeographicPoints(points.map(point=>[point.lat,point.lng]));
      layer=leaflet.heatLayer(positions.map((position,index)=>[...position,points[index].confidence**1.5]),heatOptions).addTo(map);
      updateRadius();
      map.on('zoomend moveend',updateRadius);
    }).catch(()=>{if(!disposed)onError(true);});
    return()=>{disposed=true;map.off('zoomend moveend',updateRadius);if(layer)map.removeLayer(layer);};
  },[map,fields,onError,footprintMeters]);
  return null;
}
