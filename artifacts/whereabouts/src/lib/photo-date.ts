// Reads the "date taken" that cameras and phones store inside a photo (EXIF),
// so the "When was it taken?" field can be filled in automatically.

/** Turns a Date into the "YYYY-MM-DD" text that <input type="date"> expects. */
export function toDateInputValue(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  // Ignore obviously wrong camera clocks (unset clocks often say 1970 or 2000-01-01).
  if (year < 1990 || date.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns the day the photo was taken as "YYYY-MM-DD", or null when the
 * file has no date (screenshots and most social-media downloads have none).
 */
export async function readPhotoTakenDate(file: File): Promise<string | null> {
  try {
    // Loaded only when needed so the rest of the app stays fast.
    const exifr = (await import("exifr")).default;
    const tags = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
    const taken = tags?.DateTimeOriginal ?? tags?.CreateDate;
    return taken instanceof Date ? toDateInputValue(taken) : null;
  } catch {
    return null;
  }
}
