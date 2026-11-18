import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=process.argv[2];
if(!source)throw new Error('Pass the JSON returned by await window.InstrumentKitExport() from ?instrument-kit=export at a 1500×1500 viewport.');
const frames=JSON.parse(await readFile(source,'utf8')),manifest={};
const expected=['dial','shutter','keys','voice','swatch','lever','rocker','tally','drawer','loupe','tray','print'];
const missing=expected.filter(kind=>!frames.some(frame=>frame.kind===kind));
if(missing.length)throw new Error(`Missing real model frames: ${missing.join(', ')}. Use a 1500×1500 viewport, wait for fonts and every model to render, then export again.`);
await mkdir(path.join(root,'public/instrument-renders'),{recursive:true});
for(const frame of frames){
  if(frame.revision!=='aligned-selector-v3')throw new Error('Stale geometry or framing. Export fresh actual scenes from the current InstrumentKit before saving PNGs.');
  if(!expected.includes(frame.kind)||!frame.png.startsWith('data:image/png;base64,'))throw new Error('Only actual instrument PNG frame exports are accepted.');
  const bytes=Buffer.from(frame.png.split(',')[1],'base64');
  if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('The frame is not a PNG. Renamed SVGs are not accepted.');
  const name=`${frame.kind}.png`;await writeFile(path.join(root,'public/instrument-renders',name),bytes);manifest[frame.kind]=name;
}
await writeFile(path.join(root,'src/lib/instrument-pngs.ts'),`import type {InstrumentKind} from '@/components/physical-models';\n/** Actual InstrumentKit WebGL scene renders. Do not replace with drawn proxies. */\nexport const instrumentPNGRevision:string='aligned-selector-v3';\nexport const instrumentPNGs:Partial<Record<InstrumentKind,string>>=${JSON.stringify(manifest,null,2)};\n`);
console.log(`Saved ${Object.keys(manifest).length} real scene PNGs.`);
