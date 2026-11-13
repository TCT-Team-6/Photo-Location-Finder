import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { demoSamples } from '@/lib/demo-samples';

/** A manually operated sample viewer, never an analysis or a progress display. */
export function PhotoInstrument() {
  const [index, setIndex] = useState(0);
  const sample = demoSamples[index];
  return <div className="wa-instrument" data-testid="panel-photo-instrument">
    <div className="wa-instrument-header"><span>Image exploration instrument</span><span>W / 01</span></div>
    <div className="wa-aperture">
      <div className="wa-aperture-image">
        <img key={sample.imageUrl} src={sample.imageUrl} alt={`Fictional sample scene: ${sample.investigation.title}`} data-testid="img-landing-sample" />
        <div className="wa-viewfinder" aria-hidden="true" />
        <p className="wa-aperture-caption">FICTIONAL SAMPLE · NOT LIVE EVIDENCE</p>
      </div>
    </div>
    <div className="wa-instrument-controls">
      <button type="button" className="wa-dial-button" onClick={() => setIndex((index + demoSamples.length - 1) % demoSamples.length)} aria-label="Previous sample photo" data-testid="button-previous-landing-sample"><ArrowLeft size={18} /></button>
      <div className="wa-instrument-info" aria-live="polite">
        <p>FRAME {String(index + 1).padStart(2, '0')} / {String(demoSamples.length).padStart(2, '0')}</p>
        <strong>{sample.caseFile.nickname}</strong>
        <Link href={`/demo?case=${encodeURIComponent(sample.investigation.id)}`} className="inline-flex min-h-11 items-center gap-1 text-xs underline underline-offset-4" data-testid="link-landing-selected-sample">Explore sample file <ArrowUpRight size={13} /></Link>
      </div>
      <button type="button" className="wa-dial-button" onClick={() => setIndex((index + 1) % demoSamples.length)} aria-label="Next sample photo" data-testid="button-next-landing-sample"><ArrowRight size={18} /></button>
    </div>
  </div>;
}
