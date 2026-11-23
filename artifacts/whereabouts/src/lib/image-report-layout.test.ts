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
test('image report orders evidence/map first, full-width ranked candidates second, safety last',()=>{
  const source=readFileSync(new URL('../components/image-geolocation-report.tsx',import.meta.url),'utf8');
  const primary=source.indexOf('className="geo-report-primary"'),photo=source.indexOf('<SavedOriginal'),notes=source.indexOf('Scene notes'),evidence=source.indexOf('Visual evidence'),map=source.indexOf('<GeographicConfidenceMap'),list=source.indexOf('className="geo-candidates"'),health=source.indexOf('<HealthUrgencyCard');
  assert.ok(primary<photo&&photo<notes&&notes<evidence&&evidence<map&&map<list&&list<health);
  assert.match(source,/<ol className="geo-candidate-list"/);
  assert.match(source,/index===0&&<InstrumentView kind="leadpaper"/);
  assert.match(source,/onClick=\{\(\)=>onSelect\(index\)\}/);
  for(const action of ['button-refresh-location-leads','button-copy-summary','button-retry-report-photo','button-retry-image-analysis','link-best-guess-map'])assert.ok(source.includes(action));
  assert.doesNotMatch(source,/<Canvas|\bfetch\(/);
});
test('geographic surface is the existing Leaflet/tile stack with a geodesic raster, not decorative markers or image uploads',()=>{
  const source=readFileSync(new URL('../components/geographic-confidence-map.tsx',import.meta.url),'utf8');
  assert.match(source,/from 'react-leaflet'/);assert.match(source,/<MapContainer/);
  assert.match(source,/map\.containerPointToLatLng/);assert.match(source,/geographicFieldValue/);
  assert.match(source,/ctx\.putImageData/);assert.match(source,/\.46\*255/);
  assert.doesNotMatch(source,/CircleMarker|<Circle|<Marker|createRadialGradient|normalize\(|\bfetch\(/);
  assert.match(source,/not a measured search radius/);
  assert.match(source,/never normalized to total 100%/);
  assert.match(source,/referrerPolicy="strict-origin"/);
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
