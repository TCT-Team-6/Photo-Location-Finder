import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {activateInstrumentButton,SWATCH_CLOSE_MS,SWATCH_SELECTED_RETURN_MS,SWATCH_SELECTION_MS,SWATCH_THEME_FADE_MS} from './instrument-interaction';
import {feedbackSpring} from './lens-feedback';
import {crossfadeInstrumentTheme} from './instrument-theme-transition';
import {OperatorAvatar} from '../components/operator-avatar';

test('Enter and Space activate the native switch button once, not again on repeat or keyup',()=>{
  for(const key of['Enter',' ','Spacebar','Space']){
    let clicks=0,prevented=0,stopped=0;
    const event={key,repeat:false,currentTarget:{click:()=>{clicks++;}},preventDefault:()=>{prevented++;},stopPropagation:()=>{stopped++;}};
    assert.equal(activateInstrumentButton(event,'down'),true);assert.equal(clicks,1);
    activateInstrumentButton({...event,repeat:true},'down');activateInstrumentButton(event,'up');
    assert.equal(clicks,1);assert.equal(prevented,3);assert.equal(stopped,3);
  }
  assert.equal(activateInstrumentButton({key:'Tab',currentTarget:{click:()=>assert.fail('Tab cannot toggle')},preventDefault:()=>assert.fail(),stopPropagation:()=>assert.fail()},'down'),false);
});
test('swatch selection has a 450ms wall-clock deadline and a separate 300ms fade',()=>{
  assert.equal(SWATCH_SELECTED_RETURN_MS+SWATCH_CLOSE_MS,450);
  assert.equal(SWATCH_SELECTION_MS,450);assert.equal(SWATCH_THEME_FADE_MS,300);
  const controls=readFileSync(new URL('../components/physical-controls.tsx',import.meta.url),'utf8');
  assert.match(controls,/setTimeout\(\(\)=>finishRef\.current\(\),SWATCH_SELECTION_MS\)/);
  const springs=readFileSync(new URL('../components/instrument-meshes.tsx',import.meta.url),'utf8');
  assert.match(springs,/performance\.now\(\)>=deadline\.current/);
  assert.doesNotMatch(springs,/Math\.min\(\.016,delta\)/);
});
test('closing spring tracks elapsed time equally at 8fps and 60fps, including the last staggered strip',()=>{
  const advance=(fps:number)=>{let state={position:44*Math.PI/180,velocity:0};for(let i=0;i<fps/2;i++)state=feedbackSpring(state,0,1/fps,1800,76);return state.position;};
  assert.ok(Math.abs(advance(8)-advance(60))<1e-10);
  const last=feedbackSpring({position:44*Math.PI/180,velocity:0},0,(SWATCH_CLOSE_MS-120)/1000,1800,76);
  assert.ok(Math.abs(last.position)<.001);
});
test('intake width is viewport-constrained, with fixed grid tracks and stable root scrollbar space',()=>{
  const css=readFileSync(new URL('../styles/physical-desk.css',import.meta.url),'utf8');
  assert.match(css,/html\{scrollbar-gutter:stable\}/);
  assert.match(css,/\.wa-workspace \.wa-intake\{width:100%;max-width:1120px/);
  assert.match(css,/grid-template-columns:320px minmax\(0,1fr\)/);
  assert.match(css,/\.fd-source-desk>\.physical-dial\{grid-column:1;grid-row:1;justify-self:start;margin:0\}/);
  assert.match(css,/\.fd-source-desk>\.fd-desk-page\{grid-column:1;grid-row:2\}/);
});
test('avatar initial has a dedicated visible paper-color rule, not sidebar-inherited ink',()=>{
  const markup=renderToStaticMarkup(createElement(OperatorAvatar,{accountId:'operator-test',imageUrl:null,name:'Gregory'}));
  assert.match(markup,/class="instrument-avatar-initial"[^>]*>G<\/span>/);
  assert.doesNotMatch(markup,/<img/);
  const css=readFileSync(new URL('../styles/physical-desk.css',import.meta.url),'utf8');
  const rule=css.match(/\.instrument-avatar>\.instrument-avatar-initial\{([^}]+)\}/)?.[1]??'';
  assert.match(rule,/color:var\(--paper\)!important/);
  assert.match(rule,/font:500 14px\/1 var\(--app-font-mono\)!important/);
  assert.match(rule,/opacity:1!important/);assert.match(rule,/visibility:visible!important/);
});
test('theme commits immediately without an expensive native WebGL snapshot',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
  let applied=0,skipped=0,fadeDuration=0,callback=()=>{};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{
    documentElement:{style:{setProperty:()=>{}}},
    querySelector:()=>({animate:(_frames:unknown,options:{duration:number})=>{fadeDuration=options.duration;}}),
    startViewTransition:(update:()=>void)=>{callback=update;return{finished:new Promise<void>(()=>{}),skipTransition:()=>{skipped++;}};},
  }});
  try{
    crossfadeInstrumentTheme(()=>{applied++;},300);
    assert.equal(applied,1);assert.equal(skipped,0);assert.equal(fadeDuration,300);
    callback();assert.equal(applied,1);
  }finally{if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');}
});
