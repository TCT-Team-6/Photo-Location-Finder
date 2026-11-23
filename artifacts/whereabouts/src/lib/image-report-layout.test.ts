import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {isImageGeolocationReport} from './image-report-scope';

test('new layout is limited to image geolocation, preserving video, fake-news and legacy source reports',()=>{
  assert.equal(isImageGeolocationReport({desk:'original',contentType:'image/jpeg'}),true);
  assert.equal(isImageGeolocationReport({desk:'recreation',contentType:'image/jpeg',analysis:{media_type:'image'}}),true);
  assert.equal(isImageGeolocationReport({desk:'journalism',contentType:'image/png'}),true);
  assert.equal(isImageGeolocationReport({desk:'original',contentType:'video/mp4'}),false);
  assert.equal(isImageGeolocationReport({desk:'fake-news',contentType:'image/png'}),false);
  assert.equal(isImageGeolocationReport({desk:'recreation',contentType:'image/jpeg'}),false);
  assert.equal(isImageGeolocationReport({desk:'recreation',analysis:null}),false);
});
test('image report puts pipeline, then map beside ranked list on the first screen, then evidence and safety',()=>{
  const source=readFileSync(new URL('../components/image-geolocation-report.tsx',import.meta.url),'utf8');
  const pipeline=source.indexOf('<PipelineBar'),top=source.indexOf('className="rp-top"'),map=source.indexOf('<RankedPlacesMap'),list=source.indexOf('<RankedPlacesList'),photo=source.indexOf('<SavedOriginal key'),notes=source.indexOf('Scene notes'),evidence=source.indexOf('Visual evidence'),health=source.indexOf('<HealthUrgencyCard'),trail=source.indexOf('id="ai-decision-trail"');
  assert.ok(pipeline<top&&top<map&&map<list&&list<photo&&photo<notes&&notes<evidence&&evidence<health&&health<trail);
  assert.match(source,/targetId="ai-decision-trail"/);
  for(const action of ['button-refresh-location-leads','button-copy-summary','button-retry-report-photo','button-retry-image-analysis','link-best-guess-map'])assert.ok(source.includes(action));
  assert.doesNotMatch(source,/<Canvas|\bfetch\(/);
  const css=readFileSync(new URL('../styles/ranked-results.css',import.meta.url),'utf8');
  assert.match(css,/grid-template-areas:"map" "list" "photo"/);
  assert.match(css,/@media \(min-width:768px\)\{\s*\.rp-top\{grid-template-columns:[^}]*grid-template-areas:"map list" "photo list"/);
});
test('shared map uses Leaflet numbered pins, a score-weighted heat raster and a legend',()=>{
  const source=readFileSync(new URL('../components/results/ranked-places-map.tsx',import.meta.url),'utf8');
  assert.match(source,/from 'react-leaflet'/);assert.match(source,/<MapContainer/);
  assert.match(source,/map\.containerPointToLatLng/);assert.match(source,/p\.unit \* localFieldKernel/);
  assert.match(source,/ctx\.putImageData/);assert.match(source,/heatColor\(v\)/);
  assert.match(source,/pinIcon\(e\.index \+ 1/);
  for(const text of ['More likely','Less likely','Pin number = rank in list','Walking-distance circle'])assert.ok(source.includes(text));
  assert.doesNotMatch(source,/normalize\(|\bfetch\(/);
  assert.match(source,/referrerPolicy="strict-origin"/);
  const report=readFileSync(new URL('../components/image-geolocation-report.tsx',import.meta.url),'utf8');
  assert.match(report,/not a measured search radius/);
  assert.match(report,/never normalized to total 100%/);
  assert.ok(report.indexOf('Map tiles are requested')>report.indexOf('<HealthUrgencyCard'));
});
test('paper is actual shared Three.js geometry; HTML remains above it and text sizes are not frozen',()=>{
  const models=readFileSync(new URL('../components/physical-models.tsx',import.meta.url),'utf8'),css=readFileSync(new URL('../styles/image-report.css',import.meta.url),'utf8');
  assert.match(models,/case'leadpaper':model=<Solid size=/);
  assert.match(models,/name="Paper" radius=\{\.4\}/);
  assert.match(css,/\.geo-lead-content\{position:relative;z-index:2/);
  assert.doesNotMatch(css,/box-shadow|perspective:|rotateX|translateZ|font-size:[^;}]*!important/);
});
test('full in-app details/public reference/privacy actions remain available for every selected lead',()=>{
  const source=readFileSync(new URL('../components/location-lead-details.tsx',import.meta.url),'utf8');
  for(const action of ['section-photo-references-','link-photo-reference-','link-map-candidate-','link-location-report-','photoSearchStatus','Replit AI vision fallback','noopener noreferrer','referrerPolicy="no-referrer"'])assert.ok(source.includes(action));
  assert.match(source,/lead\.rationale/);assert.match(source,/lead\.clues/);
  assert.match(source,/onError=\{\(\)=>setFailed\(true\)\}/);
});
