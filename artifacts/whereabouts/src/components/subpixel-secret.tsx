import {useEffect,useRef} from 'react';
import {rgbEmitter} from '@/lib/rgb-screen';
/** Pixel-sampled hidden type, not a colored CSS text shadow. Always local. */
export function SubpixelSecret({text}:{text:string}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const canvas=ref.current,host=canvas?.parentElement;if(!canvas||!host)return;let disposed=false;const devicePixelRatio=Math.ceil(window.devicePixelRatio||1);
    const paint=()=>{if(disposed)return;const width=Math.max(1,Math.round(host.clientWidth)),height=Math.max(1,Math.round(host.clientHeight)),dpr=Math.min(2,devicePixelRatio||1),source=document.createElement('canvas');source.width=Math.ceil(width/3);source.height=Math.ceil(height/3);const c=source.getContext('2d',{willReadFrequently:true}),out=canvas.getContext('2d');if(!c||!out)return;const style=getComputedStyle(host);c.fillStyle=style.getPropertyValue('--paper').trim()||'#f4f4f2';c.fillRect(0,0,source.width,source.height);c.fillStyle=style.getPropertyValue('--ink').trim()||'#20221f';c.font=`6px ${style.getPropertyValue('--app-font-mono')||'monospace'}`;c.textAlign='center';c.textBaseline='middle';c.fillText(text,source.width/2,source.height/2);const data=c.getImageData(0,0,source.width,source.height);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const result=out.createImageData(canvas.width,canvas.height);
      const pitch=3*dpr,weights=Array.from({length:pitch*pitch},(_,index)=>rgbEmitter([1,1,1],index%pitch/pitch,Math.floor(index/pitch)/pitch));
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){const index=(Math.floor(y/pitch)*source.width+Math.floor(x/pitch))*4,target=(y*canvas.width+x)*4,emission=weights[(y%pitch)*pitch+x%pitch];for(let channel=0;channel<3;channel++)result.data[target+channel]=data.data[index+channel]*emission[channel];result.data[target+3]=255;}out.putImageData(result,0,0);source.width=source.height=1;
    };
    const observer=new ResizeObserver(paint);observer.observe(host);void document.fonts.ready.then(paint);paint();return()=>{disposed=true;observer.disconnect();canvas.width=canvas.height=1;};
  },[text]);
  return <canvas ref={ref} aria-hidden="true" style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>;
}
