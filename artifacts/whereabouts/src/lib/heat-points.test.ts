import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHeatPoints,heatOptions} from './heat-points';
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
  assert.equal(heatOptions.radius,28);assert.equal(heatOptions.blur,22);
  assert.equal(heatOptions.gradient[1],'#DC2626');
});
