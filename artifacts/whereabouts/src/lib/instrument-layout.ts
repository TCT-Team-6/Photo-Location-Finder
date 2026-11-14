import type { LoupePoint } from './loupe-dwell';
export function instrumentLayout(width: number, height: number) {
  const mobile = width < 768;
  const panelWidth = mobile ? width : Math.max(280, Math.min(380, width * .22));
  const photoWidth = mobile ? width : width - panelWidth;
  const photoHeight = mobile ? Math.max(1, height - 160) : height;
  const dockRadius=mobile?33:Math.min(90,panelWidth*.29);
  return {
    width, height, mobile, panelWidth, photoWidth, photoHeight,
    dock: { x: mobile ? width * .5 : photoWidth + panelWidth * .5, y: mobile ? photoHeight + 48 : height * .27 },
    dockRadius,
    heldRadius: dockRadius*1.1,
  };
}
export type InstrumentLayout = ReturnType<typeof instrumentLayout>;
export const overPhoto = (point: LoupePoint, layout: InstrumentLayout) => point.x >= 0 && point.x < layout.photoWidth && point.y >= 0 && point.y < layout.photoHeight;
export function scrollLight(progress: number) {
  const p = Math.max(0, Math.min(1, progress)), high = Math.sin(p * Math.PI);
  const x = (p * 2 - 1) * .85, y = -1, z = .65 + high * 1.15;
  return { x, y, z, castX: x===0?0:-x / z * 18, castY: -y / z * 18, blur: 16 - high * 11, angle: 180 + x * 50, holeX: -x, holeY: 1, glintX: 50 + x * 35, glintY: 12 };
}
export function applyScrollLight(element: HTMLElement, progress: number) {
  const light = scrollLight(progress);
  const values: Record<string,string> = {
    '--light-x': `${light.x}`, '--light-y': `${light.y}`, '--light-z': `${light.z}`,
    '--cast-x': `${light.castX}px`, '--cast-y': `${light.castY}px`, '--cast-blur': `${light.blur}px`,
    '--hole-x': `${light.holeX}px`, '--hole-y': `${light.holeY}px`, '--light-angle': `${light.angle}deg`,
    '--glint-x': `${light.glintX}%`, '--glint-y': `${light.glintY}%`,
  };
  Object.entries(values).forEach(([key,value]) => element.style.setProperty(key,value));
  element.dataset.lightProgress = progress.toFixed(3);
  element.dispatchEvent(new CustomEvent('whereabouts:light', { detail: progress }));
}
