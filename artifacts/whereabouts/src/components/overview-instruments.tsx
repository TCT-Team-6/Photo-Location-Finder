import {useEffect,useMemo,useState} from 'react';
import {Link} from 'wouter';
import {ArrowRight} from 'lucide-react';
import {getGetInvestigationPhotoQueryKey,useGetInvestigationPhoto,type Investigation} from '@workspace/api-client-react';
import {InstrumentView} from './InstrumentKit';
import {countDigits} from '@/lib/split-flap';
import {originalPhotoFile,overviewPhotoState} from '@/lib/overview-photo';
import {isVideoInvestigation} from '@/lib/video-analysis';
import '@/styles/overview-instruments.css';

export function OverviewClock({value,label,caption}:{value:number;label:string;caption:string}){
  return <figure className="overview-clock" data-testid={`stat-${label.toLowerCase().replaceAll(' ','-')}`} aria-label={`${label}: ${value}. ${caption}`}>
    <div className="physical-footprint physical-splitflap" aria-hidden="true">
      <InstrumentView kind="splitflap" value={value} labels={[label]}/>
      <span className="overview-count-fallback"><small>{label}</small>{countDigits(value)}</span>
    </div><figcaption aria-hidden="true">{caption}</figcaption>
  </figure>;
}

export function OverviewPhoto({item,title,date}:{item:Investigation|null|undefined;title:string;date:string}){
  const video=isVideoInvestigation(item),id=item?.id??'';
  const photo=useGetInvestigationPhoto(id,{query:{enabled:Boolean(id)&&!video,queryKey:getGetInvestigationPhotoQueryKey(id)}});
  const file=useMemo(()=>originalPhotoFile(photo.data),[photo.data]);
  const[retry,setRetry]=useState(0);
  const[decode,setDecode]=useState<{file:File|null;status:'loading'|'ready'|'error'}>({file:null,status:'loading'});
  useEffect(()=>{
    if(!file)return;
    let alive=true;const image=new Image(),url=URL.createObjectURL(file);
    setDecode({file,status:'loading'});
    image.onload=()=>{if(alive)setDecode({file,status:'ready'});};
    image.onerror=()=>{if(alive)setDecode({file,status:'error'});};
    image.src=url;
    return()=>{alive=false;image.onload=null;image.onerror=null;URL.revokeObjectURL(url);};
  },[file,retry]);
  const state=overviewPhotoState({exists:Boolean(item),video,loading:photo.isLoading||photo.isFetching,error:photo.isError||(photo.isSuccess&&!file)||(decode.file===file&&decode.status==='error'),decoded:decode.file===file&&decode.status==='ready'});
  return <figure className="overview-print" data-testid="overview-most-recent" data-photo-state={state}>
    {state==='ready'&&file?<div className="physical-footprint physical-archiveprint" role="img" aria-label={`Original investigation photograph: ${title}`}><InstrumentView key={id} kind="archiveprint" media={file}/></div>
      :<div className={`overview-photo-state ${state==='loading'?'skeleton':''}`} role={state==='error'?'alert':'status'} data-testid={`overview-photo-${state}`}>
        <strong>{state==='loading'?'Retrieving original':state==='error'?'Original unavailable':state==='video'?'Video investigation':'A place for your first clue'}</strong>
        <span>{state==='loading'?'Opening your private photograph.':state==='error'?'The photograph could not be opened. Your investigation is unchanged.':state==='video'?'Open the report to review the original video and its key moments.':'Save an investigation to place its original photograph here.'}</span>
        {state==='error'&&<button type="button" data-testid="button-retry-overview-photo" onClick={()=>{setDecode({file:null,status:'loading'});setRetry(value=>value+1);void photo.refetch();}}>Retry original</button>}
      </div>}
    <figcaption><p className="overview-print-label">Most recent / original evidence</p><h3 data-testid="text-latest-title">{title}</h3><p className="overview-print-date">{date}</p>
      {item?<Link href={`/investigation/${item.id}`} data-testid="link-latest-investigation" className="overview-print-link">Open trail <ArrowRight size={14}/></Link>:<Link href="/investigate" data-testid="link-overview-first-photo" className="overview-print-link">Investigate a photograph <ArrowRight size={14}/></Link>}
    </figcaption>
  </figure>;
}
