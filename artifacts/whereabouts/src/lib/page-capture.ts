import html2canvas from 'html2canvas';
/** Viewport-only, local memory. Never uploaded, exported or persisted. */
export function createPageCapture(changed:(canvas:HTMLCanvasElement)=>void,status:(state:string)=>void,maxEdge=16384){
  let disposed=false,busy=false,again=false,timer:ReturnType<typeof setTimeout>|undefined;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
  const capture=async()=>{
    if(disposed||document.hidden)return;if(busy){again=true;return;}busy=true;status('capturing');
    try{
      await document.fonts.ready;
      if(disposed)return;
      const shot=await html2canvas(document.body,{x:scrollX,y:scrollY,width:innerWidth,height:innerHeight,windowWidth:innerWidth,windowHeight:innerHeight,scrollX,scrollY,scale:Math.min(devicePixelRatio||1,maxEdge/Math.max(innerWidth,innerHeight)),backgroundColor:'#f4f4f2',logging:false,useCORS:true,allowTaint:false,
        ignoreElements:element=>element.matches('.wa-loupe-overlay,.wa-loupe-hit-target,.wa-site-cursor-dot,.wa-site-cursor-ring,[data-capture-ignore]')});
      if(!disposed){canvas.width=shot.width;canvas.height=shot.height;canvas.getContext('2d')?.drawImage(shot,0,0);changed(canvas);status('ready');}
      shot.width=shot.height=1;
    }catch{if(!disposed)status('failed');}
    finally{busy=false;if(again&&!disposed){again=false;schedule();}}
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{void capture();},220);};
  const visibility=()=>{if(!document.hidden)schedule();};
  // Observe only the header, never html2canvas's temporary body iframe or live counters.
  const header=document.querySelector('header'),headerObserver=new MutationObserver(schedule);if(header)headerObserver.observe(header,{subtree:true,childList:true,characterData:true});
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('load',schedule);document.addEventListener('visibilitychange',visibility);schedule();
  return{canvas,refresh:schedule,dispose(){disposed=true;clearTimeout(timer);headerObserver.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule);window.removeEventListener('load',schedule);document.removeEventListener('visibilitychange',visibility);canvas.width=canvas.height=1;}};
}
