export const IMAGE_LIMIT = 25 * 1024 * 1024;
export const VIDEO_LIMIT = 60 * 1024 * 1024;
export const videoTypes: Record<string, string> = {
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mkv: "video/x-matroska", avi: "video/x-msvideo", "3gp": "video/3gpp",
};
export const imageTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif", "image/gif",
  "image/bmp", "image/x-ms-bmp", "image/tiff", "image/x-tiff", "image/heic", "image/heif",
]);
export function isVideo(contentType: string): boolean {
  return Object.values(videoTypes).includes(contentType);
}
export function validVideoFilename(name: string, contentType: string): boolean {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return videoTypes[extension] === contentType;
}
export function mediaValidationError(name: string, contentType: string, size: number): string | null {
  const video = isVideo(contentType);
  if (!(video || imageTypes.has(contentType)) || (video && !validVideoFilename(name, contentType))) {
    return "Choose a supported photo or an MP4, MOV, WebM, MKV, AVI, or 3GP video.";
  }
  if (!Number.isFinite(size) || size < 1) return "This file is empty or invalid.";
  if (size > (video ? VIDEO_LIMIT : IMAGE_LIMIT)) {
    return video ? "This video is larger than 60 MB" : "This photo is larger than 25 MB.";
  }
  return null;
}
