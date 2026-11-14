import { stepLoupeSpring, type SpringAxis } from './loupe-physics';
import type { LoupePoint } from './loupe-dwell';
import { HELD_LIFT } from './lens-feedback';
export type ToolMode = 'docked' | 'held' | 'returning';
const axis = (position: number): SpringAxis => ({ position, velocity: 0 });
export const REST_ANGLE = 8 * Math.PI / 180;
export function createToolMotion(dock: LoupePoint) {
  return { mode: 'docked' as ToolMode, dock, target: { ...dock }, x: axis(dock.x), y: axis(dock.y), lift: axis(28), tiltX: axis(0), tiltY: axis(0), swing: axis(0), roll: axis(REST_ANGLE), returnedAt: 0, returnElapsed: 0, hover: null as LoupePoint | null };
}
export type ToolMotion = ReturnType<typeof createToolMotion>;
export function pickUpTool(m: ToolMotion, point: LoupePoint) { m.mode = 'held'; m.target = { ...point }; m.returnElapsed = 0; }
export function returnTool(m: ToolMotion) { m.mode = 'returning'; m.target = { ...m.dock }; m.returnElapsed = 0; }
export function advanceTool(m: ToolMotion, delta: number, reduced = false) {
  const dt = Math.min(1 / 10, Math.max(0, delta));
  const returning = m.mode === 'returning', held = m.mode === 'held';
  const target = held ? m.target : m.dock;
  const hover=m.hover??m.dock;
  const near = m.hover!==null && Math.hypot(hover.x - m.dock.x, hover.y - m.dock.y) < 180;
  const lift = held ? HELD_LIFT : 28 + (near && !returning ? 4 : 0);
  const clamp = (n: number, max: number) => Math.max(-max, Math.min(max,n));
  if (reduced) {
    m.x = axis(target.x); m.y = axis(target.y); m.lift = axis(lift); m.tiltX = axis(0); m.tiltY = axis(0); m.swing = axis(0); m.roll = axis(REST_ANGLE);
    if (returning) { m.mode = 'docked'; m.hover=null; m.returnedAt++; }
    return;
  }
  m.x = stepLoupeSpring(m.x,target.x,dt,returning ? 220 : 170,returning ? 23 : 22);
  m.y = stepLoupeSpring(m.y,target.y,dt,returning ? 220 : 170,returning ? 23 : 22);
  m.lift = stepLoupeSpring(m.lift,lift,dt);
  const active=held||returning,limit = active ? Math.PI / 30 : Math.PI / 45;
  m.tiltX = stepLoupeSpring(m.tiltX, active ? clamp(-m.y.velocity * .00017,limit) : clamp((hover.y-m.dock.y)*.00010,limit),dt);
  m.tiltY = stepLoupeSpring(m.tiltY, active ? clamp(m.x.velocity * .00017,limit) : clamp((hover.x-m.dock.x)*.00010,limit),dt);
  m.tiltX.position=clamp(m.tiltX.position,limit);m.tiltY.position=clamp(m.tiltY.position,limit);
  m.swing = stepLoupeSpring(m.swing, held || returning ? clamp(-m.x.velocity*.00025,.14) : 0,dt,100,16);
  m.roll = stepLoupeSpring(m.roll,REST_ANGLE,dt,170,22);
  if (returning) {
    m.returnElapsed += Math.max(0,Math.min(1,delta));
    if (m.returnElapsed >= .8) {
      m.mode = 'docked'; m.x=axis(m.dock.x);m.y=axis(m.dock.y);m.lift=axis(28);
      m.tiltX=axis(0);m.tiltY=axis(0);m.swing=axis(0);m.roll=axis(REST_ANGLE);m.hover=null;m.returnedAt++;
    }
  }
}
