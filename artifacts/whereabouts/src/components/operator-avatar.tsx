import {useState} from 'react';
export function OperatorAvatar({accountId,imageUrl,name}:{accountId?:string;imageUrl?:string|null;name:string}){
  const source=imageUrl?.trim()??'';
  return <AvatarImage key={`${accountId??'guest'}:${source}`} source={source} name={name}/>;
}
function AvatarImage({source,name}:{source:string;name:string}){
  const[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false),initial=Array.from(name.trim())[0]?.toLocaleUpperCase()||'G';
  return <span className="instrument-avatar" aria-label={`${name||'Guest'} account`}><span className="instrument-avatar-initial" aria-hidden="true">{initial}</span>{source&&!failed&&<img src={source} alt="" style={{opacity:loaded?1:0}} onLoad={event=>{if(event.currentTarget.naturalWidth>0)setLoaded(true);else setFailed(true);}} onError={()=>{setFailed(true);setLoaded(false);}}/>}</span>;
}
