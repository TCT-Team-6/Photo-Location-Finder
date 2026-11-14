import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

/** Self-contained real-image test: no API, auth, upload or running app required. */
test('five real forest positions produce different RGB binary and region JSON', async ({ page }) => {
  const file = (relative: string) => new URL(relative, import.meta.url);
  const source = ts.transpileModule(readFileSync(file('../src/lib/loupe-image-data.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.ES2020 },
  }).outputText;
  const photo = JSON.parse(readFileSync(file('../public/data/example-photo.json'), 'utf8'));
  const regions = JSON.parse(readFileSync(file('../public/data/regions.json'), 'utf8'));
  const image = `data:image/webp;base64,${readFileSync(file('../public/examples/mariposa-grove.webp')).toString('base64')}`;
  await page.setContent('<main>Local photograph pixel verification</main>');
  const result = await page.evaluate(async ({ source, photo, regions, image }) => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const { createPixelProbe } = await import(/* @vite-ignore */ url);
    URL.revokeObjectURL(url);
    const photoImage = new Image(); photoImage.src = image; await photoImage.decode();
    const probe = createPixelProbe(photoImage, photo, regions.regions);
    const viewport = { width: 1100, height: 646 };
    const readings = [[.23,.235],[.12,.94],[.48,.35],[.59,.27],[.8,.94]].map(([x,y]) =>
      probe({ x: x * viewport.width, y: y * viewport.height }, viewport, 60));
    return {
      binaryCount: new Set(readings.map((reading: { binary: string[] }) => reading.binary.join(''))).size,
      jsonCount: new Set(readings.map((reading: { record: object }) => JSON.stringify(reading.record))).size,
      regionIds: readings.map((reading: { region: { id: string } }) => reading.region.id),
      records: readings.map((reading: { record: Record<string, unknown> }) => reading.record),
    };
  }, { source, photo, regions, image });
  expect(result.binaryCount).toBe(5);
  expect(result.jsonCount).toBe(5);
  expect(result.regionIds).toEqual(['lichen_left','left_fire_scar','center_bark','background_forest','forest_floor']);
  for (const record of result.records) {
    expect(record.gps).toEqual([37.5039,-119.6043]);
    expect(record.gps_status).toContain('not verified');
    expect(record.capture).toBe(photo.capture);
    expect(record.avg_rgb).toHaveLength(3);
    expect(record.hex).toMatch(/^#[0-9A-F]{6}$/);
  }
});
