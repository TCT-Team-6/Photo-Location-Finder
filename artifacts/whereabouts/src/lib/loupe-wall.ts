import { coverToImage, type ExamplePhoto, type ImageRegion, type RegionReading } from './loupe-image-data';
import type { LoupePoint } from './loupe-dwell';
import type { LoupePhase } from './loupe-dwell';
import { GLASS_MAGNIFICATION } from './lens-feedback';
import {SCRAMBLE_GLYPHS} from './decrypt-timeline';
export const dataGlyphSamplingRatio=(dpr:number)=>Math.max(3,Math.min(4,(dpr||1)*2));
export const dataGlyphRasterRatio=(dpr:number)=>Math.max(6,Math.min(12,(dpr||1)*6));

/** Measure at 10px/alphabetic, never from a top-baseline negative ascent. */
export function wallGlyphLayout(metrics:Pick<TextMetrics,'actualBoundingBoxAscent'|'actualBoundingBoxDescent'>){
  const ascent=metrics.actualBoundingBoxAscent,descent=metrics.actualBoundingBoxDescent,total=ascent+descent;
  const reference=Number.isFinite(ascent)&&ascent>0&&Number.isFinite(descent)&&descent>=0&&total>=3&&total<=18?total:8;
  const target=20/GLASS_MAGNIFICATION,fontSize=Math.max(1.5,Math.min(27,10*target/reference));
  return {fontSize,glyphHeight:reference*fontSize/10};
}

export function rgbBit(rgb: ArrayLike<number>, bit: number) {
  const position = ((bit % 24) + 24) % 24;
  return ((rgb[Math.floor(position / 8)] >> (7 - position % 8)) & 1).toString();
}
export function wallObjects(reading: RegionReading, photo: ExamplePhoto, regions: ImageRegion[]) {
  const center = { x: reading.stats.pixel_xy[0] / photo.original_width, y: reading.stats.pixel_xy[1] / photo.original_height };
  const distance = (region: ImageRegion) => {
    const sum = region.polygon.reduce((a,p) => ({ x:a.x+p[0],y:a.y+p[1] }),{x:0,y:0});
    return Math.hypot((sum.x / Math.max(1,region.polygon.length)-center.x)*photo.original_width,(sum.y / Math.max(1,region.polygon.length)-center.y)*photo.original_height);
  };
  const others = regions.filter((region) => region.id !== reading.region?.id && region.priority >= 0).sort((a,b) => distance(a)-distance(b));
  const authored=(region:ImageRegion)=>region.label==='person'?{subject:'person — not analyzed'}:region.clues;
  return [
    { type: 'center_region', region_id: reading.region?.id ?? 'unclassified', ...reading.record },
    ...others.map((region) => ({ type: 'authored_nearby_region', region_id: region.id, region: region.label, ...authored(region), gps: photo.gps, gps_status: photo.gps_status, clue_status: photo.clue_status })),
    { type:'capture_context', filename:photo.original_filename, dimensions:[photo.original_width,photo.original_height], capture:photo.capture,gps:photo.gps,gps_status:photo.gps_status,provenance:photo.provenance,exif:photo.exif, global_scene_clues:regions.filter(region=>region.priority<0).map(authored) },
    { type:'live_optimized_pixels', ...reading.stats, pixel_status:photo.pixel_status, gps:photo.gps, gps_status:photo.gps_status, capture:photo.capture },
  ];
}
/** Continuous minified stream. Only keys of the center object are marked red. */
export function wallStream(objects: object[]) {
  const encoded = objects.map((object) => JSON.stringify(object));
  const unique = encoded.filter((value,index) => value !== encoded[index-1]);
  if (unique.length > 1 && unique[0] === unique.at(-1)) unique.pop();
  const text = unique.join('');
  const red = new Uint8Array(text.length);
  for (const match of (unique[0] ?? '').matchAll(/"(?:\\.|[^"\\])*"(?=:)/g)) red.fill(1,match.index!,match.index!+match[0].length);
  return { text, red };
}
export function streamCell(stream: ReturnType<typeof wallStream>, index: number, anchor = 0) {
  const at = ((index-anchor) % stream.text.length + stream.text.length) % stream.text.length;
  return { char: stream.text[at] ?? '0', red: stream.red[at] === 1 };
}

