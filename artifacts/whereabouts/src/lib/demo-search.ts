import type { DemoSample } from "./demo-samples";

export function missingDuration(photoTakenAt: string, now = new Date()) {
  const timestamp = new Date(photoTakenAt).getTime();
  const hours = Number.isFinite(timestamp) ? Math.max(0, (now.getTime() - timestamp) / 3_600_000) : 0;
  const minutes = Math.floor(hours * 60);
  return { hours, label: `${Math.floor(minutes / 60)}h ${minutes % 60}m` };
}

/** Fictional walking-distance illustration, not a location prediction or search boundary. */
export function searchArea(sample: DemoSample, now = new Date()) {
  const { scene, person } = sample.urgencyInputs;
  const { hours } = missingDuration(scene.photoTakenAt ?? "", now);
  const baseSpeed = scene.setting === "trail" ? 3 : scene.setting === "park" ? 2 : 1.5;
  const speedKmh = baseSpeed * (person.ageGroup === "older_adult" || person.ageGroup === "child" ? 0.5 : 1);
  return {
    hours,
    speedKmh,
    radiusKm: Math.min(25, hours * speedKmh),
    label: `after ${Number(hours.toFixed(1))}h — grows every hour`,
  };
}
