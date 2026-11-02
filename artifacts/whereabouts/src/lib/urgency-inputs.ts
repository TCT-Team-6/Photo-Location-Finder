import type { Investigation } from "@workspace/api-client-react";
import type { PersonFactors, SceneClues, Setting, Terrain, TimeOfDay } from "./urgency";

/**
 * Conservative adapter, not a second scoring system. Read returned observations,
 * never candidate locations, case names, notes or rationales. Explicit enum
 * values take precedence; free text must be affirmative and unambiguous.
 */
export function urgencyInputsFromInvestigation(
  investigation: Investigation,
  person: PersonFactors = {},
  now: Date = new Date(),
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

  const facts = investigation.clues.flatMap((clue) =>
    clue.observation.toLowerCase().replaceAll("_", " ").split(/[.;\n]+/)
      .filter((text) => text.trim() && !/\b(no|not|without|unknown|unclear|uncertain|possibly|possible|perhaps|maybe|might|could|may|cannot|unlikely|unconfirmed|dry)\b|can['’]t/.test(text))
      .map((text) => ({ label: clue.label.trim().toLowerCase(), text })),
  );
  const sceneLabels = ["scene", "scene features", "scene observation", "setting", "terrain"];
  const sceneFacts = facts.filter((fact) => sceneLabels.includes(fact.label))
    .flatMap((fact) => fact.label === "scene features" ? fact.text.split(",").map((text) => text.trim()) : [fact.text]);
  const uniqueMatch = <T extends string>(texts: string[], patterns: Array<[T, RegExp]>): T | undefined => {
    const matches = patterns.filter(([, pattern]) => texts.some((text) => pattern.test(text)));
    return matches.length === 1 ? matches[0][0] : undefined;
  };
  if (!scene.setting) {
    // Specific observed settings, not a guess that all mountains are wilderness.
    let detectedSetting = uniqueMatch<Setting>(sceneFacts, [
      ["trail", /\b(trail|trailhead|hiking path)\b/],
      ["beach", /\b(beach|sandy shoreline|coastal boardwalk)\b/],
      ["park", /\b(public park|city park|urban park|park setting|park path|parkland)\b|^park$/],
      ["wilderness", /\b(wilderness|remote backcountry)\b/],
    ]);
    if (!detectedSetting) {
      detectedSetting = uniqueMatch<Setting>(sceneFacts, [
        ["urban", /\b(downtown|city street|urban street)\b|^urban$/],
        ["suburban", /\b(suburban|residential suburb)\b/],
      ]);
    }
    if (detectedSetting) scene.setting = detectedSetting;
  }
  if (!scene.terrain) {
    const detectedTerrain = uniqueMatch<Terrain>(sceneFacts, [
      ["steep", /\b(steep|sheer cliff|precipitous)\b/],
      ["hilly", /\b(hilly|rolling hills|sloping ground)\b/],
      ["flat", /\b(flat|level ground)\b/],
    ]);
    if (detectedTerrain) scene.terrain = detectedTerrain;
  }
  if (scene.nearWater === undefined && sceneFacts.some((text) =>
    /\b(river|lake|ocean|sea|pond|stream|waterfall|swimming pool|shoreline|visible water|water nearby)\b|^water$/.test(text),
  )) scene.nearWater = true;
  if (!scene.timeOfDay) {
    const lightFacts = facts.filter((fact) =>
      ["time of day", "lighting", "light", "scene observation", "scene features"].includes(fact.label),
    ).map((fact) => fact.text);
    const detectedTime = uniqueMatch<TimeOfDay>(lightFacts, [
      ["morning", /\b(morning|dawn)\b/],
      ["afternoon", /\bafternoon\b/],
      ["evening", /\b(evening|dusk|sunset)\b/],
      ["night", /\b(night|nighttime)\b/],
    ]);
    if (detectedTime) scene.timeOfDay = detectedTime;
  }
  if (!scene.weather) {
    const detected = new Set<string>();
    for (const { label, text } of facts) {
      if (["weather", "weather conditions"].includes(label)) {
        for (const word of ["rain", "snow", "sleet", "drizzle", "fog", "storm", "wind"]) {
          if (new RegExp(`\\b${word}\\b`).test(text)) detected.add(word);
        }
      } else if (["climate", "scene observation"].includes(label)) {
        // Snow on a mountain is not evidence that snow is currently falling.
        for (const [word, pattern] of [
          ["rain", /\b(raining|rainfall)\b/], ["snow", /\b(snowing|falling snow)\b/],
          ["fog", /\b(foggy|thick fog)\b/], ["wind", /\bwindy\b/],
          ["storm", /\bstormy\b/],
        ] as const) if (pattern.test(text)) detected.add(word);
      }
    }
    if (detected.size) scene.weather = [...detected];
  }

  // Use capture metadata only. Upload/create/update dates and date-only shotAt
  // values do not establish an instant and must not manufacture elapsed hours.
  const timestamp = investigation.analysis?.details?.exif?.timestamp;
  if (timestamp && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp)) {
    const takenAt = new Date(timestamp);
    const [year, month, day] = timestamp.slice(0, 10).split("-").map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    const validDay = calendar.getUTCFullYear() === year && calendar.getUTCMonth() === month - 1 && calendar.getUTCDate() === day;
    if (validDay && Number.isFinite(takenAt.getTime()) && takenAt.getTime() <= now.getTime()) scene.photoTakenAt = takenAt;
  }
  // The current output contract has no measured temperature or person factors.
  // Do not invent them from snow, sunlight, a case title, or a location guess.
  // Person factors can only be supplied separately from explicitly known facts.
  return { scene, person: { ...person } };
}
