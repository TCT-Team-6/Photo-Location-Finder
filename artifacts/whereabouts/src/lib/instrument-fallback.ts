import type { InstrumentKind, InstrumentPalette } from '@/components/physical-models';

/** These URLs point ONLY to PNG frames exported by the real instrument scene.
 * No drawn proxy, SVG, CSS metal, or synthetic "render succeeded" state.
 */
export function instrumentFallbackURL(kind: InstrumentKind) {
  return `${import.meta.env.BASE_URL}instrument-renders/${kind}.png`;
}
const frames=new Map<string,string>();
export function instrumentFrameKey(kind:InstrumentKind,palette:InstrumentPalette,value:number,active:boolean){
  return `${kind}:${palette.paper}:${palette.ink}:${palette.accent}:${value}:${active}`;
}
export function cachedInstrumentFrame(key:string){return frames.get(key);}
export function cacheInstrumentFrame(key:string,png:string){
  if(!png.startsWith('data:image/png;base64,'))return;
  if(frames.size>64)frames.delete(frames.keys().next().value!);
  frames.set(key,png);
}
