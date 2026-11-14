import { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { demoSamples } from '@/lib/demo-samples';

const inspections = [
  { label: 'Scene clues', title: 'Observe the surroundings.', text: 'ILLUSTRATIVE · Signs, terrain, and structures are places to begin a visual review—not confirmed matches.', x: 32, y: 43, binary: '01010011 01000011 01000101 01001110 01000101' },
  { label: 'File context', title: 'Missing stays unknown.', text: 'SAMPLE METADATA · Date taken: unknown. No EXIF was read for this display. No hidden data is being decrypted.', x: 58, y: 37, binary: '01000110 01001001 01001100 01000101 00111111' },
  { label: 'Cross-check', title: 'A clue is not a conclusion.', text: 'ILLUSTRATIVE · Compare several independent details before treating a suggested place as a useful lead.', x: 63, y: 62, binary: '01000011 01001000 01000101 01000011 01001011' },
];

/** Manually operated teaching illustration; never analyzes the selected sample. */
export function PhotoInstrument() {
  const [index, setIndex] = useState(0);
  const [focus, setFocus] = useState(0);
  const [revision, setRevision] = useState(0);
  const [broken, setBroken] = useState(false);
  const sample = demoSamples[index];
  const inspection = inspections[focus];
  const inspect = (next: number) => { setFocus(next); setRevision((value) => value + 1); };
  const changeSample = (next: number) => { setIndex(next); setBroken(false); setRevision((value) => value + 1); };
  return <div className="wa-instrument wa-loupe-instrument" data-testid="panel-photo-instrument">
    <div className="wa-instrument-header"><span>Visual inspection / sample bench</span><span>W—01 / MANUAL</span></div>
    <div className="wa-scene-ruler" aria-hidden="true"><span>00</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span></div>
    <div className="wa-scene-stage">
      {!broken ? <img key={sample.imageUrl} src={sample.imageUrl} alt={`Fictional sample scene: ${sample.investigation.title}`} onError={() => setBroken(true)} data-testid="img-landing-sample" /> : <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"><p className="text-sm">Sample image could not load.</p><button type="button" className="underline underline-offset-4" onClick={() => setBroken(false)} data-testid="button-retry-landing-image">Retry image</button></div>}
      <span className="wa-scene-label">SAMPLE / NOT LIVE EVIDENCE</span>
      {!broken && <><div className="wa-loupe-position" aria-hidden="true" style={{ transform: `translate(${inspection.x}%, ${inspection.y}%)` }}><div className="wa-loupe"><div className="wa-loupe-glass" style={{ backgroundImage: `url("${sample.imageUrl}")`, backgroundPosition: `${inspection.x}% ${inspection.y}%` }}><span className="wa-loupe-cross" /></div></div></div>{inspections.map((item, i) => <button type="button" key={item.label} aria-label={`Inspect illustrative ${item.label.toLowerCase()}`} aria-pressed={focus === i} onClick={() => inspect(i)} className="wa-scene-hotspot" style={{ left: `${item.x}%`, top: `${item.y}%` }} data-testid={`button-inspect-scene-${i}`}>0{i + 1}</button>)}</>}
    </div>
    <div className="wa-clue-selector" role="group" aria-label="Illustrative inspection modes">{inspections.map((item, i) => <button type="button" key={item.label} aria-pressed={focus === i} onClick={() => inspect(i)} data-testid={`button-inspection-mode-${i}`}>{item.label}</button>)}</div>
    <div className="wa-clue-readout" aria-live="polite" aria-atomic="true" data-testid="status-illustrative-clue"><span>Illustrative readout / 0{focus + 1}</span><strong>{inspection.title}</strong><p>{inspection.text}</p><div key={revision} className="wa-binary" aria-hidden="true">{inspection.binary}<br />00110000 00110001 00110000 00110001<br />SAMPLE DISPLAY → REVIEW THE CLUE</div></div>
    <div className="wa-instrument-controls">
      <button type="button" className="wa-dial-button" onClick={() => changeSample((index + demoSamples.length - 1) % demoSamples.length)} aria-label="Previous sample photo" data-testid="button-previous-landing-sample"><ArrowLeft size={18} /></button>
      <div className="wa-instrument-info" aria-live="polite"><p>FRAME {String(index + 1).padStart(2, '0')} / {String(demoSamples.length).padStart(2, '0')}</p><strong>{sample.caseFile.nickname}</strong><Link href={`/demo?case=${encodeURIComponent(sample.investigation.id)}`} className="inline-flex min-h-11 items-center gap-1 text-xs underline underline-offset-4" data-testid="link-landing-selected-sample">Explore sample file <ArrowUpRight size={13} /></Link></div>
      <button type="button" className="wa-dial-button" onClick={() => changeSample((index + 1) % demoSamples.length)} aria-label="Next sample photo" data-testid="button-next-landing-sample"><ArrowRight size={18} /></button>
    </div>
    <p className="wa-instrument-note">Select a marker or inspection mode. The binary reveal is a visual metaphor, not real decryption or extracted findings.</p>
  </div>;
}
