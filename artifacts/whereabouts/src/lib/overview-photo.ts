export type OverviewPhotoState='empty'|'video'|'loading'|'error'|'ready';
export function overviewPhotoState({exists,video,loading,error,decoded}:{exists:boolean;video:boolean;loading:boolean;error:boolean;decoded:boolean}):OverviewPhotoState{
  if(!exists)return'empty';
  if(video)return'video';
  if(error)return'error';
  if(loading||!decoded)return'loading';
  return'ready';
}
/** The photo endpoint is authenticated; reject non-image error bodies, never render them. */
export function originalPhotoFile(data:unknown):File|null{
  return data instanceof Blob&&data.size>0&&data.type.startsWith('image/')?new File([data],'saved-original',{type:data.type}):null;
}
