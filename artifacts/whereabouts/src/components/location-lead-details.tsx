import {useState} from 'react';
import {Link} from 'wouter';
import {ArrowUpRight} from 'lucide-react';
import type {Investigation} from '@workspace/api-client-react';

export function readableClue(value:string){const text=value.replaceAll('_',' ').replace(/\s+/g,' ').trim();return text?text[0].toLocaleUpperCase()+text.slice(1):text;}
export function publicHttpURL(value:string):string|undefined{try{const url=new URL(value);return['https:','http:'].includes(url.protocol)?url.href:undefined;}catch{return undefined;}}
function ReferenceImage({url,caption}:{url:string;caption:string}){
  const[failed,setFailed]=useState(false);
  return !failed&&publicHttpURL(url)?<img src={url} alt={caption} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<span className="geo-reference-missing">Preview unavailable. Open the source page.</span>;
}
export function LocationLeadDetails({lead,index,item}:{lead:Investigation['candidates'][number];index:number;item:Investigation}){
  const references=lead.photoReferences??[],mapURL=publicHttpURL(lead.mapsUrl);
  return <article className="geo-lead-details" data-testid="panel-selected-location-lead">
    <p className="geo-eyebrow">{index===0?'Highest Confidence':'Selected location lead'} / {String(index+1).padStart(2,'0')}</p>
    <h3>{lead.place}</h3><p>{[lead.region,lead.country].filter(Boolean).join(', ')||'Region not specified'}</p>
    <p><strong>Why it was suggested</strong><br/>{lead.rationale||'No rationale was supplied for this lead.'}</p>
    {lead.clues.length>0&&<div className="geo-lead-clues" aria-label="Related scene clues">{lead.clues.map((clue,i)=><span key={`${clue}-${i}`}>{readableClue(clue)}</span>)}</div>}
    {references.length?<details className="geo-public-references" data-testid={`section-photo-references-${index}`}><summary>Public photo references ({references.length})</summary><div className="geo-reference-grid">
      {references.map((reference,i)=>{const source=publicHttpURL(reference.sourceUrl),caption=reference.caption??`Public photo reference for ${lead.place}`;return <a key={`${reference.imageUrl}-${i}`} href={source} aria-disabled={!source} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-testid={`link-photo-reference-${index}-${i}`}><ReferenceImage key={reference.thumbnailUrl??reference.imageUrl} url={reference.thumbnailUrl??reference.imageUrl} caption={caption}/><span>{caption}</span><small>{source?new URL(source).hostname:'Source link unavailable'} <ArrowUpRight size={10} className="inline"/></small></a>;})}
    </div></details>:<p data-testid={`status-photo-search-${index}`}>{item.analysis?.source==='Replit AI vision fallback'?'Public photo references were not searched for these unverified fallback guesses.':lead.photoSearchStatus==='unavailable'?'Web photo search is temporarily unavailable for this lead.':lead.photoSearchStatus==='no_results'?'No public photo references were found for this place.':'Photo references were not collected for this investigation.'}</p>}
    <div className="geo-lead-links">{mapURL?<a href={mapURL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" data-testid={`link-map-candidate-${index}`}>Explore this location <ArrowUpRight size={12} className="inline"/></a>:<p>Saved map link unavailable.</p>}<Link href={`/investigation/${encodeURIComponent(item.id)}/location/${index}`} data-testid={`link-location-report-${index}`}>Open full in-app location report</Link></div>
  </article>;
}
