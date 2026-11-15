import type { ExamplePhoto } from './loupe-image-data';
import { scrollLight, type InstrumentLayout } from './instrument-layout';

/** Visible panel artwork lives on a scene plane, so the scene RT includes every mark. */
export function createPanelSurface(font:string,photo:ExamplePhoto,index:number) {
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Instrument panel surface unavailable.');
  const peg=(x:number,y:number,r:number,progress:number)=>{
    const l=scrollLight(progress),g=ctx.createRadialGradient(x+l.x*r*.45,y-r*.45,.2,x,y,r);
    g.addColorStop(0,'#f4f4f2');g.addColorStop(.45,'#92978e');g.addColorStop(1,'#4f554e');
    ctx.save();ctx.shadowColor='#24272340';ctx.shadowOffsetX=l.castX*.08;ctx.shadowOffsetY=l.castY*.08;ctx.shadowBlur=3;ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.restore();
  };
  return {canvas,
    paint(layout:InstrumentLayout,progress:number,used:boolean,readout:string,dpr:number){
      const w=layout.panelWidth,h=layout.mobile?160:layout.height,l=scrollLight(progress),r=dpr;
      if(canvas.width!==Math.ceil(w*r)||canvas.height!==Math.ceil(h*r)){canvas.width=Math.ceil(w*r);canvas.height=Math.ceil(h*r);}
      ctx.setTransform(r,0,0,r,0,0);ctx.clearRect(0,0,w,h);
      const gradient=ctx.createLinearGradient(w/2+l.x*w*.5,0,w/2-l.x*w*.5,h);
      gradient.addColorStop(0,'#f0efeb');gradient.addColorStop(1,'#e8e7e3');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
      for(let y=12;y<h;y+=24)for(let x=12;x<w;x+=24){
        ctx.fillStyle='#bdbbb4';ctx.beginPath();ctx.arc(x+l.holeX,y+l.holeY,1.8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#d6d4ce';ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill();
      }
      ctx.strokeStyle='#242723';ctx.lineWidth=1;ctx.beginPath();if(layout.mobile){ctx.moveTo(0,.5);ctx.lineTo(w,.5);}else{ctx.moveTo(.5,0);ctx.lineTo(.5,h);}ctx.stroke();
      const left=layout.mobile?12:22,top=layout.mobile?10:28;
      ctx.textBaseline='top';ctx.fillStyle='#242723';ctx.font=`${layout.mobile?8:10}px ${font}`;ctx.fillText('INSTRUMENT 01 — LOUPE',left,top);
      ctx.beginPath();ctx.moveTo(left,top+(layout.mobile?20:30));ctx.lineTo(layout.mobile?142:w-22,top+(layout.mobile?20:30));ctx.stroke();
      if(!used){ctx.font=`${layout.mobile?8:9}px ${font}`;const hint='HOLD TO LIFT';ctx.fillText(hint,layout.mobile?12:(w-ctx.measureText(hint).width)/2,layout.mobile?64:h*.48);}
      const rx=layout.mobile?used?15:92:28,ry=layout.mobile?58:h*.55,rw=layout.mobile?26:37,rh=layout.mobile?64:h*.35;
      const metal=ctx.createLinearGradient(rx+l.x*rw,ry,rx+rw-l.x*rw,ry+rh);metal.addColorStop(0,'#c7cac5');metal.addColorStop(.45,'#e4e6e0');metal.addColorStop(1,'#bcbfb9');
      ctx.save();ctx.shadowColor='#24272323';ctx.shadowOffsetX=l.castX*.25;ctx.shadowOffsetY=l.castY*.25;ctx.shadowBlur=l.blur*.4;ctx.fillStyle=metal;ctx.fillRect(rx,ry,rw,rh);ctx.restore();
      ctx.strokeStyle='#a5a7a1';ctx.strokeRect(rx+.5,ry+.5,rw-1,rh-1);ctx.strokeStyle='#40453f';
      for(let mm=0;mm*6<rh-18;mm++){ctx.beginPath();ctx.moveTo(rx,ry+9+mm*6);ctx.lineTo(rx+(mm%5===0?14:8),ry+9+mm*6);ctx.stroke();}
      ctx.font=`7px ${font}`;ctx.fillStyle='#242723';for(let i=0;i<6;i++)ctx.fillText(String(i*10),rx+rw-12,ry+12+i*(rh-24)/6);
      ctx.font=`6px ${font}`;ctx.fillText('mm',rx+rw-12,ry+rh-20);peg(rx+rw/2,ry+6,3.5,progress);peg(rx+rw/2,ry+rh-6,3.5,progress);
      const tx=layout.mobile?w-119:91,ty=layout.mobile?24:h*.61,tw=layout.mobile?106:w-111,th=layout.mobile?108:155;
      ctx.save();ctx.translate(tx+tw/2,ty);ctx.rotate(3*Math.PI/180);
      ctx.shadowColor='#24272322';ctx.shadowOffsetX=l.castX*.5;ctx.shadowOffsetY=l.castY*.5;ctx.shadowBlur=l.blur*.6;ctx.fillStyle='#f4f4f2';ctx.fillRect(-tw/2,0,tw,th);
      ctx.shadowColor='transparent';ctx.strokeStyle='#d6d4ce';ctx.strokeRect(-tw/2,0,tw,th);
      const size=layout.mobile?7:9;ctx.font=`${size}px ${font}`;ctx.fillStyle='#242723';
      const coordinate=(value:number,a:string,b:string)=>`${Math.abs(value).toFixed(4)}° ${value>=0?a:b}`;
      const lines=[`SPECIMEN ${String(index+1).padStart(2,'0')}`,coordinate(photo.gps[0],'N','S'),coordinate(photo.gps[1],'E','W'),index===0?'MARIPOSA GROVE':'PREPARED SAMPLE',index===0?'CONF 0.65':'UNVERIFIED'];
      lines.forEach((line,i)=>ctx.fillText(line,-tw/2+8,layout.mobile?14+i*11:20+i*17));
      ctx.font=`${layout.mobile?6:7}px ${font}`;ctx.fillText(index===0?'SUPPLIED MATCH / USER ESTIMATE':'FICTIONAL SAMPLE',-tw/2+8,th-26);ctx.fillText('NOT EXIF',-tw/2+8,th-16);peg(0,7,3.5,progress);ctx.restore();
      ctx.strokeStyle='#a8aaa2';ctx.beginPath();ctx.moveTo(left,h-(layout.mobile?27:45));ctx.lineTo(w-left,h-(layout.mobile?27:45));ctx.stroke();
      ctx.font=`${layout.mobile?8:11}px ${font}`;ctx.fillStyle='#242723';ctx.fillText(readout,left,h-(layout.mobile?19:33));
    },
    dispose(){canvas.width=canvas.height=1;},
  };
}
