import {useEffect,useMemo,useRef,useState} from 'react';
import {MapContainer,TileLayer,useMap} from 'react-leaflet';
import type {Investigation} from '@workspace/api-client-react';
import {mapTopCandidates,unwrapGeographicPoints,type GeographicPoint} from '@/lib/geographic-confidence';
import {ConfidenceHeatLayer} from './confidence-heat-layer';
import 'leaflet/dist/leaflet.css';


function GeographicViewport({positions,selectedPosition,overview,focusVersion}:{positions:GeographicPoint[];selectedPosition:GeographicPoint|undefined;overview:number;focusVersion:number}){
  const map=useMap(),last=useRef<{selection:GeographicPoint|undefined;overview:number}|null>(null);
  useEffect(()=>{
    const previous=last.current,all=!previous||previous.overview!==overview;
    const points=all?positions:selectedPosition?[selectedPosition]:positions;
    if(points.length===1)map.setView(points[0],14,{animate:false});
    else if(points.length>1)map.fitBounds(unwrapGeographicPoints(points),{padding:[26,26],maxZoom:15,animate:false});
    last.current={selection:selectedPosition,overview};
  },[map,positions,selectedPosition,overview,focusVersion]);
  useEffect(()=>{
    const observer=new ResizeObserver(()=>map.invalidateSize({pan:false,animate:false}));observer.observe(map.getContainer());
    return()=>observer.disconnect();
  },[map]);
  return null;
}
export function GeographicConfidenceMap({candidates,selectedIndex,onSelect}:{candidates:Investigation['candidates'];selectedIndex:number;onSelect:(index:number)=>void}){
  const located=useMemo(()=>{
    const percent=candidates.some(lead=>lead.confidence>1);
    return mapTopCandidates(candidates.map(lead=>({...lead,confidence:Number.isFinite(lead.confidence)?Math.max(0,Math.min(1,lead.confidence/(percent?100:1))):NaN})));
  },[candidates]);
  const[heatError,setHeatError]=useState(false);
  const fields=useMemo(()=>located.flatMap(entry=>entry.reason===null&&entry.position&&entry.score!==null?[{position:entry.position,score:entry.score,index:entry.index}]:[]),[located]);
  const positions=useMemo(()=>fields.map(field=>field.position),[fields]);
  const selectedPosition=fields.find(field=>field.index===selectedIndex)?.position;
  const center=unwrapGeographicPoints(positions)[0]??[20,0];
  const[overview,setOverview]=useState(0),[focusVersion,setFocusVersion]=useState(0),[tileError,setTileError]=useState(false),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
  const mapKey=fields.map(field=>`${field.position}:${field.score}`).join('|');
  useEffect(()=>{setTileError(false);setLoading(true);},[mapKey]);
  return <><section className="geo-map-section" aria-labelledby="geographic-map-title" data-testid="map-confidence-fields">
    <p className="geo-eyebrow">Geographic comparison / top three</p><h2 className="geo-section-title" id="geographic-map-title">Where the leads point.</h2>
    <p className="geo-map-explanation">Confidence-weighted heat over candidate coordinates. Warmer colors indicate stronger local intensity—not verified location probability.</p>
    {fields.length?<><div className="geo-map-surface"><MapContainer key={mapKey} center={center} zoom={3} minZoom={1} scrollWheelZoom={false} aria-label="Geographic map of the highest-ranked coordinate-bearing leads">
      <TileLayer key={retry} referrerPolicy="strict-origin" maxZoom={17} attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)' url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" eventHandlers={{loading:()=>setLoading(true),load:()=>setLoading(false),tileerror:()=>{setTileError(true);setLoading(false);}}}/>
      <GeographicViewport positions={positions} selectedPosition={selectedPosition} overview={overview} focusVersion={focusVersion}/>
      <ConfidenceHeatLayer fields={fields} onError={setHeatError}/>
    </MapContainer></div>
      {tileError?<p className="geo-map-status" role="alert" data-testid="status-map-tiles-error">Some geographic tiles could not load. Field coordinates are unchanged.<button type="button" data-testid="button-retry-map-tiles" onClick={()=>{setTileError(false);setLoading(true);setRetry(value=>value+1);}}>Retry tiles</button></p>:loading?<p className="geo-map-status skeleton" role="status" data-testid="status-map-tiles-loading">Loading geographic tiles…</p>:null}
      {heatError&&<p role="alert" className="geo-map-status">The heat renderer could not load. Candidate coordinates and scores remain available below.</p>}
      <button type="button" className="geo-overview-button" data-testid="button-map-all-fields" onClick={()=>setOverview(value=>value+1)}>Fit all mapped leads</button>
    </>:<div className="geo-empty" data-testid="map-no-coordinates">{candidates.length?'The three highest-ranked leads do not contain both usable map coordinates and a valid model score. No confidence field has been invented.':'No location candidates were returned. There is no geographic field to display.'}</div>}
    {located.some(entry=>entry.reason!==null)&&<ul className="geo-map-unmapped" data-testid="list-unmappable-leads">{located.filter(entry=>entry.reason!==null).map(entry=><li key={entry.index}>{entry.index+1}. {entry.lead.place}: {entry.reason==='missing_coordinates'?'no explicit valid coordinates in the saved map link':entry.reason==='projection_limit'?'outside the geographic latitude supported by these map tiles':'no valid model score'}.</li>)}</ul>}
  </section>
    {fields.length>0&&<section className="geo-mapped-leads" aria-labelledby="mapped-leads-title">
      <h2 className="geo-eyebrow" id="mapped-leads-title">Mapped leads</h2>
      <div className="geo-map-key" aria-label="Geographic field values">{located.filter(entry=>entry.reason===null).map(entry=><button type="button" key={entry.index} aria-pressed={entry.index===selectedIndex} data-testid={`button-map-field-${entry.index}`} onClick={()=>{onSelect(entry.index);setFocusVersion(value=>value+1);}}><span>{entry.index+1}. {entry.lead.place}<br/><small>{entry.position?.map(value=>value.toFixed(4)).join(', ')}</small></span><span className="geo-map-score">{Math.round((entry.score??0)*100)} / 100<small>View field</small></span></button>)}</div>
    </section>}
  </>;
}
