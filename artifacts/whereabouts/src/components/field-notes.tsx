import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowRight, Camera, Compass, Crosshair, FileSearch, Fingerprint, Layers3, MapPinned, ScanLine, ShieldCheck, Signpost, Sun, Trees } from 'lucide-react';
import { Link } from 'wouter';
import { pipelineSteps } from '@/components/analysis-progress-model';

/** Editorial explanations only. No provider calls or simulated live findings. */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

const methods = [
  { title: 'Read the built environment', label: 'Signs & structures', icon: Signpost, companion: MapPinned, body: 'A language on a sign, the shape of a roof, a road marking. Individual details rarely settle a location; several consistent details can narrow the places worth checking.', look: 'Lettering, street furniture, road layouts, building materials.', check: 'Compare a candidate with independent maps and current street-level imagery.', caution: 'A familiar-looking building is not a unique landmark.' },
  { title: 'Look beyond the foreground', label: 'Terrain & landscape', icon: Trees, companion: Compass, body: 'The outline of a ridge, a coastline, or the relationship between a road and the horizon can provide more useful context than the subject of the photograph.', look: 'Landforms, vegetation, water edges, the relative position of features.', check: 'Compare the whole scene, not just one matching tree or mountain.', caution: 'Similar landscapes exist in many regions. Vegetation alone cannot establish a place.' },
  { title: 'Keep time in perspective', label: 'Light & context', icon: Sun, companion: Camera, body: 'Shadows and weather can help a reviewer test a hypothesis. They are contextual observations, not a reliable clock or a stand-alone coordinate finder.', look: 'Visible shadows, seasonal cues, and dates you can independently verify.', check: 'Check the original file date when present. Keep an absent date unknown.', caution: 'EXIF can be missing or edited. Light does not prove when or where a photo was taken.' },
  { title: 'Separate file facts from inference', label: 'Metadata & unknowns', icon: Fingerprint, companion: FileSearch, body: 'A file can contain a date, or it can contain very little. Whereabouts reads the photo date when present; it does not invent missing metadata or decrypt hidden evidence.', look: 'Original files, known sources, and a clear distinction between reported and inferred facts.', check: 'Keep your notes with the record. They are context, not input to the location finder.', caution: 'The sample inspection above is an illustration, not metadata extracted from that image.' },
];

const stages = [
  { tool: 'Private storage', title: 'Start with the source.', body: 'Choose your desk and upload a photo you are authorized to use. Each image becomes a separate investigation; video is available only when the provider supports it.', boundary: 'Uploading is storage, not an AI finding. Keep the original file and its source so you can revisit them.' },
  { tool: 'Scene analysis provider', title: 'Observe before concluding.', body: 'For location desks, Image Locator receives the image and returns scene clues and possible places. Journalism uses OpenAI vision to review visible image-integrity signals.', boundary: 'Image Locator does not disclose its internal models. OpenAI’s exact model is server-configurable; there is no claimed universal model behind every desk.' },
  { tool: 'Provider-generated clues', title: 'Look for agreement.', body: 'Review how visible features might support a possible place. Scene-clue comparisons come from the provider response; independent corroboration remains your task.', boundary: 'This is not an automatic search of every map, website, or camera. Similarity is a lead, not verification.' },
  { tool: 'Provider scores + server', title: 'Order the possibilities.', body: 'For location analysis, the provider supplies candidates and scores. The server orders returned scores for review; a top-ranked candidate is not a confirmed location.', boundary: 'Scores are not independently verified probabilities. Journalism findings concern the image, not a guaranteed location.' },
  { tool: 'PostgreSQL / private record', title: 'Leave a reviewable trail.', body: 'The report is saved to your selected desk. Revisit the image, compare the returned findings, and keep your own context alongside the result.', boundary: 'Your shared name, notes, and date stay record context, not locator prompts. A saved report does not turn an estimate into evidence of certainty.' },
];

function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number, length: number, select: (index: number) => void, refs: Array<HTMLButtonElement | null>) {
  let next = index;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % length;
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + length - 1) % length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = length - 1;
  else return;
  event.preventDefault();
  select(next);
  refs[next]?.focus();
}

export function GeolocationMethods() {
  const [selected, setSelected] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const method = methods[selected];
  const Icon = method.icon;
  const Companion = method.companion;
  return <section className="wa-methods" id="methods" aria-labelledby="methods-heading"><Reveal className="wa-section-inner">
    <div className="wa-section-heading"><div><p className="wa-eyebrow">Field notes / 01 — The method</p><h2 id="methods-heading">A scene is a set<br />of relationships.</h2></div><p>Visual geolocation starts with observation, then comparison. These are useful ways to examine an image—not a claim that every method is available from the provider, or that any one clue can prove a location.</p></div>
    <div className="wa-method-grid">
      <div className="wa-method-selector" role="tablist" aria-label="Geolocation field methods" aria-orientation="vertical">{methods.map((item, index) => <button key={item.label} ref={(node) => { refs.current[index] = node; }} type="button" role="tab" id={`method-tab-${index}`} aria-selected={selected === index} aria-controls="method-panel" tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => tabKeys(event, index, methods.length, setSelected, refs.current)} className="wa-method-tab" data-testid={`button-method-${index}`}><span>0{index + 1}</span><span>{item.label}</span><ArrowRight size={17} /></button>)}</div>
      <div role="tabpanel" id="method-panel" aria-labelledby={`method-tab-${selected}`} tabIndex={0} className="wa-method-panel" data-testid="panel-geolocation-method"><div className="wa-method-diagram" aria-hidden="true"><Icon /><span /><Crosshair /><span /><Companion /></div><p className="wa-eyebrow">Observation → comparison → review</p><h3>{method.title}</h3><p>{method.body}</p><dl><div><dt>Look for</dt><dd>{method.look}</dd></div><div><dt>Cross-check</dt><dd>{method.check}</dd></div></dl><p className="wa-method-caution">{method.caution}</p></div>
    </div>
  </Reveal></section>;
}

