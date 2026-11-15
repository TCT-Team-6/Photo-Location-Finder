/** Cancel before any user edit. No state/cache/network coupling. */
export function createPromptTypewriter(write:(value:string)=>void,schedule=(fn:()=>void)=>setTimeout(fn,15),cancel=(id:ReturnType<typeof setTimeout>)=>clearTimeout(id)){
  let timer:ReturnType<typeof setTimeout>|undefined,generation=0;
  const stop=()=>{generation++;if(timer!==undefined)cancel(timer);timer=undefined;};
  return {stop,start(text:string,reduced=false){stop();if(reduced){write(text);return;}let length=0;const own=generation;write('');const step=()=>{if(own!==generation)return;write(text.slice(0,++length));if(length<text.length)timer=schedule(step);};timer=schedule(step);}};
}
