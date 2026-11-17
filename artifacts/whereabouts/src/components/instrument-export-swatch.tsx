import {useState} from 'react';
import {SwatchBook} from './physical-controls';

/** Public, local-only verification surface. No investigation/case APIs are called. */
export default function InstrumentExportSwatch(){
  const[selected,setSelected]=useState(document.documentElement.dataset.appTheme??'rescue');
  return <SwatchBook selected={selected} themes={[
    {id:'rescue',label:'Instrument',colors:['#f4f4f2','#242723','#b6382e']},
    {id:'field',label:'Field notebook',colors:['#e4eadc','#27352d','#a23e34']},
    {id:'ocean',label:'Coastal graphite',colors:['#e0e8ee','#293039','#9f3e39']},
    {id:'sunset',label:'Warm graphite',colors:['#efe2d7','#352c28','#aa3b30']},
    {id:'mono',label:'Monochrome',colors:['#e6e6e6','#171917','#a1322b']},
  ]} onSelect={id=>{setSelected(id);document.documentElement.dataset.appTheme=id;const app=document.querySelector<HTMLElement>('#root>[data-app-theme]');if(app)app.dataset.appTheme=id;}}/>;
}