export function FiveStagePipeline() {
  const [selected, setSelected] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const stage = stages[selected];
  return <section className="wa-pipeline" id="pipeline" aria-labelledby="pipeline-heading"><Reveal className="wa-section-inner">
    <div className="wa-section-heading"><div><p className="wa-eyebrow">Field notes / 02 — The five-stage pipeline</p><h2 id="pipeline-heading">From pixels.<br />To possibilities.</h2></div><p>Understand what happens between choosing a file and reviewing a report. Select a stage to see its role—and what it cannot tell you.</p></div>
    <div className="wa-pipeline-tabs" role="tablist" aria-label="Five-stage conceptual analysis pipeline">{pipelineSteps.map((step, index) => <button type="button" key={step.id} ref={(node) => { refs.current[index] = node; }} role="tab" id={`pipeline-tab-${index}`} aria-controls="pipeline-panel" aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={(event) => tabKeys(event, index, stages.length, setSelected, refs.current)} className="wa-pipeline-tab" data-testid={`button-pipeline-${step.id}`}><span>0{index + 1} / 05</span><strong>{step.label}</strong><small>{stages[index].tool}</small></button>)}</div>
    <div className="wa-pipeline-detail" id="pipeline-panel" role="tabpanel" tabIndex={0} aria-labelledby={`pipeline-tab-${selected}`} data-testid="panel-pipeline-stage"><span className="wa-pipeline-number" aria-hidden="true">0{selected + 1}</span><div><h3>{stage.title}</h3><p>{stage.body}</p></div><aside><span>The boundary</span><p>{stage.boundary}</p></aside></div>
    <p className="wa-pipeline-disclaimer">PROCESS EXPLAINER, NOT LIVE TELEMETRY. These five stages describe the conceptual workflow. The provider does not report completion of each internal step. Optional OpenAI vision fallback depends on server configuration.</p>
  </Reveal></section>;
}

export function TechnologyNotes() {
  return <section className="wa-stack" id="technology" aria-labelledby="technology-heading"><Reveal className="wa-section-inner wa-stack-grid"><div className="wa-stack-intro"><p className="wa-eyebrow">Field notes / 03 — Under the cover</p><h2 id="technology-heading">Know your<br />instrument.</h2><p>A useful tool should explain its construction as clearly as its limitations. Here is the application stack and the boundary between this workspace and external analysis.</p></div><div>
    <div className="wa-stack-row"><span>Interface</span><div><h3>React + TypeScript</h3><p>Vite builds the frontend. Tailwind styles the workspace; Framer Motion handles restrained interface transitions. Reduced-motion preferences are respected.</p></div></div>
    <div className="wa-stack-row"><span>Application</span><div><h3>Node.js / Express</h3><p>The TypeScript server coordinates authenticated requests and report records. PostgreSQL stores application data through Drizzle; Clerk handles authentication.</p></div></div>
    <div className="wa-stack-row"><span>Hosting</span><div><h3>Replit + a configurable locator endpoint</h3><p>This app runs on Replit. The default external Image Locator endpoint is hosted on Render, but can be configured otherwise. This is not a statement about a verified production deployment.</p></div></div>
    <div className="wa-stack-row"><span>Analysis</span><div><h3>External providers. Explicit limits.</h3><p>Image Locator’s internal models and implementation languages are undisclosed. OpenAI vision supports journalism and optional fallback; the exact model is configurable. Video capability depends on provider availability.</p></div></div>
  </div></Reveal></section>;
}

export function IntakeFieldGuide() {
  return <aside className="wa-intake-guidance" aria-labelledby="intake-guide-heading"><div className="wa-intake-guidance-heading"><h2 id="intake-guide-heading">Before you investigate.</h2><span>FIELD CHECKLIST / 01—04</span></div><div className="wa-intake-guide-grid">
    <article><Camera /><h3>Keep the whole frame.</h3><p>Use the clearest authorized source file you have. Roads, signs, horizons, and surrounding buildings can be more useful than the main subject. Keep the original unchanged.</p></article>
    <article><Layers3 /><h3>Choose the right desk.</h3><p>Investigations and Recreation explore possible places. Journalism reviews visible image-integrity signals. Each image is processed separately, not combined into one location estimate.</p></article>
    <article><ScanLine /><h3>Unknown is a valid answer.</h3><p>A photo date is read when present; missing metadata stays unknown. Your notes help you review the saved record, but are not sent to the location finder.</p></article>
    <article><ShieldCheck /><h3>Review before acting.</h3><p>A candidate location is a lead, not proof. Compare it with independent sources. Private cases are separate: no automatic analysis, face matching, crawling, or person-location search.</p></article>
  </div><div className="wa-intake-guide-footer"><p>Five-stage model: Upload photo → Read scene → Compare clues → Rank findings → Save report. This explains the workflow; it is not live provider telemetry.</p><Link href="/demo" data-testid="link-intake-example-report">See a sample report <ArrowRight size={14} /></Link></div></aside>;
}
