import { test } from 'node:test';
import assert from 'node:assert/strict';
import photoJson from '../../public/data/example-photo.json';
import regionJson from '../../public/data/regions.json';
import { coverToImage, measurePixels, pointInPolygon, readingRecord, regionAt, type ExamplePhoto, type RegionMap } from './loupe-image-data';
const photo = photoJson as ExamplePhoto;
const regions = (regionJson as RegionMap).regions;

test('cover mapping includes horizontal crop and maps back to original pixels', () => {
  const viewport = { width: 200, height: 200 }, served = { width: 400, height: 200 }, original = { width: 4000, height: 2000 };
  assert.deepEqual(coverToImage({ x: 0, y: 0 }, viewport, served, original), { x: 1000, y: 0 });
  assert.deepEqual(coverToImage({ x: 100, y: 100 }, viewport, served, original), { x: 2000, y: 1000 });
});
test('portrait crop and viewport center preserve the original image center', () => {
  const point = coverToImage({ x: 100, y: 200 }, { width: 200, height: 400 }, { width: 400, height: 200 }, { width: 7264, height: 4266 });
  assert.deepEqual(point, { x: 3632, y: 2133 });
});
test('authored map contains at least ten actually hittable regions; no invented sky/vehicles', () => {
  const found = new Set<string>();
  for (let x = .005; x < 1; x += .012) for (let y = .005; y < 1; y += .012) {
    const hit = regionAt({ x: x * photo.original_width, y: y * photo.original_height }, photo, regions);
    if (hit) found.add(hit.id);
  }
  assert.ok(regions.length >= 10);
  assert.ok(found.size >= 10, `Only ${found.size} distinct regions can be hit`);
  assert.equal(regions.some((region) => /sky|vehicle|building/.test(region.label)), false);
});
test('specific center-point polygon takes priority over broad trunk and lighting', () => {
  const hit = regionAt({ x: .23 * 7264, y: .235 * 4266 }, photo, regions);
  assert.equal(hit?.id, 'lichen_left');
  assert.equal(pointInPolygon(.23, .235, hit!.polygon), true);
});
test('RGB byte binary and derived metrics are measured, never pseudorandom', () => {
  const pixels = new Uint8ClampedArray(Array.from({ length: 16 }, () => [64,128,192,255]).flat());
  const { stats, binary } = measurePixels(pixels, 4, 4, { x: 123, y: 456 });
  assert.deepEqual(stats.avg_rgb, [64,128,192]);
  assert.equal(stats.hex, '#4080C0');
  assert.equal(stats.edge_density, 0);
  assert.match(binary.join(' '), /01000000 10000000 11000000/);
  assert.deepEqual(stats.pixel_xy, [123,456]);
});
test('every region JSON contains supplied GPS and capture, with explicit uncertainty', () => {
  const stats = measurePixels(new Uint8ClampedArray(64).fill(80), 4, 4, { x: 3, y: 4 }).stats;
  for (const region of regions) {
    const record = readingRecord(photo, region, stats);
    assert.deepEqual(record.gps, [37.5039,-119.6043]);
    assert.ok(record.capture);
    assert.match(record.gps_status, /approximate.*not verified/);
    assert.match(record.provenance, /not from EXIF/);
  }
});
test('a footprint clipped at an image edge keeps its true sampling center', () => {
  const pixels = new Uint8ClampedArray(Array.from({ length: 16 }, (_, index) => [(index % 4) * 40 + Math.floor(index / 4) * 10, 0, 0, 255]).flat());
  const { stats } = measurePixels(pixels, 4, 4, { x: 0, y: 0 }, { x: 0, y: 0, radius: 1 });
  assert.deepEqual(stats.avg_rgb, [17,0,0]);
});
test('person regions do not identify or analyze a person', () => {
  const stats = measurePixels(new Uint8ClampedArray(64), 4, 4, { x: 1, y: 1 }).stats;
  const record = readingRecord(photo, { id: 'person', label: 'person', priority: 100, polygon: [], clues: {} }, stats);
  assert.equal(record.subject, 'person — not analyzed');
});
