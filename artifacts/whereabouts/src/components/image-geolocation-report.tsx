import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Check,Copy} from 'lucide-react';
import type {Investigation} from '@workspace/api-client-react';
import {RankedPlacesMap} from './results/ranked-places-map';
import {RankedPlacesList} from './results/ranked-places-list';
import {PipelineBar} from './results/pipeline-bar';
import {LocationLeadDetails,publicHttpURL,readableClue} from './location-lead-details';
import {HealthUrgencyCard} from './health-urgency-card';
import {buildLeadSummary} from '@/lib/lead-summary';
import {coordinatesFromMapsUrl,FIELD_SUPPORT_KM} from '@/lib/geographic-confidence';
import {confidencePercent,livePipeline,supportingClues} from '@/lib/result-insights';
import '@/styles/image-report.css';
import '@/styles/ranked-results.css';

function SavedOriginal({url,name,loading,error,retry,tags,activeTag}:{url:string;name:string;loading:boolean;error:boolean;retry:()=>void;tags:string[];activeTag:string|null}){
  const[decodeError,setDecodeError]=useState(false);
  return <figure className="rp-photo" data-testid="panel-original-photo">
    <div className="rp-photo-frame">{loading?<div className="geo-photo-state skeleton w-full text-[#f4f0e6]" role="status" data-testid="status-original-loading">Opening your saved photograph…</div>:error||decodeError||!url?<div className="geo-photo-state w-full text-[#f4f0e6]" role="alert" data-testid="status-photo-error">The saved photograph is temporarily unavailable.<button type="button" data-testid="button-retry-report-photo" onClick={()=>{setDecodeError(false);retry();}}>Retry original photograph</button></div>:<img src={url} alt={`Original photograph: ${name}`} onError={()=>setDecodeError(true)} data-testid="img-original-investigation-photo"/>}</div>
    {tags.length>0&&<ul className="rp-photo-tags" aria-label="Clue tags read from this photo">{tags.map((tag,i)=><li key={`${tag}-${i}`} className={`rp-photo-tag${tag===activeTag?' is-active':''}`} data-testid={`tag-photo-clue-${i}`}>{tag}</li>)}</ul>}
    <figcaption className="mt-2 font-data text-[9px] uppercase tracking-[.12em] text-[#718078]">Original photograph / private evidence</figcaption>
  </figure>;
}

