import type { RefObject } from 'react';
import type { ExamplePhoto } from '@/lib/loupe-image-data';

export function ToolPanel({ photo, used, index, available, readoutRef }: { photo: ExamplePhoto | null; used: boolean; index: number; available: boolean; readoutRef: RefObject<HTMLSpanElement | null> }) {
  const gps = photo?.gps;
  const coordinate = (n: number, positive: string, negative: string) => `${Math.abs(n).toFixed(4)}° ${n >= 0 ? positive : negative}`;
  return <aside className="wa-tool-panel" aria-label="Wall-mounted loupe and specimen notes" data-testid="loupe-tool-panel">
    <p className="wa-tool-label">INSTRUMENT 01 — LOUPE</p>
    {(!used||!available) && <p className="wa-tool-hint" data-testid="text-loupe-lift-hint">{available?'HOLD TO LIFT':'3D UNAVAILABLE'}</p>}
    <div className="wa-tool-ruler" aria-hidden="true">{[0,10,20,30,40,50].map((value) => <span key={value}>{value}</span>)}<small style={{position:'absolute',bottom:14,right:3,fontSize:6}}>mm</small></div>
    <div className="wa-specimen-tag">
      <span>SPECIMEN {String(index+1).padStart(2,'0')}</span>
      <span>{gps?coordinate(gps[0],'N','S'):'GPS —'}</span><span>{gps?coordinate(gps[1],'E','W'):'GPS —'}</span>
      <span>{index === 0 ? 'MARIPOSA GROVE' : 'PREPARED SAMPLE'}</span>
      <span>{index === 0 ? 'CONF 0.65' : 'UNVERIFIED'}</span>
      <small>{index === 0 ? 'SUPPLIED MATCH / USER ESTIMATE / NOT EXIF' : 'FICTIONAL SAMPLE / NOT EXIF'}</small>
    </div>
    <p className="wa-tool-readout" aria-live="off"><span ref={readoutRef} data-testid="text-panel-pixel-position">X — / Y —</span></p>
  </aside>;
}
