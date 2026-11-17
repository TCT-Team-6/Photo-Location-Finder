export function safeRequestDetail(error:unknown){
  if(!error||typeof error!=='object')return{kind:'Unknown error',status:'No HTTP status available',endpoint:'GET /api/investigations',detail:'The browser did not provide additional error information.'};
  const e=error as {name?:unknown;status?:unknown;statusText?:unknown;message?:unknown;headers?:unknown;url?:unknown;method?:unknown};
  const status=typeof e.status==='number'&&Number.isFinite(e.status)?e.status:undefined;
  let path='/api/investigations';try{if(typeof e.url==='string')path=new URL(e.url,'https://local.invalid').pathname;}catch{/* No query values or raw URLs are displayed. */}
  // Never show response bodies, authorization headers, query strings, API keys,
  // user content, or untrusted server messages in a diagnostic panel.
  const kind=typeof e.name==='string'?e.name.replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,60):'Error';
  const contentType=e.headers instanceof Headers?e.headers.get('content-type')?.split(';')[0]?.slice(0,80):undefined;
  const knownClientMessages=['Failed to fetch','Load failed','NetworkError when attempting to fetch resource.','customFetch: GET requests cannot have a body.'];
  const actualClientMessage=typeof e.message==='string'&&knownClientMessages.includes(e.message)?`${e.message} `:'';
  const detail=actualClientMessage+(kind==='ResponseParseError'?'The server replied, but the response was not valid JSON.':kind==='TypeError'?'The browser could not complete this request. Check connectivity, browser restrictions, or the request adapter.':status===401||status===403?'The server rejected authorization. Your local files are unchanged.':status&&status>=500?'The server reported an error. Retry keeps the existing records and files.':status===304?'The request adapter received HTTP 304 without a usable cached JSON body.':'The request failed. No server response body or private content is exposed here.');
  return{kind,status:status===undefined?'No HTTP response status':`HTTP ${status}${typeof e.statusText==='string'?` ${e.statusText.replace(/[^a-zA-Z0-9 -]/g,'').slice(0,40)}`:''}`,endpoint:`${typeof e.method==='string'&&/^(GET|POST|PUT|PATCH|DELETE|HEAD)$/.test(e.method)?e.method:'GET'} ${path.replace(/[^a-zA-Z0-9/_-]/g,'').slice(0,120)}`,detail,contentType};
}
export function safeRuntimeIssue(error:Error){
  const missing=error.message.match(/\b[A-Za-z_$][\w$]{0,60} is not defined\b/);
  if(missing)return missing[0];
  const call=error.message.match(/\b(?:[A-Za-z_$][\w$]{0,40}\.){0,4}[A-Za-z_$][\w$]{0,40} is not a function\b/);
  if(call)return call[0];
  if(error.message.startsWith('Cannot read properties of'))return'An expected value was missing while rendering this desk.';
  return'Additional runtime details are available in the browser console. No private response content is shown here.';
}
