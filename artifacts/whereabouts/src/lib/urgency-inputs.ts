import type { Investigation } from "@workspace/api-client-react";
import type { PersonFactors, SceneClues, Setting, Terrain, TimeOfDay } from "./urgency";

/**
 * Conservative adapter, not a second scoring system. Only explicit, labelled
 * observations are read, never candidate locations, case names or rationales.
 * Unrecognised prose is left unknown instead of guessing a fact from keywords.
 */
export function urgencyInputsFromInvestigation(
  investigation: Investigation,
  person: PersonFactors = {},
): { scene: SceneClues; person: PersonFactors } {
  const scene: SceneClues = {};
  const observation = (label: string) => {
    const matches = investigation.clues.filter(
      (clue) => clue.label.trim().toLowerCase() === label,
    );
    // Ambiguous/conflicting fields stay unset.
    if (matches.length !== 1) return undefined;
    return matches[0].observation.split(":")[0].trim().toLowerCase();
  };
  const setting = observation("setting");
  if (setting && ["urban", "suburban", "park", "trail", "wilderness", "beach"].includes(setting)) {
    scene.setting = setting as Setting;
  }
  const terrain = observation("terrain");
  if (terrain && ["flat", "hilly", "steep"].includes(terrain)) {
    scene.terrain = terrain as Terrain;
  }
  const time = observation("time of day");
  if (time && ["morning", "afternoon", "evening", "night"].includes(time)) {
    scene.timeOfDay = time as TimeOfDay;
  }
  const water = observation("water nearby");
  if (water === "yes" || water === "no") scene.nearWater = water === "yes";
  const weather = observation("weather");
  if (weather) {
    const tokens = weather.split(",").map((word) => word.trim());
    const allowed = ["rain", "snow", "sleet", "drizzle", "fog", "storm", "wind", "clear"];
    if (tokens.every((word) => allowed.includes(word))) scene.weather = tokens;
  }

  // Use capture metadata only. Upload/create/update dates and date-only shotAt
  // values do not establish an instant and must not manufacture elapsed hours.
  const timestamp = investigation.analysis?.details?.exif?.timestamp;
  if (timestamp && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) {
    const takenAt = new Date(timestamp);
    if (Number.isFinite(takenAt.getTime())) scene.photoTakenAt = takenAt;
  }
  // The current output contract has no measured temperature or person factors.
  // Do not invent them from snow, sunlight, a case title, or a location guess.
  // Person factors can only be supplied separately from explicitly known facts.
  return { scene, person: { ...person } };
}
