export type SpringAxis = { position: number; velocity: number };
/** Semi-implicit spring integration; long tab/background deltas cannot explode. */
export function stepLoupeSpring(axis: SpringAxis, target: number, delta: number, stiffness = 170, damping = 22): SpringAxis {
  const dt = Math.min(Math.max(delta, 0), 1 / 10);
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  let { position, velocity } = axis;
  for (let i = 0; i < steps; i += 1) {
    const h = dt / steps;
    velocity += ((target - position) * stiffness - velocity * damping) * h;
    position += velocity * h;
  }
  return { position, velocity };
}
