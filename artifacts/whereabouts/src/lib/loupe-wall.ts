import { coverToImage, type ExamplePhoto, type ImageRegion, type RegionReading } from './loupe-image-data';
import type { LoupePoint } from './loupe-dwell';
import type { LoupePhase } from './loupe-dwell';

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
  const canvas=document.createElement('canvas'),binary=document.createElement('canvas'),json=document.createElement('canvas');
  const context=canvas.getContext('2d'),bc=binary.getContext('2d'),jc=json.getContext('2d');
  if(!context||!bc||!jc)throw new Error('Data wall unavailable.');
  let width=1,height=1,zoom=1,scale=1,bw=5,bh=9,jw=8,jh=13,columns=1,jsonDirty=true,lastRegion='',lastReading:RegionReading|undefined;
  const baseBit=(x:number,y:number,bit:number)=>{
    const point=coverToImage({x:(x-width/2)/zoom+width/2,y:(y-height/2)/zoom+height/2},{width,height},{width:source.width,height:source.height});
    const at=(Math.floor(point.y)*source.width+Math.floor(point.x))*4;
    return rgbBit(pixels.subarray(at,at+3),bit);
  };
  const resize=(w:number,h:number,nextZoom=zoom)=>{
    width=Math.max(1,w);height=Math.max(1,h);zoom=nextZoom;scale=Math.min(1,2048/Math.max(width,height));
    [canvas,binary,json].forEach(c=>{c.width=Math.ceil(width*scale);c.height=Math.ceil(height*scale);});
    [context,bc,jc].forEach(c=>{c.setTransform(scale,0,0,scale,0,0);c.textBaseline='top';});
    bc.font=`9px ${font}`;bw=bc.measureText('0').width;bh=9;columns=Math.ceil(width/bw);
    bc.fillStyle=paper;bc.fillRect(0,0,width,height);bc.fillStyle=ink;
    for(let row=0;row<Math.ceil(height/bh);row++){
      let line='';for(let col=0;col<columns;col++)line+=baseBit(col*bw+bw/2,row*bh+bh/2,(row*columns+col)%24);
      bc.fillText(line,0,row*bh);
    }
    jc.font=`13px ${font}`;jw=jc.measureText('0').width;jh=13;jsonDirty=true;
  };
  const paintJson=(reading:RegionReading,photo:ExamplePhoto,regions:ImageRegion[],point:LoupePoint,radius:number)=>{
    const stream=wallStream(wallObjects(reading,photo,regions));const cols=Math.ceil(width/jw);
    const anchor=Math.floor(Math.max(0,point.y-radius*.7)/jh)*cols+Math.floor(Math.max(0,point.x-radius*.7)/jw);
    jc.fillStyle=paper;jc.fillRect(0,0,width,height);jc.font=`13px ${font}`;
    for(let row=0;row<Math.ceil(height/jh);row++){
      let line='';const marks:boolean[]=[];
      for(let col=0;col<cols;col++){const cell=streamCell(stream,row*cols+col,anchor);line+=cell.char;marks.push(cell.red);}
      jc.fillStyle=ink;jc.fillText(line,0,row*jh);
      for(let col=0;col<cols;){if(!marks[col]){col++;continue;}const start=col;while(col<cols&&marks[col])col++;jc.fillStyle='#b6382e';jc.fillText(line.slice(start,col),start*jw,row*jh);}
    }
  };
  return {
    canvas,resize,
    paint(now:number,phase:LoupePhase,progress:number,point:LoupePoint,radius:number,reading:RegionReading,photo:ExamplePhoto,regions:ImageRegion[],reduced:boolean,reverse=false,resolve=1){
      if(reading.region?.id!==lastRegion||reading!==lastReading&&phase==='decoding'){jsonDirty=true;lastRegion=reading.region?.id??'';}
      if(jsonDirty&&(phase!=='binary'||reverse)){paintJson(reading,photo,regions,point,radius);jsonDirty=false;}
      lastReading=reading;
      context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.drawImage(binary,0,0);
      const amount=phase==='json'?1:phase==='decoding'||reverse?progress:0;
      if(amount>0){context.globalAlpha=reduced?(phase==='json'?1:0):amount;context.drawImage(json,0,0);context.globalAlpha=1;}
      context.setTransform(scale,0,0,scale,0,0);
      if(!reduced&&phase==='binary'&&!reverse&&resolve<1){
        context.font=`9px ${font}`;const glyphs='01{}[]:;';
        for(let row=Math.max(0,Math.floor((point.y-radius)/bh));row<Math.min(Math.ceil(height/bh),Math.ceil((point.y+radius)/bh));row++){
          for(let col=Math.max(0,Math.floor((point.x-radius)/bw));col<Math.min(columns,Math.ceil((point.x+radius)/bw));col++){
            const x=col*bw,y=row*bh;if(Math.hypot(x-point.x,y-point.y)>radius||Math.random()<resolve)continue;
            context.fillStyle=paper;context.fillRect(x,y,bw,bh);context.fillStyle=ink;context.fillText(glyphs[Math.floor(Math.random()*glyphs.length)],x,y);
          }
        }
      }
      if(!reduced&&phase==='binary'&&!reverse){
        context.font=`9px ${font}`;
        for(let i=0;i<4;i++){
          const px=Math.max(0,Math.min(width-bw,point.x+(Math.random()-.5)*radius)),py=Math.max(0,Math.min(height-bh,point.y+(Math.random()-.5)*radius));
          const col=Math.floor(px/bw),row=Math.floor(py/bh),x=col*bw,y=row*bh;
          context.fillStyle=paper;context.fillRect(x,y,bw,bh);context.fillStyle=ink;
          context.fillText(baseBit(x+bw/2,y+bh/2,(row*columns+col)%24)==='1'?'0':'1',x,y);
        }
      }
      if(!reduced&&(phase==='decoding'||reverse)&&amount>0&&amount<1){
        const intensity=Math.sin(Math.PI*amount),tick=Math.floor(now/45);
        for(let i=0;i<5;i++){
          const sy=((tick*37+i*101)%Math.max(1,Math.floor(height)))*scale,dy=(i%2?1:-1)*intensity*13*scale;
          context.setTransform(1,0,0,1,0,0);context.drawImage(canvas,0,sy,canvas.width,6*scale,dy,sy,canvas.width,6*scale);
        }
        context.setTransform(scale,0,0,scale,0,0);context.font=`13px ${font}`;
        for(let i=0;i<8;i++){const px=point.x-radius+(i*43+tick*7)%(radius*2),py=point.y-radius+(i*59+tick*11)%(radius*2);context.fillStyle=i%2?'#9e332d':'#365967';context.fillText(rgbBit(reading.stats.avg_rgb,tick+i),px+intensity*(i%2?2:-2),py);}
      }
    },
    dispose(){[source,canvas,binary,json].forEach(c=>{c.width=c.height=1;});},
  };
}
