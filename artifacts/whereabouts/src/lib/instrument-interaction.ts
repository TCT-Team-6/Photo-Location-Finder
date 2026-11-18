export const SWATCH_SELECTION_MS=450;
export const SWATCH_SELECTED_RETURN_MS=190;
export const SWATCH_CLOSE_MS=SWATCH_SELECTION_MS-SWATCH_SELECTED_RETURN_MS;
export const SWATCH_THEME_FADE_MS=300;
type NativeButtonKey={
  key:string;code?:string;repeat?:boolean;
  currentTarget:{click:()=>void};
  preventDefault:()=>void;stopPropagation:()=>void;
};
/** Use the native button's existing click path exactly once. Cancel the
 * browser's delayed Space click so it cannot toggle back on keyup. */
export function activateInstrumentButton(event:NativeButtonKey,phase:'down'|'up'){
  if(!['Enter',' ','Spacebar','Space'].includes(event.key)&&event.code!=='Space')return false;
  event.preventDefault();event.stopPropagation();
  if(phase==='down'&&!event.repeat)event.currentTarget.click();
  return true;
}
