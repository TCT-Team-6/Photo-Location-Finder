import {flushSync} from 'react-dom';
/** Theme fading is the one intentional opacity transition, never fake 3D motion. */
export function crossfadeInstrumentTheme(update:()=>void,duration:number){
  document.documentElement.style.setProperty('--instrument-theme-fade',`${duration}ms`);
  const documentWithTransitions=document as Document&{startViewTransition?:(callback:()=>void)=>{finished:Promise<void>}};
  if(documentWithTransitions.startViewTransition){
    const transition=documentWithTransitions.startViewTransition(()=>flushSync(update));
    void transition.finished.catch(()=>{/* An interrupted navigation still leaves the selected real theme applied. */});
  }else{
    flushSync(update);document.querySelector<HTMLElement>('#root>div')?.animate([{opacity:.5},{opacity:1}],{duration,easing:'ease-out'});
  }
}
