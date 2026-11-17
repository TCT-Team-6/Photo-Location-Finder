export type ReportPhase = 'idle' | 'uploading' | 'analyzing' | 'completed' | 'error' | 'stopped';
export type ReportEvent = { at: number; message: string };
export type ReportState = {
  phase: ReportPhase; open: boolean; title: string; startedAt: number;
  index: number; total: number; file: File | null; error: string; destination: string;
  events: ReportEvent[]; accepted: boolean;
  errorStage:number;
  settling:boolean;
};
export const emptyReport: ReportState = { phase: 'idle', open: false, title: '', startedAt: 0, index: 0, total: 0, file: null, error: '', destination: '', events: [], accepted: false,errorStage:0,settling:false };
export function realStageStates(phase: ReportPhase): ('waiting' | 'running' | 'done' | 'error')[] {
  if (phase === 'completed') return ['done', 'done', 'done', 'done', 'done'];
  if (phase === 'uploading') return ['running', 'waiting', 'waiting', 'waiting', 'waiting'];
  // The API does not expose compare/rank/save substages. Never advance them by clock.
  if (phase === 'analyzing') return ['done', 'running', 'waiting', 'waiting', 'waiting'];
  return ['waiting', 'waiting', 'waiting', 'waiting', 'waiting'];
}
export function pendingQueue<T extends { status: string }>(items: T[]) {
  return items.filter(item => item.status !== 'saved');
}
export function mayStartNext(stopped: boolean, signal: AbortSignal) { return !stopped && !signal.aborted; }
