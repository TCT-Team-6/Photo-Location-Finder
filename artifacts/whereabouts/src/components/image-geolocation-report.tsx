import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check,Copy} from 'lucide-react';
import type {Investigation} from '@workspace/api-client-react';
import {GeographicConfidenceMap} from './geographic-confidence-map';
import {LocationLeadDetails,publicHttpURL,readableClue} from './location-lead-details';
import {HealthUrgencyCard} from './health-urgency-card';
import {InstrumentView} from './InstrumentKit';
import {buildLeadSummary} from '@/lib/lead-summary';
import {modelScoreUnit} from '@/lib/geographic-confidence';
import '@/styles/image-report.css';

function SavedOriginal({url,name,loading,error,retry}:{url:string;name:string;loading:boolean;error:boolean;retry:()=>void}){
  const[decodeError,setDecodeError]=useState(false);
  return <figure className="geo-photo">
    {loading?<div className="geo-photo-state skeleton" role="status" data-testid="status-original-loading">Opening your saved photograph…</div>:error||decodeError||!url?<div className="geo-photo-state" role="alert" data-testid="status-photo-error">The saved photograph is temporarily unavailable.<button type="button" data-testid="button-retry-report-photo" onClick={()=>{setDecodeError(false);retry();}}>Retry original photograph</button></div>:<img src={url} alt={`Original photograph: ${name}`} onError={()=>setDecodeError(true)} data-testid="img-original-investigation-photo"/>}
    <figcaption>Original photograph / private evidence</figcaption>
  </figure>;
}
export function ImageGeolocationReport({item,leads,sceneSummary,photoURL,photoLoading,photoError,onRetryPhoto,selectedIndex,onSelect,onRefresh,refreshing,refreshMessage,onRetryAnalysis,retrying,retryError}:{
  item:Investigation;leads:Investigation['candidates'];sceneSummary:string;photoURL:string;photoLoading:boolean;photoError:boolean;onRetryPhoto:()=>void;
  selectedIndex:number;onSelect:(index:number)=>void;onRefresh:()=>void;refreshing:boolean;refreshMessage:string;onRetryAnalysis:()=>void;retrying:boolean;retryError:string;
}){
  const[copyState,setCopyState]=useState<'idle'|'copied'|'failed'>('idle'),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const copy=async()=>{try{await navigator.clipboard.writeText(buildLeadSummary(item,leads));setCopyState('copied');}catch{setCopyState('failed');}clearTimeout(timer.current);timer.current=setTimeout(()=>setCopyState('idle'),2500);};
  const selected=leads[selectedIndex]??leads[0],actualIndex=leads[selectedIndex]?selectedIndex:0;
  const sceneScore=leads[0]?modelScoreUnit(leads[0].confidence):null;
  return <div className="geo-report" data-testid="image-geolocation-report">
    {item.status==='analyzing'&&<p className="geo-candidate-note" role="status">Location analysis is still running. Any saved leads below may be incomplete.</p>}
    {item.status==='failed'&&<div className="geo-candidate-note" role="alert"><p>The location analysis did not finish. Your original photograph is still saved.</p><button type="button" data-testid="button-retry-image-analysis" disabled={retrying} onClick={onRetryAnalysis}>{retrying?'Restarting analysis…':'Try analysis again'}</button>{retryError&&<p>{retryError}</p>}</div>}
    <div className="geo-report-primary">
      <div data-testid="column-image-evidence"><SavedOriginal key={photoURL} url={photoURL} name={item.originalName} loading={photoLoading} error={photoError} retry={onRetryPhoto}/>
        <section className="geo-scene-notes"><p className="geo-eyebrow">Scene notes</p><p className="geo-scene-summary" data-testid="text-investigation-summary">{sceneSummary||'No scene summary was returned.'}</p>
          {leads[0]&&<p className="geo-scene-confidence" data-testid="text-scene-confidence">Confidence: {sceneScore===null?'Not supplied':`${Math.round(sceneScore*100)} / 100`} · strongest lead model score, not a verified probability.</p>}
          {item.context?.trim()&&<div className="geo-context"><p className="geo-eyebrow">Your notes</p><p data-testid="text-investigation-context">{item.context.trim()}</p></div>}
        </section>
      </div>
      <GeographicConfidenceMap candidates={leads} selectedIndex={actualIndex} onSelect={onSelect}/>
    </div>
    <section className="geo-candidates" aria-labelledby="ranked-leads-title">
      <div className="geo-candidate-heading"><div><p className="geo-eyebrow">Possible whereabouts / descending model score</p><h2 className="geo-section-title" id="ranked-leads-title">Follow the leads.</h2></div>
        <div className="geo-candidate-actions"><button type="button" data-testid="button-copy-summary" onClick={()=>void copy()}>{copyState==='copied'?<Check size={13} className="inline"/>:<Copy size={13} className="inline"/>} {copyState==='copied'?'Copied':'Copy summary'}</button><button type="button" data-testid="button-refresh-location-leads" disabled={refreshing} onClick={onRefresh}>{refreshing?'Searching…':'Try different leads'}</button></div>
      </div>
      {refreshMessage&&<p className="geo-candidate-note" role="status" data-testid="status-refresh-leads">{refreshMessage}</p>}
      {copyState!=='idle'&&<p className="geo-candidate-note" role="status">{copyState==='copied'?'Summary copied to the clipboard.':'Copy failed. Your browser may have blocked clipboard access; select the report text instead.'}</p>}
      <p className="geo-candidate-note">These are model-ranked research leads, not confirmed locations or calibrated probabilities. Scores are independent; they do not add up to 100%. Public reference-photo searches use location names only, never the original photograph or your private notes.</p>
      {leads.length?<><ol className="geo-candidate-list" data-testid="list-ranked-location-leads">{leads.map((lead,index)=>{
        const score=modelScoreUnit(lead.confidence),mapURL=publicHttpURL(lead.mapsUrl);
        return <li className={`geo-lead ${index===0?'geo-lead-best physical-footprint':''}`} key={`${lead.place}-${index}`} data-testid={`card-ranked-lead-${index}`}>
          {index===0&&<InstrumentView kind="leadpaper"/>}
          <div className="geo-lead-content">{index===0&&<p className="geo-lead-top-label">Highest model score / lead to verify</p>}
            <button type="button" className="geo-lead-select" aria-pressed={actualIndex===index} onClick={()=>onSelect(index)} data-testid={`button-select-lead-${index}`}>
              <span className="geo-lead-rank">{String(index+1).padStart(2,'0')}</span><span><span className="geo-lead-name" data-testid={index===0?'text-best-guess-place':undefined}>{lead.place}</span><span className="geo-lead-region">{[lead.region,lead.country].filter(Boolean).join(', ')||'Region not specified'}</span></span><span className="geo-lead-score">{score===null?'—':Math.round(score*100)}<small>{score===null?'Score not supplied':'/ 100 model score'}</small></span>
            </button>
            {index===0&&mapURL&&<a href={mapURL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="geo-lead-top-link" data-testid="link-best-guess-map">Open in Google Maps <ArrowUpRight size={12}/></a>}
          </div>
        </li>;
      })}</ol>{selected&&<LocationLeadDetails key={`${actualIndex}:${selected.place}`} lead={selected} index={actualIndex} item={item}/>}</>:<p className="geo-empty" data-testid="content-no-candidates">No likely places were returned. Keep the image in your library and revisit as new clues surface.</p>}
      <p className="geo-candidate-note">Read the map, not an answer: compare the visible evidence with independent sources. Nothing in this report establishes anyone’s present whereabouts.</p>
    </section>
    <details className="geo-evidence" open><summary><p className="geo-eyebrow">Visual evidence</p><h2 className="geo-section-title">Details in the frame.</h2><span>{item.clues.length} clues · expand or collapse</span></summary>
      {item.clues.length?item.clues.map((clue,index)=><article key={`${clue.label}-${index}`} className="geo-clue" data-testid={`card-clue-${index}`}><h3><span className="geo-eyebrow">{String(index+1).padStart(2,'0')} / </span>{readableClue(clue.label)}</h3><p>{readableClue(clue.observation)}</p><p>{readableClue(clue.significance)}</p></article>):<p className="geo-empty" data-testid="content-no-clues">No visual clues were returned for this investigation.</p>}
    </details>
    <HealthUrgencyCard investigation={item}/>
    <footer aria-label="Map methodology and privacy">
      <p className="geo-map-method">Heat intensity uses confidence raised to 1.5 without zoom-based dimming. Nearby points accumulate intensity. A 400-meter display footprint scales with map latitude and zoom, clamped to 6–120 pixels with 80% blur; it is not a measured search radius or calibrated probability. Scores are never normalized to total 100%.</p>
      <p className="geo-map-method">Map tiles are requested from CARTO for the viewed area using OpenStreetMap data. The original photograph and private notes are not sent to the tile provider. No place-name geocoding is performed.</p>
    </footer>
  </div>;
}
