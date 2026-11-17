import {feedbackSpring} from './lens-feedback';
export function printSpringFrames(){
  let axis={position:0,velocity:48};
  const frames:Keyframe[]=[{transform:'translateY(0)'}];
  for(let i=0;i<20;i++){axis=feedbackSpring(axis,0,.015,260,25);frames.push({transform:`translateY(${axis.position}px)`});}
  frames.push({transform:'translateY(0)'});return frames;
}
export function settlePrint(node:HTMLElement){
  if(!node.isConnected||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  node.getAnimations().forEach(animation=>animation.cancel());node.animate(printSpringFrames(),{duration:300});
}
/** Exit is visual only. The caller removes the actual selection immediately. */
export function departPrint(element:Element|null|undefined){
  if(!(element instanceof HTMLElement))return;const host=element.closest<HTMLElement>('.fd-wizard-step')??element.parentElement;if(!host)return;
  const rect=element.getBoundingClientRect(),bounds=host.getBoundingClientRect(),clone=element.cloneNode(true) as HTMLElement;
  clone.inert=true;clone.setAttribute('aria-hidden','true');clone.removeAttribute('data-testid');clone.removeAttribute('id');clone.querySelectorAll('[data-testid],[id]').forEach(node=>{node.removeAttribute('data-testid');node.removeAttribute('id');});
  const images=element.querySelectorAll('img');clone.querySelectorAll('img').forEach((img,index)=>{const original=images[index];if(!original?.complete||!original.naturalWidth)return;const c=document.createElement('canvas');c.width=Math.max(1,Math.round(original.clientWidth*2));c.height=Math.max(1,Math.round(original.clientHeight*2));const context=c.getContext('2d');if(!context)return;const scale=Math.min(c.width/original.naturalWidth,c.height/original.naturalHeight),w=original.naturalWidth*scale,h=original.naturalHeight*scale;context.drawImage(original,(c.width-w)/2,(c.height-h)/2,w,h);c.style.cssText='width:100%;height:100%;object-fit:contain';img.replaceWith(c);});
  Object.assign(clone.style,{position:'absolute',left:`${rect.left-bounds.left}px`,top:`${rect.top-bounds.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,pointerEvents:'none',zIndex:'8',margin:'0'});host.append(clone);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,animation=clone.animate(reduced?[{opacity:1},{opacity:0}]:[{opacity:1,transform:'translate(0,0)'},{opacity:0,transform:'translate(32px,10px)'}],{duration:reduced?150:200,easing:'ease-out'});
  void animation.finished.catch(()=>{}).finally(()=>clone.remove());
}
