/** Only reject failures for formats browsers can normally decode. */
export async function imageDecodeError(file: File): Promise<string | null> {
  if (!/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(file.name) &&
      !/^image\/(jpeg|png|webp|gif|bmp|avif)$/.test(file.type)) return null;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Empty image");
    return null;
  } catch {
    return `${file.name}: This file looks damaged — try exporting it again.`;
  } finally { URL.revokeObjectURL(url); }
}
