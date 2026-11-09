import type { Investigation } from "@workspace/api-client-react";
import { isVideoContentType } from "./media-types";

export const VIDEO_PROGRESS_MESSAGE = "Checking key moments in the video… this can take a few minutes.";
export const POLL_MS = 5000;

export function isVideoInvestigation(item: { contentType?: string | null } | null | undefined): boolean {
  return isVideoContentType(item?.contentType);
}

export function isAnalyzing(item: { status?: string | null } | null | undefined): boolean {
  return item?.status === "analyzing";
}

/** Poll every 5 seconds while a saved analysis is still running; otherwise stop. */
export function pollWhileAnalyzing(query: { state: { data?: unknown } }): number | false {
  return isAnalyzing(query.state.data as Investigation | undefined) ? POLL_MS : false;
}

export function pollListWhileAnalyzing(query: { state: { data?: unknown } }): number | false {
  const rows = query.state.data;
  return Array.isArray(rows) && rows.some((row) => isAnalyzing(row as Investigation)) ? POLL_MS : false;
}

export function formatTimestamp(totalSeconds: number | undefined | null): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds as number) ? (totalSeconds as number) : 0));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

export type KeyMoment = { index: number; timestamp: number; label: string; places: string[]; cluesFound?: boolean };

export function keyMoments(analysis: Investigation["analysis"] | undefined): KeyMoment[] {
  const frames = analysis?.contributing_frames;
  if (!Array.isArray(frames)) return [];
  return frames
    .map((frame, position) => ({
      index: frame.index ?? position,
      timestamp: frame.timestamp_s ?? 0,
      label: formatTimestamp(frame.timestamp_s),
      places: (frame.candidates ?? []).filter((place) => typeof place === "string" && place.trim()),
      cluesFound: frame.clues_found,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function embeddedGps(analysis: Investigation["analysis"] | undefined) {
  const gps = analysis?.video?.embedded_gps;
  if (!gps || !Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) return null;
  return {
    latitude: gps.latitude,
    longitude: gps.longitude,
    label: `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`,
    mapsUrl: `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`,
  };
}

/** The saved media is streamed by the authenticated API (supports Range requests). */
export function investigationMediaUrl(id: string): string {
  return `/api/investigations/${encodeURIComponent(id)}/photo`;
}
