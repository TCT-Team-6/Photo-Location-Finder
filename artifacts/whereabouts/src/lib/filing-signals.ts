const filingKeys=new Set(['createInvestigation','createMissingPersonCase','createCaseLead']);
/** A successful signed upload URL is not a filed record. Require a real creation acknowledgement. */
export function isFilingAcknowledged(key:readonly unknown[]|undefined,data:unknown){
  if(key?.[0]==='createInvestigation'&&data&&typeof data==='object'&&'status'in data&&(data.status==='analyzing'||data.status==='failed'))return false;
  return key?.length===1&&filingKeys.has(String(key[0]))&&typeof data==='object'&&data!==null&&'id' in data&&typeof data.id==='string'&&data.id.length>0;
}
