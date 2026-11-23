import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {installTextScaling,isScalableTextElement,scaledTypography,textStyleSignature} from './text-scaling';

test('actual computed px labels, rem-derived headings and fixed line heights scale once',()=>{
  assert.deepEqual(scaledTypography('9px','12px',150),{base:'9px',lineHeight:'18px'});
  assert.deepEqual(scaledTypography('48px','48px',125),{base:'48px',lineHeight:'60px'});
  assert.deepEqual(scaledTypography('12.5px','normal',120),{base:'12.5px',lineHeight:'normal'});
  assert.deepEqual(scaledTypography('14px','20px',Infinity),{base:'14px',lineHeight:'20px'});
});
class FakeStyle{
  values=new Map<string,string>();
  setProperty(key:string,value:string){this.values.set(key,value);}
  removeProperty(key:string){this.values.delete(key);}
  getPropertyValue(key:string){return this.values.get(key)??'';}
}
class FakeElement{
  namespaceURI='http://www.w3.org/1999/xhtml';style=new FakeStyle();dataset:Record<string,string>={};attributes=new Set<string>();isConnected=true;excluded=false;textContent='';
  constructor(public tagName:string,public fontSize='14px',public lineHeight='20px'){}
  closest(selector:string){return this.excluded&&selector==='[data-text-scale-exempt]'?this:null;}
  setAttribute(key:string){this.attributes.add(key);}
  removeAttribute(key:string){this.attributes.delete(key);}
}
test('only HTML typography is eligible; canvas, SVG and authored exclusions are not zoomed',()=>{
  const paragraph=new FakeElement('P');
  assert.equal(isScalableTextElement(paragraph as unknown as Element),true);
  assert.equal(isScalableTextElement(new FakeElement('CANVAS') as unknown as Element),false);
  const svg=new FakeElement('svg');svg.namespaceURI='http://www.w3.org/2000/svg';
  assert.equal(isScalableTextElement(svg as unknown as Element),false);
  paragraph.excluded=true;assert.equal(isScalableTextElement(paragraph as unknown as Element),false);
});
test('scaler measures authored typography, handles new route content and cleans up fully on Reset',()=>{
  const root=new FakeElement('HTML'),body=new FakeElement('BODY','16px','normal'),label=new FakeElement('LABEL','9px','12px'),nested=new FakeElement('SPAN','9px','12px');
  const button=new FakeElement('BUTTON','14px','20px');button.textContent='Save investigation';
  const nodes=[label,nested,button],frames=new Map<number,FrameRequestCallback>(),events=new EventTarget(),fonts=new EventTarget();
  let nextFrame=0,measurements=0,callback:(records:MutationRecord[])=>void=()=>{};
  class FakeObserver{
    constructor(fn:(records:MutationRecord[])=>void){callback=fn;}
    observe(){}disconnect(){}
  }
  const previousObserver=Object.getOwnPropertyDescriptor(globalThis,'MutationObserver'),previousElement=Object.getOwnPropertyDescriptor(globalThis,'Element');
  Object.defineProperty(globalThis,'MutationObserver',{value:FakeObserver,configurable:true});
  Object.defineProperty(globalThis,'Element',{value:FakeElement,configurable:true});
  const view={
    getComputedStyle:(node:FakeElement)=>{assert.ok(root.attributes.has('data-wa-text-measuring'));measurements++;return{fontSize:node.fontSize,lineHeight:node.lineHeight,height:node.tagName==='BUTTON'?'40px':'auto',minHeight:'0px'};},
    requestAnimationFrame:(fn:FrameRequestCallback)=>{frames.set(++nextFrame,fn);return nextFrame;},
    cancelAnimationFrame:(id:number)=>{frames.delete(id);},
    addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),
  };
  const doc={documentElement:root,body:Object.assign(body,{querySelectorAll:()=>nodes}),defaultView:view,fonts} as unknown as Document;
  try{
    const cleanup=installTextScaling(doc,150);
    assert.equal(label.style.getPropertyValue('--wa-base-font-size'),'9px');
    assert.equal(label.style.getPropertyValue('--wa-scaled-line-height'),'18px');
    assert.equal(nested.style.getPropertyValue('--wa-base-font-size'),'9px');
    assert.equal(root.style.getPropertyValue('--wa-text-factor'),'1.5');
    assert.equal(root.style.getPropertyValue('font-size'),'');
    assert.equal(button.attributes.has('data-wa-text-control'),true);
    assert.equal(button.style.getPropertyValue('--wa-control-min-height'),'40px');
    const heading=new FakeElement('H1','48px','52px');nodes.push(heading);
    callback([{target:body,type:'childList'} as unknown as MutationRecord]);
    assert.equal(frames.size,1);
    for(const [id,fn]of frames){frames.delete(id);fn(0);}
    assert.equal(heading.style.getPropertyValue('--wa-base-font-size'),'48px');
    assert.equal(heading.style.getPropertyValue('--wa-scaled-line-height'),'78px');
    assert.equal(nested.style.getPropertyValue('--wa-base-font-size'),'9px');
    assert.equal(label.style.getPropertyValue('--wa-scaled-line-height'),'18px');
    assert.ok(measurements>=7);
    cleanup();
    for(const node of [body,...nodes]){assert.equal(node.attributes.has('data-wa-text-scaled'),false);assert.equal(node.style.values.size,0);}
    assert.equal(root.style.values.size,0);
  }finally{
    if(previousObserver)Object.defineProperty(globalThis,'MutationObserver',previousObserver);else Reflect.deleteProperty(globalThis,'MutationObserver');
    if(previousElement)Object.defineProperty(globalThis,'Element',previousElement);else Reflect.deleteProperty(globalThis,'Element');
  }
});
test('100% leaves authored typography and geometry completely untouched',()=>{
  const root=new FakeElement('HTML');
  installTextScaling({documentElement:root,body:{},defaultView:{}} as unknown as Document,100)();
  assert.equal(root.style.values.size,0);assert.equal(root.attributes.size,0);
});
test('cursor/transform frames and our own measurement properties cannot trigger typography rescan loops',()=>{
  assert.equal(textStyleSignature('transform:translate(12px,3px);opacity:.4;--wa-base-font-size:9px'),textStyleSignature('transform:translate(14px,5px);opacity:.8;--wa-base-font-size:14px'));
  assert.notEqual(textStyleSignature('font-size:9px'),textStyleSignature('font-size:12px'));
  assert.notEqual(textStyleSignature('line-height:12px'),textStyleSignature('line-height:16px'));
  assert.notEqual(textStyleSignature('width:240px'),textStyleSignature('width:320px'));
  assert.notEqual(textStyleSignature('--specimen:small'),textStyleSignature('--specimen:large'));
});
test('text scaling owns no root font size, CSS zoom or transform; font-size override covers px labels',()=>{
  const css=readFileSync(new URL('../styles/text-size.css',import.meta.url),'utf8');
  assert.match(css,/font-size:calc\(var\(--wa-base-font-size\) \* var\(--wa-text-factor\)\)!important/);
  assert.doesNotMatch(css,/(?:^|[;{])\s*(?:zoom|transform):|html\s*\{[^}]*font-size/);
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  assert.equal((app.match(/<FontSizeSlider/g)??[]).length,1);
  assert.match(app,/useTextSize\(preferences\.textSize\)/);
});
