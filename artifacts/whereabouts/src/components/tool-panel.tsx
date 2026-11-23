import type { RefObject } from 'react';
import type { ExamplePhoto } from '@/lib/loupe-image-data';

export function ToolPanel({ photo, used, index, available, readoutRef }: { photo: ExamplePhoto | null; used: boolean; index: number; available: boolean; readoutRef: RefObject<HTMLSpanElement | null> }) {
  const gps = photo?.gps;
  const coordinate = (n: number, positive: string, negative: string) => `${Math.abs(n).toFixed(4)}° ${n >= 0 ? positive : negative}`;
  return <aside className="wa-tool-panel" aria-label="Wall-mounted loupe and specimen notes" data-testid="loupe-tool-panel">
    <p className="wa-tool-label">Loupe</p>
    {(!used||!available) && <p className="wa-tool-hint" data-testid="text-loupe-lift-hint">{available?'Hold to lift':'3D unavailable'}</p>}
    <div className="wa-tool-ruler" aria-hidden="true">{[0,10,20,30,40,50].map((value) => <span key={value}>{value}</span>)}<small style={{position:'absolute',bottom:14,right:3,fontSize:13}}>mm</small></div>
    <div className="wa-specimen-tag">
      <span>Sample {index+1}</span>
      <span>{gps?coordinate(gps[0],'N','S'):'GPS —'}</span><span>{gps?coordinate(gps[1],'E','W'):'GPS —'}</span>
      <span>{index === 0 ? 'Mariposa Grove' : 'Prepared sample'}</span>
      <span>{index === 0 ? 'Confidence 0.65' : 'Unverified'}</span>
      <small>{index === 0 ? 'Supplied estimate, not from photo data' : 'Fictional sample'}</small>
    </div>
    <p className="wa-tool-readout" aria-live="off"><span ref={readoutRef} data-testid="text-panel-pixel-position">X — / Y —</span></p>
  </aside>;
}
