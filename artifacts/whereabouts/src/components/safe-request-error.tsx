import {safeRequestDetail} from '@/lib/safe-request-detail';
export function SafeRequestError({error}:{error:unknown}){
  const detail=safeRequestDetail(error);
  return <details className="mt-4 text-xs" data-testid="library-request-detail"><summary className="cursor-pointer font-data text-[10px]">Request details / safe diagnostics</summary><dl className="mt-3 grid gap-2 font-data text-[10px]"><div><dt className="sr-only">Request</dt><dd>{detail.endpoint}</dd></div><div><dt className="sr-only">Status</dt><dd>{detail.status}</dd></div><div><dt className="sr-only">Error type</dt><dd>{detail.kind}{detail.contentType?` · ${detail.contentType}`:''}</dd></div></dl><p className="mt-3 max-w-xl leading-6">{detail.detail}</p></details>;
}
