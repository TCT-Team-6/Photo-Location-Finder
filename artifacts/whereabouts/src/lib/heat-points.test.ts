import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeHeatPoints,heatOptions,heatRadiusPixels} from './heat-points';
test('heat points detect percentage scale across the entire input and clamp',()=>{
  assert.deepEqual(normalizeHeatPoints([92,0.5,-2,140].map(confidence=>({lat:47,lng:-122,confidence}))).map(p=>p.confidence),[.92,.005,0,1]);
  assert.equal(normalizeHeatPoints([{lat:47,lng:-122,confidence:.92}])[0].confidence,.92);
});
test('invalid coordinates and nonfinite scores are excluded',()=>{
  assert.equal(normalizeHeatPoints([
    {lat:NaN,lng:0,confidence:1},{lat:91,lng:0,confidence:1},
    {lat:0,lng:181,confidence:1},{lat:0,lng:0,confidence:NaN},
    {lat:90,lng:180,confidence:1},
  ]).length,1);
});
test('heat styling follows specified parameters',()=>{
  assert.equal(heatOptions.minOpacity,.4);assert.equal(heatOptions.maxZoom,1);
  assert.equal(heatOptions.gradient[1],'#DC2626');
});
test('400-meter heat footprint scales with zoom and latitude, within pixel limits',()=>{
  assert.equal(heatRadiusPixels(47,1),6);
  assert.equal(heatRadiusPixels(47,20),120);
  const expected=400/(156543.03392*Math.cos(47*Math.PI/180)/2**14);
  assert.equal(heatRadiusPixels(47,14),expected);
  assert.equal(heatRadiusPixels(47,13)*2,expected);
  assert.ok(heatRadiusPixels(60,14)>heatRadiusPixels(0,14));
});
test('viewport uses close single-point framing and shared overview rules',()=>{
  const source=readFileSync(new URL('../components/geographic-confidence-map.tsx',import.meta.url),'utf8');
  assert.match(source,/points\.length===1\)map\.setView\(points\[0\],14/);
  assert.match(source,/fitBounds\(unwrapGeographicPoints\(points\),\{padding:\[26,26\],maxZoom:15/);
  assert.match(source,/minZoom=\{1\}/);
  assert.match(source,/onClick=\{\(\)=>setOverview\(value=>value\+1\)\}/);
  const heat=readFileSync(new URL('../components/confidence-heat-layer.tsx',import.meta.url),'utf8');
  assert.match(heat,/map\.on\('zoomend moveend',updateRadius\)/);
  assert.match(heat,/map\.off\('zoomend moveend',updateRadius\)/);
  assert.match(heat,/setOptions\(\{radius,blur:radius\*0\.8\}\)\.redraw\(\)/);
});
