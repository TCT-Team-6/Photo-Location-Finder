import type { LoupePoint } from './loupe-dwell';

export type ExamplePhoto = {
  id: string; title: string; image: string; original_filename: string;
  original_width: number; original_height: number; served_width: number; served_height: number;
  source: string; place: string; gps: [number, number]; gps_status: string;
  elevation_approx_m: number | null; capture: string; provenance: string; exif_status: string;
  exif: Record<string, unknown>; clue_status: string; pixel_status: string;
};
export type ImageRegion = { id: string; label: string; priority: number; polygon: number[][]; clues: Record<string, unknown> };
export type RegionMap = { coordinate_system: string; authorship: string; regions: ImageRegion[] };
export type PixelStats = { pixel_xy: number[]; avg_rgb: number[]; hex: string; brightness: number; dominant_colors: string[]; edge_density: number };
export type RegionReading = { record: Record<string, unknown>; binary: string[]; stats: PixelStats; region: ImageRegion | undefined };

/** Exact center-cover mapping, then normalized remap to ORIGINAL pixels. */
export function coverToImage(point: LoupePoint, viewport: { width: number; height: number }, served: { width: number; height: number }, original = served): LoupePoint {
  const scale = Math.max(viewport.width / served.width, viewport.height / served.height);
  const sx = (point.x + (served.width * scale - viewport.width) / 2) / scale;
  const sy = (point.y + (served.height * scale - viewport.height) / 2) / scale;
  return { x: Math.max(0, Math.min(original.width - 1, sx / served.width * original.width)), y: Math.max(0, Math.min(original.height - 1, sy / served.height * original.height)) };
}
export function pointInPolygon(x: number, y: number, polygon: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function regionAt(point: LoupePoint, photo: Pick<ExamplePhoto, 'original_width' | 'original_height'>, regions: ImageRegion[]) {
  return regions.filter((region) => pointInPolygon(point.x / photo.original_width, point.y / photo.original_height, region.polygon)).sort((a, b) => b.priority - a.priority)[0];
}
const hex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
/** Metrics over a regularly sampled circular footprint, not model outputs. */
export function measurePixels(pixels: Uint8ClampedArray, width: number, height: number, center: LoupePoint, footprint?: { x: number; y: number; radius: number }): { stats: PixelStats; binary: string[] } {
  const stride = Math.max(1, Math.floor(Math.sqrt(width * height / 4096)));
  const bins = new Map<string, { count: number; sum: number[] }>();
  const sum = [0, 0, 0], bytes: number[] = [];
  let count = 0, edges = 0, pairs = 0, luminance = 0;
  for (let y = 0; y < height; y += stride) for (let x = 0; x < width; x += stride) {
    const cx = footprint?.x ?? width / 2, cy = footprint?.y ?? height / 2;
    const rx = footprint?.radius ?? Math.max(1, width / 2), ry = footprint?.radius ?? Math.max(1, height / 2);
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
    const at = (y * width + x) * 4;
    const rgb = [pixels[at], pixels[at + 1], pixels[at + 2]];
    rgb.forEach((value, channel) => { sum[channel] += value; });
    bytes.push(...rgb);
    const light = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    luminance += light;
    const key = rgb.map((value) => Math.floor(value / 32)).join(',');
    const bin = bins.get(key) ?? { count: 0, sum: [0, 0, 0] };
    bin.count++; rgb.forEach((value, channel) => { bin.sum[channel] += value; }); bins.set(key, bin);
    if (x + stride < width) {
      const next = at + stride * 4;
      const nextLight = pixels[next] * .2126 + pixels[next + 1] * .7152 + pixels[next + 2] * .0722;
      if (Math.abs(nextLight - light) > 24) edges++;
      pairs++;
    }
    count++;
  }
  const avg = sum.map((value) => Math.round(value / Math.max(1, count)));
  const binary = Array.from({ length: 18 }, (_, row) => Array.from({ length: 4 }, (_, column) => (bytes[(row * 4 + column) % Math.max(1, bytes.length)] ?? 0).toString(2).padStart(8, '0')).join(' '));
  return {
    stats: { pixel_xy: [Math.round(center.x), Math.round(center.y)], avg_rgb: avg, hex: hex(avg), brightness: Number((luminance / Math.max(1, count) / 255).toFixed(3)), dominant_colors: [...bins.values()].sort((a, b) => b.count - a.count).slice(0, 3).map((bin) => hex(bin.sum.map((value) => value / bin.count))), edge_density: Number((edges / Math.max(1, pairs)).toFixed(3)) },
    binary,
  };
}
export function readingRecord(photo: ExamplePhoto, region: ImageRegion | undefined, stats: PixelStats) {
  if (!Array.isArray(photo.gps) || photo.gps.length !== 2 || !photo.gps.every(Number.isFinite)) throw new Error('Example GPS must be supplied explicitly.');
  return {
    region: region?.label ?? 'unclassified',
    ...stats,
    ...(region?.label === 'person' ? { subject: 'person — not analyzed' } : region?.clues ?? { clue: 'no authored geolocation clue in this area' }),
    gps: photo.gps,
    gps_status: photo.gps_status,
    capture: photo.capture,
    provenance: photo.provenance,
    clue_status: photo.clue_status,
  };
}
export function createPixelProbe(image: HTMLImageElement, photo: ExamplePhoto, regions: ImageRegion[]) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Pixel sampling unavailable.');
  context.drawImage(image, 0, 0);
  return (point: LoupePoint, viewport: { width: number; height: number }, radius: number): RegionReading => {
    const served = { width: canvas.width, height: canvas.height };
    const original = { width: photo.original_width, height: photo.original_height };
    const source = coverToImage(point, viewport, served);
    const center = coverToImage(point, viewport, served, original);
    const scale = Math.max(viewport.width / canvas.width, viewport.height / canvas.height);
    const half = Math.max(8, Math.round(radius / scale));
    const left = Math.max(0, Math.min(canvas.width - 2, Math.floor(source.x - half)));
    const top = Math.max(0, Math.min(canvas.height - 2, Math.floor(source.y - half)));
    const width = Math.max(1, Math.min(canvas.width, Math.ceil(source.x + half)) - left);
    const height = Math.max(1, Math.min(canvas.height, Math.ceil(source.y + half)) - top);
    const { stats, binary } = measurePixels(context.getImageData(left, top, width, height).data, width, height, center, { x: source.x - left, y: source.y - top, radius: half });
    const region = regionAt(center, photo, regions);
    return { stats, binary, region, record: readingRecord(photo, region, stats) };
  };
}
