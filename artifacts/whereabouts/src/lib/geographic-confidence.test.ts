import assert from 'node:assert/strict';
import test from 'node:test';
import {coordinatesFromMapsUrl,EARTH_RADIUS_KM,FIELD_SUPPORT_KM,fieldBounds,geographicFieldValue,greatCircleKm,localFieldKernel,mapTopCandidates,modelScoreUnit,rankCandidates,unwrapGeographicPoints,validCoordinates,type ConfidenceField} from './geographic-confidence';

const close=(actual:number,expected:number,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} should be within ${tolerance} of ${expected}`);
test('coordinate extraction accepts explicit saved decimal pairs only, including zero and dateline',()=>{
  assert.deepEqual(coordinatesFromMapsUrl('https://www.google.com/maps?api=1&query=48.8566%2C2.3522'),[48.8566,2.3522]);
  assert.deepEqual(coordinatesFromMapsUrl('https://maps.google.com/?q=0,0'),[0,0]);
  assert.deepEqual(coordinatesFromMapsUrl('https://maps.google.com/?q=-17.8,179.9'),[-17.8,179.9]);
  assert.deepEqual(coordinatesFromMapsUrl('https://maps.google.com/?q=90,-180'),[90,-180]);
  for(const value of ['https://maps.google.com/?q=Paris','https://maps.google.com/?query=London,UK','https://maps.google.com/maps/@48.8,2.3,10z','https://maps.google.com/?q=91,0','https://maps.google.com/?q=0,181','https://maps.google.com/?q=NaN,0','https://maps.google.com/?q=Infinity,0','https://maps.google.com/?q=51,0%20London','javascript:alert(1)','not a URL'])assert.equal(coordinatesFromMapsUrl(value),null);
  assert.equal(validCoordinates(NaN,0),false);assert.equal(validCoordinates(0,Infinity),false);
});
test('ranking is descending across existing score formats, stable at ties and never mutates data',()=>{
  const leads=[{id:'a',confidence:.74},{id:'b',confidence:91},{id:'c',confidence:.91},{id:'invalid',confidence:NaN},{id:'low',confidence:.18}];
  const original=[...leads];
  assert.deepEqual(rankCandidates(leads).map(lead=>lead.id),['b','c','a','low','invalid']);
  assert.deepEqual(leads,original);
  close(modelScoreUnit(87)!, .87);close(modelScoreUnit(.87)!, .87);
  assert.equal(modelScoreUnit(1),1);assert.equal(modelScoreUnit(0),0);
  for(const invalid of[-.1,101,NaN,Infinity])assert.equal(modelScoreUnit(invalid),null);
});
test('great-circle distances use geographic units, latitude and the short antimeridian crossing',()=>{
  close(greatCircleKm([0,0],[0,1]),111.1950802335329,1e-7);
  close(greatCircleKm([0,179],[0,-179]),222.3901604670658,1e-7);
  close(greatCircleKm([60,0],[60,1]),55.5970108648969,1e-7);
  close(greatCircleKm([0,0],[0,180]),Math.PI*EARTH_RADIUS_KM);
  close(greatCircleKm([48.8566,2.3522],[51.5074,-.1278]),343.56,.1);
  assert.equal(greatCircleKm([20,40],[20,40]),0);
});
test('compact smooth field has exact zero outside local support, monotone falloff and a soft boundary',()=>{
  assert.equal(localFieldKernel(0),1);
  close(localFieldKernel(FIELD_SUPPORT_KM/2),Math.exp(-4/3));
  const halfMaximum=FIELD_SUPPORT_KM*Math.sqrt(Math.log(2)/(4+Math.log(2)));
  close(localFieldKernel(halfMaximum),.5);
  let previous=1;
  for(let distance=1;distance<=FIELD_SUPPORT_KM;distance++){const next=localFieldKernel(distance);assert.ok(next<=previous);assert.ok(next>=0);previous=next;}
  assert.ok(localFieldKernel(FIELD_SUPPORT_KM-1)<1e-12);
  for(const distance of[FIELD_SUPPORT_KM,FIELD_SUPPORT_KM+1,9000,NaN,Infinity,-1])assert.equal(localFieldKernel(distance),0);
});
test('independent confidence values retain their magnitude: no normalization, addition or intercontinental bridges',()=>{
  const fields:ConfidenceField[]=[{position:[0,0],score:.9,index:0},{position:[0,8],score:.8,index:1}];
  close(geographicFieldValue([0,0],fields),.9);close(geographicFieldValue([0,8],fields),.8);
  assert.equal(geographicFieldValue([0,4],fields),0);
  close(geographicFieldValue([0,0],[...fields,{position:[0,0],score:.7,index:2}]),.9);
  // Stronger scores increase both peak intensity and the display spread.
  assert.ok(geographicFieldValue([0,.2],[fields[0]])/geographicFieldValue([0,.2],[{...fields[0],score:.5}])>1.8);
  const distant:ConfidenceField[]=[{position:[40.7128,-74.006],score:.91,index:0},{position:[48.8566,2.3522],score:.84,index:1},{position:[35.6762,139.6503],score:.79,index:2}];
  assert.equal(geographicFieldValue([45,-35],distant),0);
  assert.equal(geographicFieldValue([0,0],[]),0);
});
test('kernel remains geographically continuous across dateline world copies without a globe-spanning field',()=>{
  const field:ConfidenceField={position:[0,179.8],score:.86,index:0};
  close(geographicFieldValue([0,-180.2],[field]),.86);
  assert.ok(geographicFieldValue([0,-179.9],[field])>.7);
  assert.equal(geographicFieldValue([0,0],[field]),0);
  const points=unwrapGeographicPoints([[0,179],[0,-179]]);
  close(Math.abs(points[0][1]-points[1][1]),2);
  const bounds=fieldBounds([[0,179],[0,-179]]);
  assert.ok(Math.max(...bounds.map(point=>point[1]))-Math.min(...bounds.map(point=>point[1]))<6);
});
test('geographic fitting handles normal and antimeridian candidates without reordering or altering latitude',()=>{
  for(const input of [[[40,-74],[49,2],[36,140]],[[60,170],[61,-178],[62,179]],[[0,0],[0,0]]] as [number,number][][]){
    const output=unwrapGeographicPoints(input);
    assert.deepEqual(output.map(point=>point[0]),input.map(point=>point[0]));
    for(let i=0;i<input.length;i++)close(greatCircleKm(input[i],output[i]),0,1e-6);
  }
});
test('unmappable/missing/unsupported leads stay honest; fourth lead never silently replaces an unmappable top-three lead',()=>{
  const entries=mapTopCandidates([
    {mapsUrl:'https://maps.google.com/?q=Paris',confidence:.91},
    {mapsUrl:'https://maps.google.com/?q=89,0',confidence:.85},
    {mapsUrl:'https://maps.google.com/?q=40,2',confidence:NaN},
    {mapsUrl:'https://maps.google.com/?q=51,0',confidence:.5},
  ]);
  assert.equal(entries.length,3);
  assert.deepEqual(entries.map(entry=>entry.reason),['missing_coordinates','projection_limit','missing_score']);
  assert.deepEqual(mapTopCandidates([]),[]);
  assert.equal(mapTopCandidates([{mapsUrl:'https://maps.google.com/?q=0,0',confidence:0}])[0].reason,null);
});
test('invalid field coordinates, scores and sample latitudes cannot contaminate the raster',()=>{
  assert.equal(geographicFieldValue([0,0],[{position:[91,0],score:.9,index:0}]),0);
  assert.equal(geographicFieldValue([0,0],[{position:[0,0],score:NaN,index:0}]),0);
  assert.equal(geographicFieldValue([NaN,0],[{position:[0,0],score:.9,index:0}]),0);
});
