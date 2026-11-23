import {validTextSize} from './app-preferences';

/** Pixel snapshots are taken with our override disabled. Every element receives
 * its own authored base, so nested ems/inherited text never multiply the scale.
 * Root rem remains unchanged: rails, canvases, padding and icons are not zoomed. */
export function scaledTypography(fontSize:string,lineHeight:string,percentage:number){
  const factor=validTextSize(percentage)/100,font=parseFloat(fontSize),line=parseFloat(lineHeight);
  return{base:Number.isFinite(font)?`${font}px`:'16px',lineHeight:lineHeight==='normal'||!Number.isFinite(line)?'normal':`${line*factor}px`};
}
export function isScalableTextElement(element:Element):element is HTMLElement{
  return element.namespaceURI==='http://www.w3.org/1999/xhtml'&&!['HTML','HEAD','STYLE','SCRIPT','LINK','META','CANVAS','IMG','VIDEO','AUDIO','SOURCE','IFRAME','NOSCRIPT'].includes(element.tagName)&&!element.closest('[data-text-scale-exempt]');
}
export function textStyleSignature(style:string|null){
  return(style??'').split(';').map(declaration=>declaration.trim()).filter(declaration=>/^(?:font(?:-[\w-]+)?|line-height|(?:min-|max-)?(?:width|height)|--(?!wa-)[\w-]+)\s*:/.test(declaration)).sort().join(';');
}
export function installTextScaling(doc:Document,percentage:number){
  const root=doc.documentElement,view=doc.defaultView;
  if(!view||!doc.body||validTextSize(percentage)===100)return()=>{};
  const marked=new Set<HTMLElement>();
  let frame=0,disposed=false;
  root.dataset.waTextSize=String(validTextSize(percentage));
  root.style.setProperty('--wa-text-factor',String(validTextSize(percentage)/100));
  const observer=new MutationObserver(records=>{
    // Physical Views write pixel tracking styles during scroll; those contain no text.
    const relevant=records.some(record=>{
      if(record.target instanceof Element&&record.target.closest('.physical-view,.physical-fallback,canvas,.wa-site-cursor-dot,.wa-site-cursor-ring'))return false;
      if(record.type==='attributes'&&record.attributeName==='style'&&record.target instanceof Element)return textStyleSignature(record.oldValue)!==textStyleSignature(record.target.getAttribute('style'));
      return true;
    });
    if(!relevant)return;
    schedule();
  });
  const observe=()=>observer.observe(doc.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:['class','style','hidden','open','data-app-theme','data-app-font','data-high-contrast']});
  const refresh=()=>{
    if(disposed)return;
    observer.disconnect();
    root.setAttribute('data-wa-text-measuring','');
    try{
      const nodes=Array.from(doc.body.querySelectorAll('*')).filter(isScalableTextElement);
      // body itself supplies a stable base for direct text nodes and portals.
      nodes.unshift(doc.body);
      const measured=nodes.map(node=>{
        const computed=view.getComputedStyle(node);
        const textControl=['BUTTON','A','SUMMARY'].includes(node.tagName)&&Boolean(node.textContent?.trim())&&!node.closest('.physical-accessible,[aria-hidden=true]');
        return{node,...scaledTypography(computed.fontSize,computed.lineHeight,percentage),textControl,controlHeight:Math.max(parseFloat(computed.height)||0,parseFloat(computed.minHeight)||0)};
      });
      for(const {node,base,lineHeight,textControl,controlHeight}of measured){
        node.style.setProperty('--wa-base-font-size',base);
        node.style.setProperty('--wa-scaled-line-height',lineHeight);
        node.setAttribute('data-wa-text-scaled','');
        if(textControl){node.setAttribute('data-wa-text-control','');node.style.setProperty('--wa-control-min-height',`${controlHeight}px`);}
        else{node.removeAttribute('data-wa-text-control');node.style.removeProperty('--wa-control-min-height');}
        marked.add(node);
      }
      for(const node of marked)if(!node.isConnected){clearNode(node);marked.delete(node);}
    }finally{root.removeAttribute('data-wa-text-measuring');observe();}
    // Let the existing View tracker remeasure reflow without changing renderer logic.
    view.dispatchEvent(new Event('whereabouts:instrument-motion'));
  };
  function schedule(){if(!frame&&!disposed)frame=view!.requestAnimationFrame(()=>{frame=0;refresh();});}
  function clearNode(node:HTMLElement){node.removeAttribute('data-wa-text-scaled');node.removeAttribute('data-wa-text-control');node.style.removeProperty('--wa-base-font-size');node.style.removeProperty('--wa-scaled-line-height');node.style.removeProperty('--wa-control-min-height');}
  observe();refresh();
  view.addEventListener('resize',schedule);
  doc.fonts?.addEventListener('loadingdone',schedule);
  return()=>{
    disposed=true;observer.disconnect();view.cancelAnimationFrame(frame);view.removeEventListener('resize',schedule);doc.fonts?.removeEventListener('loadingdone',schedule);
    for(const node of marked)clearNode(node);
    root.removeAttribute('data-wa-text-size');root.removeAttribute('data-wa-text-measuring');root.style.removeProperty('--wa-text-factor');
  };
}