export function ImageGeolocationReport({item,leads,sceneSummary,photoURL,photoLoading,photoError,onRetryPhoto,selectedIndex,onSelect,onRefresh,refreshing,refreshMessage,onRetryAnalysis,retrying,retryError}:{
  item:Investigation;leads:Investigation['candidates'];sceneSummary:string;photoURL:string;photoLoading:boolean;photoError:boolean;onRetryPhoto:()=>void;
  selectedIndex:number;onSelect:(index:number)=>void;onRefresh:()=>void;refreshing:boolean;refreshMessage:string;onRetryAnalysis:()=>void;retrying:boolean;retryError:string;
}){
  const[copyState,setCopyState]=useState<'idle'|'copied'|'failed'>('idle'),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const[focusToken,setFocusToken]=useState(0),[scrollToken,setScrollToken]=useState(0),[activeTag,setActiveTag]=useState<string|null>(null);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const copy=async()=>{try{await navigator.clipboard.writeText(buildLeadSummary(item,leads));setCopyState('copied');}catch{setCopyState('failed');}clearTimeout(timer.current);timer.current=setTimeout(()=>setCopyState('idle'),2500);};
  const selected=leads[selectedIndex]??leads[0],actualIndex=leads[selectedIndex]?selectedIndex:0;
  const tags=useMemo(()=>item.clues.map(clue=>readableClue(clue.label)).filter(Boolean),[item.clues]);
  const entries=useMemo(()=>leads.map((lead,index)=>({index,place:lead.place,position:coordinatesFromMapsUrl(lead.mapsUrl),percent:confidencePercent(lead.confidence)})),[leads]);
  const items=useMemo(()=>leads.map((lead,index)=>({index,place:lead.place,region:[lead.region,lead.country].filter(Boolean).join(', ')||'Region not specified',percent:entries[index].percent,clues:supportingClues(lead,tags),mapped:Boolean(entries[index].position)})),[leads,tags,entries]);
  const pipeline=useMemo(()=>livePipeline(item),[item]);
  const trace=item.analysis?.reasoning_trace??[];
  return <div className="geo-report space-y-4" data-testid="image-geolocation-report">
    {item.status==='analyzing'&&<p className="geo-candidate-note" role="status">Location analysis is still running. Any saved leads below may be incomplete.</p>}
    {item.status==='failed'&&<div className="geo-candidate-note" role="alert"><p>The location analysis did not finish. Your original photograph is still saved.</p><button type="button" data-testid="button-retry-image-analysis" disabled={retrying} onClick={onRetryAnalysis}>{retrying?'Restarting analysis…':'Try analysis again'}</button>{retryError&&<p>{retryError}</p>}</div>}
    <PipelineBar summary={pipeline} targetId="ai-decision-trail"/>
    <div className="rp-top" data-testid="section-results-primary">
      <div className="rp-area-map"><RankedPlacesMap entries={entries} selectedIndex={actualIndex} onSelect={i=>{onSelect(i);setScrollToken(t=>t+1);}} focusToken={focusToken} supportKm={FIELD_SUPPORT_KM} focusZoom={9} title="Where the clues point" subtitle="Research leads to check, not confirmed whereabouts."/></div>
      <div className="rp-area-list">
        <RankedPlacesList items={items} selectedIndex={actualIndex} onSelect={i=>{onSelect(i);setFocusToken(t=>t+1);}} scrollToken={scrollToken} activeTag={activeTag} onClueFocus={setActiveTag} testId="list-ranked-location-leads"
          actions={<><button type="button" data-testid="button-copy-summary" onClick={()=>void copy()}>{copyState==='copied'?<Check size={12}/>:<Copy size={12}/>} {copyState==='copied'?'Copied':'Copy summary'}</button><button type="button" data-testid="button-refresh-location-leads" disabled={refreshing} onClick={onRefresh}>{refreshing?'Searching…':'Try different leads'}</button></>}
          renderDetails={i=>{const lead=leads[i],mapURL=publicHttpURL(lead.mapsUrl);return <div className="rp-item-details"><p><strong className="text-[#344b42]">Why it was suggested:</strong> {lead.rationale||'No rationale was supplied for this lead.'}</p>{i===0&&mapURL&&<a href={mapURL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-testid="link-best-guess-map">Open in Google Maps <ArrowUpRight size={11} className="inline"/></a>}</div>;}}/>
      </div>
      <div className="rp-area-photo"><SavedOriginal key={photoURL} url={photoURL} name={item.originalName} loading={photoLoading} error={photoError} retry={onRetryPhoto} tags={tags} activeTag={activeTag}/></div>
    </div>
    {refreshMessage&&<p className="geo-candidate-note" role="status" data-testid="status-refresh-leads">{refreshMessage}</p>}
    {copyState!=='idle'&&<p className="geo-candidate-note" role="status">{copyState==='copied'?'Summary copied to the clipboard.':'Copy failed. Your browser may have blocked clipboard access; select the report text instead.'}</p>}
    <p className="geo-candidate-note" data-testid="text-leads-disclaimer">These are research leads, not confirmed locations or calibrated probabilities. Confidence values are independent; they do not add up to 100%. Nothing in this report establishes anyone’s present whereabouts. Public reference-photo searches use location names only, never the original photograph or your private notes.</p>
    {selected&&<LocationLeadDetails key={`${actualIndex}:${selected.place}`} lead={selected} index={actualIndex} item={item}/>}
    <section className="geo-scene-notes"><p className="geo-eyebrow">Scene notes</p><p className="geo-scene-summary" data-testid="text-investigation-summary">{sceneSummary||'No scene summary was returned.'}</p>
      {item.context?.trim()&&<div className="geo-context"><p className="geo-eyebrow">Your notes</p><p data-testid="text-investigation-context">{item.context.trim()}</p></div>}
    </section>
    <details className="geo-evidence"><summary><p className="geo-eyebrow">Visual evidence</p><h2 className="geo-section-title">Details in the frame.</h2><span>{item.clues.length} clues · expand or collapse</span></summary>
      {item.clues.length?item.clues.map((clue,index)=><article key={`${clue.label}-${index}`} className="geo-clue" data-testid={`card-clue-${index}`}><h3><span className="geo-eyebrow">{String(index+1).padStart(2,'0')} / </span>{readableClue(clue.label)}</h3><p>{readableClue(clue.observation)}</p><p>{readableClue(clue.significance)}</p></article>):<p className="geo-empty" data-testid="content-no-clues">No visual clues were returned for this investigation.</p>}
    </details>
    <HealthUrgencyCard investigation={item}/>
    <details open id="ai-decision-trail" className="rp-trail" data-testid="panel-ai-decision-trail">
      <summary><p className="geo-eyebrow">AI decision trail</p><h2 className="geo-section-title">What this response contains.</h2></summary>
      <ol>{pipeline.stages.map((stage,i)=><li key={stage.name} data-testid={`row-live-trail-${i}`}><span className="font-data text-[11px] text-[#385e51]">{stage.complete?<Check size={13}/>:'—'}</span><span><strong className="text-[#344b42]">{stage.name}</strong><br/><span className="text-[#718078]">{stage.evidence}</span></span></li>)}
        {trace.map((step,i)=><li key={`trace-${i}`} data-testid={`row-live-trace-${i}`}><span className="font-data text-[11px] text-[#9c6d4e]">{i+1}</span><span><strong className="text-[#344b42]">{step.stage||step.step||'Provider step'}</strong><br/><span className="text-[#718078]">{[step.detail,...(step.details??[])].filter(Boolean).join(' · ')||'No detail supplied.'}</span></span></li>)}
      </ol>
      <p className="px-[18px] pb-4 text-[11px] leading-5 text-[#718078]">Checks reflect only what the saved response includes. {pipeline.sourceLabel?`Analysis source: ${pipeline.sourceLabel}. `:''}No model name or analysis time is returned by this service.</p>
    </details>
    <footer aria-label="Map methodology and privacy">
      <p className="geo-map-method">Pins are numbered by rank. Heat is strongest around higher-Confidence places; its spread is a display heuristic, not a measured search radius, location uncertainty, or calibrated probability. Overlapping heat uses the stronger field, not a sum. Confidence values are never normalized to total 100%.</p>
      <p className="geo-map-method">Map tiles are requested from OpenStreetMap for the viewed area. The original photograph and private notes are not sent to the tile provider. No place-name geocoding is performed.</p>
    </footer>
  </div>;
}
