import {flushSync} from 'react-dom';
/** Theme fading is the one intentional opacity transition, never fake 3D motion. */
export function crossfadeInstrumentTheme(update:()=>void,duration:number){
  document.documentElement.style.setProperty('--instrument-theme-fade',`${duration}ms`);
  const fade=()=>document.querySelector<HTMLElement>('#root>div')?.animate([{opacity:.5},{opacity:1}],{duration,easing:'ease-out'});
  // Native view-transition snapshots synchronously stall software WebGL.
  // Commit immediately; the compositor-only fade never holds the selection.
  flushSync(update);fade();
}