/** One photo-sized raster. The glass samples screen-aligned UVs into this wall. */
export function createDataWall(image: HTMLImageElement, font: string, ink: string, paper: string) {
  const source = document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
  const sourceContext=source.getContext('2d',{willReadFrequently:true});if(!sourceContext)throw new Error('RGB wall source unavailable.');
  sourceContext.drawImage(image,0,0);const pixels=sourceContext.getImageData(0,0,source.width,source.height).data;
  const canvas=document.createElement('canvas'),binary=document.createElement('canvas'),json=document.createElement('canvas'),frozen=document.createElement('canvas'),detailCanvas=document.createElement('canvas');
  const context=canvas.getContext('2d'),bc=binary.getContext('2d'),jc=json.getContext('2d');
  if(!context||!bc||!jc)throw new Error('Data wall unavailable.');
  const detail=detailCanvas.getContext('2d');if(!detail)throw new Error('Data glyph raster unavailable.');
  const detailRect={x:0,y:0,width:1,height:1};
  let detailRatio=6;
  let width=1,height=1,zoom=1,scale=1,fontSize=10,glyphHeight=6,bw=5,bh=11,jw=5,jh=11,columns=1,jsonDirty=true,lastRegion='',lastReading:RegionReading|undefined;
  let stream=wallStream([{}]),anchor=0,previousPhase:LoupePhase='binary';
  const baseBit=(x:number,y:number,bit:number)=>{
    const point=coverToImage({x:(x-width/2)/zoom+width/2,y:(y-height/2)/zoom+height/2},{width,height},{width:source.width,height:source.height});
    const at=(Math.floor(point.y)*source.width+Math.floor(point.x))*4;
    return rgbBit(pixels.subarray(at,at+3),bit);
  };
  const resize=(w:number,h:number,nextZoom=zoom,maxEdge=Infinity)=>{
    width=Math.max(1,w);height=Math.max(1,h);zoom=nextZoom;scale=Math.min(window.devicePixelRatio||1,maxEdge/Math.max(width,height));
    [canvas,binary,json,frozen].forEach(c=>{c.width=Math.ceil(width*scale);c.height=Math.ceil(height*scale);});
    [context,bc,jc].forEach(c=>{c.setTransform(scale,0,0,scale,0,0);c.textBaseline='top';});
    bc.font=`10px ${font}`;bc.textBaseline='alphabetic';
    ({fontSize,glyphHeight}=wallGlyphLayout(bc.measureText('0')));
    bc.textBaseline='top';bc.font=`${fontSize}px ${font}`;bw=Math.max(1,bc.measureText('0').width||fontSize*.6);bh=Math.max(fontSize+1,glyphHeight+2);columns=Math.ceil(width/bw);
    bc.fillStyle=paper;bc.fillRect(0,0,width,height);bc.fillStyle=ink;
    for(let row=0;row<Math.ceil(height/bh);row++){
      let line='';for(let col=0;col<columns;col++)line+=baseBit(col*bw+bw/2,row*bh+bh/2,(row*columns+col)%24);
      bc.fillText(line,0,row*bh);
    }
    jc.font=`${fontSize}px ${font}`;jw=Math.max(1,jc.measureText('0').width||fontSize*.6);jh=Math.max(fontSize+1,glyphHeight+2);jsonDirty=true;
  };
  const paintJson=(reading:RegionReading,photo:ExamplePhoto,regions:ImageRegion[],point:LoupePoint,radius:number)=>{
    stream=wallStream(wallObjects(reading,photo,regions));const cols=Math.ceil(width/jw);
    anchor=Math.floor(Math.max(0,point.y-radius*.7)/jh)*cols+Math.floor(Math.max(0,point.x-radius*.7)/jw);
    jc.fillStyle=paper;jc.fillRect(0,0,width,height);jc.font=`${fontSize}px ${font}`;
    for(let row=0;row<Math.ceil(height/jh);row++){
      let line='';const marks:boolean[]=[];
      for(let col=0;col<cols;col++){const cell=streamCell(stream,row*cols+col,anchor);line+=cell.char;marks.push(cell.red);}
      jc.fillStyle=ink;jc.fillText(line,0,row*jh);
      for(let col=0;col<cols;){if(!marks[col]){col++;continue;}const start=col;while(col<cols&&marks[col])col++;jc.fillStyle='#b6382e';jc.fillText(line.slice(start,col),start*jw,row*jh);}
    }
  };
  /** A moving high-resolution raster window into the SAME photo-sized grid.
   * Tiny 3px source glyphs must not be rasterized at screen DPR then enlarged:
   * they lose their counters before the glass ever samples them. This keeps the
   * global cell coordinates/real RGB bits, without allocating a 12x photo bitmap. */
  const paintDetail=(phase:LoupePhase,progress:number,point:LoupePoint,radius:number,reduced:boolean,reverse:boolean,elapsed:number,reverseAge:number,reverseStart:number)=>{
    const size=Math.max(32,Math.ceil((radius*3+8)/16)*16);
    detailRatio=dataGlyphRasterRatio(window.devicePixelRatio);
    const pixels=Math.ceil(size*detailRatio);
    if(detailCanvas.width!==pixels){detailCanvas.width=detailCanvas.height=pixels;}
    Object.assign(detailRect,{x:Math.floor((point.x-size/2)/bw)*bw,y:Math.floor((point.y-size/2)/bh)*bh,width:size,height:size});
    detail.setTransform(detailRatio,0,0,detailRatio,-detailRect.x*detailRatio,-detailRect.y*detailRatio);
    detail.globalAlpha=1;detail.fillStyle=paper;detail.fillRect(detailRect.x,detailRect.y,size,size);
    detail.font=`${fontSize}px ${font}`;detail.textBaseline='top';
    const cols=Math.ceil(width/jw);
    for(let row=Math.floor(detailRect.y/bh);row<=Math.ceil((detailRect.y+size)/bh);row++){
      for(let col=Math.floor(detailRect.x/bw);col<=Math.ceil((detailRect.x+size)/bw);col++){
        const x=col*bw,y=row*bh,seed=row*columns+col;
        const bit=baseBit(x+bw/2,y+bh/2,seed%24),cell=streamCell(stream,row*cols+col,anchor);
        const distance=Math.hypot(x+bw/2-point.x,y+bh/2-point.y)/radius;
        const landed=phase==='json'||phase==='decoding'&&elapsed>=100&&distance<=progress;
        let char=bit;
        if(landed)char=cell.char;
        else if(phase==='decoding'&&elapsed>=100&&!reduced){
          const crossedAt=Math.max(0,250*(1-(250+distance*350)/Math.max(1,reverseStart)));
          const tick=Math.floor((reverse?reverseAge:Math.min(350,elapsed))/(30+Math.abs(seed)%31));
          char=reverse&&reverseAge-crossedAt>=30?bit:SCRAMBLE_GLYPHS[((seed*331+tick*17)%SCRAMBLE_GLYPHS.length+SCRAMBLE_GLYPHS.length)%SCRAMBLE_GLYPHS.length];
        }
        detail.fillStyle=landed&&cell.red&&phase==='json'?'#b6382e':ink;
        if(reduced&&phase==='decoding'){
          detail.fillStyle=ink;detail.fillText(bit,x,y);detail.globalAlpha=progress;detail.fillStyle=paper;detail.fillRect(x,y,bw,bh);detail.fillStyle=ink;detail.fillText(cell.char,x,y);detail.globalAlpha=1;
        }else{
          if(landed&&!reverse&&phase==='decoding'&&elapsed-(250+Math.min(1,distance)*350)<60)detail.fillStyle='#121310';
          detail.fillText(char,x,y);
        }
      }
    }
    if(!reduced&&phase==='decoding'&&elapsed>=100&&elapsed<350&&(elapsed-100)%55<47){
      const cycle=Math.floor((elapsed-100)/55),first=Math.max(0,Math.floor((point.y-radius)/bh));
      detail.setTransform(1,0,0,1,0,0);
      for(let i=0;i<4;i++){
        const row=first+(i*3+cycle)%Math.max(1,Math.ceil(radius*2/bh)),sy=Math.round((row*bh-detailRect.y)*detailRatio),high=Math.min(pixels-sy,Math.round(bh*(1+i%2)*detailRatio)),dx=Math.round((i%2?1:-1)*(1+(i+cycle)%3)*bw*detailRatio);
        if(sy>=0&&high>0)detail.drawImage(detailCanvas,0,sy,pixels,high,dx,sy,pixels,high);
      }
    }
  };
  return {
    canvas,detailCanvas,detailRect,resize,get detailRatio(){return detailRatio;},get pixelRatio(){return scale;},get glyphHeight(){return glyphHeight;},
    paint(_now:number,phase:LoupePhase,progress:number,point:LoupePoint,radius:number,reading:RegionReading,photo:ExamplePhoto,regions:ImageRegion[],reduced:boolean,reverse=false,resolve=1,elapsed=progress*600,reverseAge=0,reverseStart=600){
      void resolve;
      // Prepare once at lock, never redraw thousands of JSON cells during each scramble frame.
      if(!reverse&&phase==='binary'&&(reading.region?.id!==lastRegion||reading!==lastReading)){jsonDirty=true;lastRegion=reading.region?.id??'';}
      if(jsonDirty&&(phase!=='binary'||reverse)){paintJson(reading,photo,regions,point,radius);jsonDirty=false;}
      lastReading=reading;
      paintDetail(phase,progress,point,radius,reduced,reverse,elapsed,reverseAge,reverseStart);
      if(phase==='decoding'&&previousPhase==='binary'){frozen.getContext('2d')?.drawImage(canvas,0,0);}
      previousPhase=phase;
      context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;
      context.drawImage(phase==='json'?json:phase==='decoding'&&!reverse&&!reduced&&elapsed<100?frozen:binary,0,0);
      if(reduced&&phase==='decoding'){context.globalAlpha=progress;context.drawImage(json,0,0);context.globalAlpha=1;return;}
      context.setTransform(scale,0,0,scale,0,0);
      if(!reduced&&phase==='binary'){
        context.font=`${fontSize}px ${font}`;
        for(let i=0;i<4;i++){
          const px=Math.max(0,Math.min(width-bw,point.x+(Math.random()-.5)*radius)),py=Math.max(0,Math.min(height-bh,point.y+(Math.random()-.5)*radius));
          const col=Math.floor(px/bw),row=Math.floor(py/bh),x=col*bw,y=row*bh;
          context.fillStyle=paper;context.fillRect(x,y,bw,bh);context.fillStyle=ink;
          context.fillText(baseBit(x+bw/2,y+bh/2,(row*columns+col)%24)==='1'?'0':'1',x,y);
        }
      }
      if(!reduced&&phase==='decoding'&&elapsed>=100){
        context.font=`${fontSize}px ${font}`;const cols=Math.ceil(width/jw);
        for(let row=Math.max(0,Math.floor((point.y-radius)/bh)-2);row<Math.min(Math.ceil(height/bh),Math.ceil((point.y+radius)/bh)+2);row++){
          for(let col=Math.max(0,Math.floor((point.x-radius)/bw)-2);col<Math.min(columns,Math.ceil((point.x+radius)/bw)+2);col++){
            const x=col*bw,y=row*bh,distance=Math.hypot(x+bw/2-point.x,y+bh/2-point.y)/radius,seed=row*columns+col;
            const cell=streamCell(stream,row*cols+col,anchor),landed=distance<=progress;
            const tick=Math.floor((reverse?reverseAge:Math.min(350,elapsed))/(30+seed%31));
            const crossedAt=Math.max(0,250*(1-(250+distance*350)/Math.max(1,reverseStart)));
            const char=landed?cell.char:reverse&&reverseAge-crossedAt>=30?baseBit(x+bw/2,y+bh/2,seed%24):SCRAMBLE_GLYPHS[(seed*331+tick*17)%SCRAMBLE_GLYPHS.length];
            context.fillStyle=paper;context.fillRect(x,y,bw,bh);const landedAt=250+Math.min(1,distance)*350;
            context.fillStyle=landed&&!reverse&&elapsed-landedAt>=0&&elapsed-landedAt<60?'#121310':ink;context.fillText(char,x,y);
          }
        }
        if(elapsed<350&&(elapsed-100)%55<47){
          const cycle=Math.floor((elapsed-100)/55),first=Math.max(0,Math.floor((point.y-radius)/bh));
          for(let i=0;i<4;i++){const row=first+(i*3+cycle)%Math.max(1,Math.ceil(radius*2/bh)),sy=Math.round(row*bh*scale),high=Math.min(canvas.height-sy,Math.round(bh*(1+i%2)*scale)),dx=Math.round((i%2?1:-1)*(1+(i+cycle)%3)*bw*scale);if(high>0){context.setTransform(1,0,0,1,0,0);context.drawImage(canvas,0,sy,canvas.width,high,dx,sy,canvas.width,high);}}
        }
      }
    },
    dispose(){[source,canvas,binary,json,frozen,detailCanvas].forEach(c=>{c.width=c.height=1;});},
  };
}
