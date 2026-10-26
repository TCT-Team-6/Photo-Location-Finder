/** Older Recreation reports contain source matches, not location findings. */
export function isLegacyRecreationReport(item: {
  desk?: string;
  analysis?: { media_type?: string } | null;
} | null | undefined): boolean {
  return item?.desk === "recreation" && item.analysis?.media_type !== "image";
}
