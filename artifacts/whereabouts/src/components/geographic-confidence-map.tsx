import {useEffect,useMemo,useRef,useState} from 'react';
import {DomUtil} from 'leaflet';
import {MapContainer,TileLayer,useMap} from 'react-leaflet';
import type {Investigation} from '@workspace/api-client-react';
import {fieldBounds,geographicFieldValue,mapTopCandidates,unwrapGeographicPoints,type ConfidenceField,type GeographicPoint} from '@/lib/geographic-confidence';
import 'leaflet/dist/leaflet.css';

/** A geographic raster in Leaflet's overlay pane, not a screenshot/chart or marker halo. */
function GeographicRaster({fields}:{fields:ConfidenceField[]}){
  const map=useMap();
  useEffect(()=>{
    const canvas=document.createElement('canvas');canvas.className='leaflet-layer leaflet-zoom-hide';
    canvas.setAttribute('aria-hidden','true');canvas.style.pointerEvents='none';canvas.style.position='absolute';
    map.getPanes().overlayPane.appendChild(canvas);
    let frame=0,disposed=false;
    const draw=()=>{
      frame=0;if(disposed)return;
      const size=map.getSize();if(!size.x||!size.y)return;
      DomUtil.setPosition(canvas,map.containerPointToLayerPoint([0,0]));
      canvas.style.width=`${size.x}px`;canvas.style.height=`${size.y}px`;
      // Two CSS pixels per sample; the kernel itself remains geodesic at every zoom.
      const width=Math.ceil(size.x/2),height=Math.ceil(size.y/2);canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');if(!ctx)return;
      const image=ctx.createImageData(width,height);
      const latitudes=Array.from({length:height},(_,y)=>map.containerPointToLatLng([0,(y+.5)*size.y/height]).lat);
      const longitudes=Array.from({length:width},(_,x)=>map.containerPointToLatLng([(x+.5)*size.x/width,0]).lng);
      for(let y=0;y<height;y++)for(let x=0;x<width;x++){
        const intensity=geographicFieldValue([latitudes[y],longitudes[x]],fields),offset=(y*width+x)*4;
        image.data[offset]=121;image.data[offset+1]=88;image.data[offset+2]=48;image.data[offset+3]=Math.round(intensity*.46*255);
      }
      ctx.putImageData(image,0,0);
    };
    const request=()=>{if(!frame&&!disposed)frame=requestAnimationFrame(draw);};
    map.on('move zoom resize viewreset',request);request();
    return()=>{disposed=true;cancelAnimationFrame(frame);map.off('move zoom resize viewreset',request);canvas.remove();};
  },[map,fields]);
  return null;
}
function GeographicViewport({positions,selectedPosition,overview,focusVersion}:{positions:GeographicPoint[];selectedPosition:GeographicPoint|undefined;overview:number;focusVersion:number}){
  const map=useMap(),last=useRef<{selection:GeographicPoint|undefined;overview:number}|null>(null);
  useEffect(()=>{
    const previous=last.current,all=!previous||previous.overview!==overview;
    const points=all?positions:selectedPosition?[selectedPosition]:positions;
    if(points.length)map.fitBounds(fieldBounds(points),{padding:[26,26],maxZoom:7,animate:false});
    last.current={selection:selectedPosition,overview};
  },[map,positions,selectedPosition,overview,focusVersion]);
  useEffect(()=>{
    const observer=new ResizeObserver(()=>map.invalidateSize({pan:false,animate:false}));observer.observe(map.getContainer());
    return()=>observer.disconnect();
  },[map]);
  return null;
}
export function GeographicConfidenceMap({candidates,selectedIndex,onSelect}:{candidates:Investigation['candidates'];selectedIndex:number;onSelect:(index:number)=>void}){
  const located=useMemo(()=>mapTopCandidates(candidates),[candidates]);
  const fields=useMemo(()=>located.flatMap(entry=>entry.reason===null&&entry.position&&entry.score!==null?[{position:entry.position,score:entry.score,index:entry.index}]:[]),[located]);
  const positions=useMemo(()=>fields.map(field=>field.position),[fields]);
  const selectedPosition=fields.find(field=>field.index===selectedIndex)?.position;
  const center=unwrapGeographicPoints(positions)[0]??[20,0];
  const[overview,setOverview]=useState(0),[focusVersion,setFocusVersion]=useState(0),[tileError,setTileError]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  const mapKey=fields.map(field=>`${field.position}:${field.score}`).join('|');
  useEffect(()=>{setTileError(false);setLoading(true);},[mapKey]);
  return <><section className="geo-map-section" aria-labelledby="geographic-map-title" data-testid="map-confidence-fields">
    <p className="geo-eyebrow">Geographic comparison / top three</p><h2 className="geo-section-title" id="geographic-map-title">Where the leads point.</h2>
    <p className="geo-map-explanation">Independent model scores, shown as quiet local fields on the geographic map. Darker shading means a higher model score—not a greater verified likelihood.</p>
    {fields.length?<><div className="geo-map-surface"><MapContainer key={mapKey} center={center} zoom={3} scrollWheelZoom={false} aria-label="Geographic map of the highest-ranked coordinate-bearing leads">
      <TileLayer key={retry} referrerPolicy="strict-origin" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{loading:()=>setLoading(true),load:()=>setLoading(false),tileerror:()=>{setTileError(true);setLoading(false);}}}/>
      <GeographicViewport positions={positions} selectedPosition={selectedPosition} overview={overview} focusVersion={focusVersion}/>
      <GeographicRaster fields={fields}/>
    </MapContainer></div>
      {tileError?<p className="geo-map-status" role="alert" data-testid="status-map-tiles-error">Some geographic tiles could not load. Field coordinates are unchanged.<button type="button" data-testid="button-retry-map-tiles" onClick={()=>{setTileError(false);setLoading(true);setRetry(value=>value+1);}}>Retry tiles</button></p>:loading?<p className="geo-map-status skeleton" role="status" data-testid="status-map-tiles-loading">Loading geographic tiles…</p>:null}
      <button type="button" className="geo-overview-button" data-testid="button-map-all-fields" onClick={()=>setOverview(value=>value+1)}>Fit all mapped leads</button>
    </>:<div className="geo-empty" data-testid="map-no-coordinates">{candidates.length?'The three highest-ranked leads do not contain both usable map coordinates and a valid model score. No confidence field has been invented.':'No location candidates were returned. There is no geographic field to display.'}</div>}
    {located.some(entry=>entry.reason!==null)&&<ul className="geo-map-unmapped" data-testid="list-unmappable-leads">{located.filter(entry=>entry.reason!==null).map(entry=><li key={entry.index}>{entry.index+1}. {entry.lead.place}: {entry.reason==='missing_coordinates'?'no explicit valid coordinates in the saved map link':entry.reason==='projection_limit'?'outside the geographic latitude supported by these map tiles':'no valid model score'}.</li>)}</ul>}
    <p className="geo-map-method">Higher model scores produce stronger, broader fields. Spread is a display heuristic, not a measured search radius, location uncertainty, or calibrated probability. Distant fields stay separate; overlapping values use the stronger field, not a sum. Scores are never normalized to total 100%. Zoom into a field for local detail.</p>
    <p className="geo-map-method">Map tiles are requested from OpenStreetMap for the viewed area. The original photograph and private notes are not sent to the tile provider. No place-name geocoding is performed.</p>
  </section>
    {fields.length>0&&<section className="geo-mapped-leads" aria-labelledby="mapped-leads-title">
      <h2 className="geo-eyebrow" id="mapped-leads-title">Mapped leads</h2>
      <div className="geo-map-key" aria-label="Geographic field values">{located.filter(entry=>entry.reason===null).map(entry=><button type="button" key={entry.index} aria-pressed={entry.index===selectedIndex} data-testid={`button-map-field-${entry.index}`} onClick={()=>{onSelect(entry.index);setFocusVersion(value=>value+1);}}><span>{entry.index+1}. {entry.lead.place}<br/><small>{entry.position?.map(value=>value.toFixed(4)).join(', ')}</small></span><span className="geo-map-score">{Math.round((entry.score??0)*100)} / 100<small>View field</small></span></button>)}</div>
    </section>}
  </>;
}
