import { Check, Minus } from 'lucide-react';
import type { PipelineSummary } from '@/lib/result-insights';

export function PipelineBar({ summary, targetId }: { summary: PipelineSummary; targetId: string }) {
  const done = summary.stages.filter((s) => s.complete).length;
  const go = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  return <button type="button" className="rp-pipeline" onClick={go} aria-label={`AI pipeline: ${done} of ${summary.stages.length} stages show evidence in this result. Open the full AI decision trail.`} data-testid="button-pipeline-bar">
    <span className="rp-pipeline-label">AI pipeline</span>
    <ol className="rp-pipeline-stages">{summary.stages.map((s, i) => <li key={s.name} className={s.complete ? 'is-done' : 'is-missing'} title={s.evidence} data-testid={`status-pipeline-stage-${i}`}>
      <span className="rp-pipeline-mark" aria-hidden="true">{s.complete ? <Check size={10} strokeWidth={3.2} /> : <Minus size={10} strokeWidth={3} />}</span>{s.name}<span className="sr-only">{s.complete ? ' complete' : ' no evidence in response'}</span>
    </li>)}</ol>
    <span className="rp-pipeline-meta">
      {summary.model && <span data-testid="text-pipeline-model">Model {summary.model}</span>}
      {summary.durationLabel && <span data-testid="text-pipeline-duration">{summary.durationLabel}</span>}
      {!summary.model && summary.sourceLabel && <span data-testid="text-pipeline-source">Source {summary.sourceLabel}</span>}
      <span className="rp-pipeline-link">Decision trail</span>
    </span>
  </button>;
}
