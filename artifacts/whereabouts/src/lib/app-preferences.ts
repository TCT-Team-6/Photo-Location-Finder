export type AppPreferences={
  theme:'rescue'|'field'|'ocean'|'sunset'|'mono';
  highContrast:boolean;
  font:'default'|'sans'|'dyslexic';
  textSize:number;
};
export const PREFERENCES_KEY='whereabouts-preferences';
export const defaultPreferences:AppPreferences={theme:'rescue',highContrast:false,font:'default',textSize:100};
export const TEXT_SIZE_MIN=100,TEXT_SIZE_MAX=150,TEXT_SIZE_STEP=5;
/** Storage accepts actual finite numbers only, not numeric strings or coercible objects. */
export function validTextSize(value:unknown):number{
  return typeof value==='number'&&Number.isFinite(value)&&value>=TEXT_SIZE_MIN&&value<=TEXT_SIZE_MAX&&value%TEXT_SIZE_STEP===0?value:TEXT_SIZE_MIN;
}
export function normalizePreferences(value:unknown):AppPreferences{
  const stored=typeof value==='object'&&value!==null&&!Array.isArray(value)?value as Record<string,unknown>:{};
  return{
    theme:['rescue','field','ocean','sunset','mono'].includes(stored.theme as string)?stored.theme as AppPreferences['theme']:defaultPreferences.theme,
    font:['default','sans','dyslexic'].includes(stored.font as string)?stored.font as AppPreferences['font']:defaultPreferences.font,
    highContrast:typeof stored.highContrast==='boolean'?stored.highContrast:defaultPreferences.highContrast,
    textSize:validTextSize(stored.textSize),
  };
}
export function readPreferences(storage:Pick<Storage,'getItem'>):AppPreferences{
  try{return normalizePreferences(JSON.parse(storage.getItem(PREFERENCES_KEY)??'null'));}catch{return{...defaultPreferences};}
}
export function writePreferences(storage:Pick<Storage,'setItem'>,preferences:AppPreferences):boolean{
  try{storage.setItem(PREFERENCES_KEY,JSON.stringify(normalizePreferences(preferences)));return true;}catch{return false;}
}
export function snapTextSize(value:number):number{
  return Number.isFinite(value)?Math.max(TEXT_SIZE_MIN,Math.min(TEXT_SIZE_MAX,Math.round(value/TEXT_SIZE_STEP)*TEXT_SIZE_STEP)):TEXT_SIZE_MIN;
}
export function textSizeKey(value:number,key:string):number|null{
  if(key==='Home')return TEXT_SIZE_MIN;
  if(key==='End')return TEXT_SIZE_MAX;
  if(key==='ArrowRight'||key==='ArrowUp')return snapTextSize(value+TEXT_SIZE_STEP);
  if(key==='ArrowLeft'||key==='ArrowDown')return snapTextSize(value-TEXT_SIZE_STEP);
  return null;
}
