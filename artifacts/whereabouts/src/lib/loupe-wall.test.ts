import { test } from 'node:test';
import assert from 'node:assert/strict';
import photoJson from '../../public/data/example-photo.json';
import regionsJson from '../../public/data/regions.json';
import { measurePixels, regionAt, readingRecord, type ExamplePhoto, type RegionMap } from './loupe-image-data';
import { createDataWall,rgbBit, streamCell, wallGlyphLayout, wallObjects, wallStream } from './loupe-wall';
import { GLASS_MAGNIFICATION } from './lens-feedback';
test('wall font stays positive and legible with negative top-baseline, zero and invalid metrics',()=>{
  for(const [ascent,descent] of [[-.625,8.625],[0,0],[NaN,NaN],[Infinity,0],[7,1],[8,0],[3,0],[16,2]]){
    const layout=wallGlyphLayout({actualBoundingBoxAscent:ascent,actualBoundingBoxDescent:descent});
    assert.ok(Number.isFinite(layout.fontSize)&&layout.fontSize>=1.5&&layout.fontSize<=27);
    assert.ok(layout.glyphHeight*GLASS_MAGNIFICATION>=18&&layout.glyphHeight*GLASS_MAGNIFICATION<=22);
    assert.ok(Math.ceil(900/Math.max(layout.fontSize+1,layout.glyphHeight+2))>0);
  }
});
const photo=photoJson as ExamplePhoto,regions=(regionsJson as RegionMap).regions;
test('actual wall paint uses a bounded supersampled glyph window, real bits, JSON characters and cleans up its raster',()=>{
  class Context {
    font='10px monospace';fillStyle='';textBaseline='top';globalAlpha=1;scale=1;
    text:{value:string;font:number;scale:number}[]=[];
    setTransform(a:number){this.scale=a;}fillRect(){}drawImage(){}
    measureText(){const size=parseFloat(this.font);return{width:size*.6,actualBoundingBoxAscent:size*.8,actualBoundingBoxDescent:0};}
    getImageData(){return{data:new Uint8ClampedArray(64).fill(93)};}
    fillText(value:string){this.text.push({value,font:parseFloat(this.font),scale:this.scale});}
  }
  class Canvas {width=1;height=1;context=new Context();getContext(){return this.context;}}
  const oldDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>new Canvas()}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{devicePixelRatio:2}});
  try{
    const wall=createDataWall({naturalWidth:4,naturalHeight:4} as HTMLImageElement,'monospace','#242723','#f4f4f2');
    wall.resize(200,150);
    const stats=measurePixels(new Uint8ClampedArray(64).fill(93),4,4,{x:100,y:80}).stats,region=regions[0];
    const reading={stats,region,record:readingRecord(photo,region,stats),binary:['01011101']};
    wall.paint(0,'binary',0,{x:100,y:80},16,reading,photo,regions,false);
    const raster=wall.detailCanvas as unknown as Canvas,ctx=raster.context;
    assert.equal(wall.detailRatio,12);assert.ok(raster.width<=1024&&raster.width>500);
    assert.ok(ctx.text.length>10&&ctx.text.every(call=>/^[01]$/.test(call.value)));
    assert.ok(ctx.text.every(call=>call.font*call.scale*.8>=39));
    assert.ok(wall.detailRect.x<100&&wall.detailRect.x+wall.detailRect.width>100);
    ctx.text=[];wall.paint(1600,'json',1,{x:100,y:80},16,reading,photo,regions,false);
    assert.ok(ctx.text.some(call=>/[a-z]/i.test(call.value)));assert.ok(ctx.text.some(call=>call.value==='"'));
    wall.dispose();assert.equal(raster.width,1);assert.equal(raster.height,1);
  }finally{
    if(oldDocument)Object.defineProperty(globalThis,'document',oldDocument);else Reflect.deleteProperty(globalThis,'document');
    if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else Reflect.deleteProperty(globalThis,'window');
  }
});
test('each RGB cell supplies a bit from its own three actual channel bytes',()=>{
  const rgb=[64,128,192];
  assert.equal(Array.from({length:24},(_,index)=>rgbBit(rgb,index)).join(''),'010000001000000011000000');
});
test('minified objects wrap continuously, preserve full values, and mark only center keys red',()=>{
  const first={region:'lichen',gps:[37.5039,-119.6043],capture:'late spring or summer'};
  const stream=wallStream([first,{region:'rear_bark'},first,first,{type:'pixels'}]);
  assert.equal(stream.text.includes('\n'),false);assert.equal(stream.text.includes(': '),false);
  assert.ok(stream.text.includes('late spring or summer'));
  assert.ok(!stream.text.includes(`${JSON.stringify(first)}${JSON.stringify(first)}`));
  const cells=Array.from({length:stream.text.length*3},(_,i)=>streamCell(stream,i));
  assert.equal(cells.some(cell=>!cell.char),false);
  assert.equal(cells.slice(0,stream.text.length).map(cell=>cell.char).join(''),stream.text);
  const key=stream.text.indexOf('"gps"'),value=stream.text.indexOf('37.5039');
  assert.equal(cells[key].red,true);assert.equal(cells[value].red,false);
});
test('five region positions create different center-first JSON walls with nearest regions, GPS, capture and real metrics preserved',()=>{
  const samples=[[.23,.235],[.12,.94],[.48,.35],[.59,.27],[.8,.94]];
  const signatures=new Set<string>();
  for(const[x,y]of samples){
    const point={x:x*photo.original_width,y:y*photo.original_height};
    const stats=measurePixels(new Uint8ClampedArray(64).fill(Math.floor(x*255)),4,4,point).stats;
    const region=regionAt(point,photo,regions),record=readingRecord(photo,region,stats),reading={region,record,stats,binary:['01010101']};
    const objects=wallObjects(reading,photo,regions),stream=wallStream(objects);
    signatures.add(JSON.stringify(objects[0]));
    assert.deepEqual(objects[0].gps,[37.5039,-119.6043]);assert.ok(stream.text.includes(photo.capture));
    assert.ok(stream.text.includes('authored_nearby_region')&&stream.text.includes('live_optimized_pixels'));
    assert.equal((objects[0] as {region_id:string}).region_id,region?.id);
  }
  assert.equal(signatures.size,5);
});
