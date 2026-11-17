import type { Investigation } from '@workspace/api-client-react';
export class SavedAnalysisFailure extends Error{
  constructor(public readonly recordId:string,message:string){super(message);this.name='SavedAnalysisFailure';}
}
export async function awaitCompletedReport(id: string, deps: {
  get: (id: string) => Promise<Investigation>;
  stopped: () => boolean;
  wait?: () => Promise<void>;
}): Promise<Investigation> {
  while (!deps.stopped()) {
    const record = await deps.get(id);
    if (record.status === 'done') return record;
    if (record.status === 'failed') throw new SavedAnalysisFailure(id,record.analysisError || 'The saved analysis failed. Retry uses this same record.');
    await (deps.wait?.() ?? new Promise(resolve => setTimeout(resolve, 5000)));
  }
  throw new DOMException('Browser queue stopped. Accepted server analysis may continue.', 'AbortError');
}
