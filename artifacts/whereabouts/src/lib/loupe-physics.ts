export type SpringAxis = { position: number; velocity: number };
/** Semi-implicit spring integration; long tab/background deltas cannot explode. */
export function stepLoupeSpring(axis: SpringAxis, target: number, delta: number): SpringAxis {
  const dt = Math.min(Math.max(delta, 0), 1 / 30);
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  let { position, velocity } = axis;
  for (let i = 0; i < steps; i += 1) {
    const h = dt / steps;
    velocity += ((target - position) * 155 - velocity * 19) * h;
    position += velocity * h;
  }
  return { position, velocity };
}
export function sampleBinary(seed: number, row: number, column: number): string {
  let value = (Math.imul(Math.floor(seed), 1664525) + Math.imul(row + 1, 1013904223) + column * 7919) >>> 0;
  value ^= value >>> 13;
  return (value >>> 0).toString(2).padStart(32, '0').slice(0, 8);
}
