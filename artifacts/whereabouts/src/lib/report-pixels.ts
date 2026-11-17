/** Six-times RGB emitter raster, sourced only from the selected local image. */
export function paintRgbLoupe(canvas: HTMLCanvasElement, image: HTMLImageElement, now: number, reduced: boolean) {
  const context = canvas.getContext('2d'); if (!context) return;
  const source = document.createElement('canvas'); source.width = source.height = 13;
  const s = source.getContext('2d', { willReadFrequently: true }); if (!s) return;
  const t = reduced ? .4 : (Math.sin(now / 6000) + 1) / 2, w = image.naturalWidth, h = image.naturalHeight;
  s.drawImage(image, w * (.2 + t * .45), h * (.2 + (1 - t) * .4), Math.max(1, w / 18), Math.max(1, h / 18), 0, 0, 13, 13);
  const data = s.getImageData(0, 0, 13, 13).data;
  context.fillStyle = '#151914'; context.fillRect(0, 0, 78, 78);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) for (let ch = 0; ch < 3; ch++) {
    const rgb = [0, 0, 0]; rgb[ch] = data[(y * 13 + x) * 4 + ch];
    context.fillStyle = `rgb(${rgb.join(',')})`; context.fillRect(x * 6 + ch * 2, y * 6, 1.7, 5.6);
  }
}
