/**
 * urgency.ts — Health risk & urgency scoring for Whereabouts
 *
 * WHAT THIS DOES
 * Takes the clues our photo pipeline already extracts (setting, weather, time of
 * day, how old the photo is) plus optional facts about the missing person, and
 * turns them into:
 *   - an urgency level: Low / Moderate / High / Critical
 *   - a list of health risks, each with a plain-English reason
 *   - suggested next steps for searchers
 *
 * HOW IT WORKS (simple, explainable rules — no AI in this file)
 * Every risk adds points. More points = more urgent. Each rule below has a
 * comment saying why it matters for the person's health, so we can explain it
 * in our video and to judges.
 *
 *   0–2 points  -> Low
 *   3–5 points  -> Moderate
 *   6–8 points  -> High
 *   9+ points   -> Critical
 *
 * These are estimates to help prioritise a search. They are NOT medical or
 * emergency advice. Always call emergency services first.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Setting =
  | "urban"
  | "suburban"
  | "park"
  | "trail"
  | "wilderness"
  | "beach"
  | "unknown";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night" | "unknown";

export type Terrain = "flat" | "hilly" | "steep" | "unknown";

/** What the photo pipeline tells us about the scene. All fields optional. */
export interface SceneClues {
  /** When the photo was taken (from EXIF metadata, if present). */
  photoTakenAt?: Date;
  /** Best guess at the kind of place. */
  setting?: Setting;
  /** True if a river, lake, ocean, pool or similar is visible or very close. */
  nearWater?: boolean;
  /** Estimated or looked-up temperature at the location, in Celsius. */
  temperatureC?: number;
  /** Weather words the AI noticed, e.g. ["rain", "snow", "fog", "wind"]. */
  weather?: string[];
  /** Time of day from lighting or metadata. */
  timeOfDay?: TimeOfDay;
  /** How hard the ground looks to walk on. */
  terrain?: Terrain;
}

/** Optional facts about the missing person (from a Ready Profile or the form). */
export interface PersonFactors {
  ageGroup?: "child" | "teen" | "adult" | "older_adult";
  /** Dementia, autism, or anything that makes wandering or not asking for help likely. */
  mayWanderOrBeConfused?: boolean;
  /** Needs regular medication (e.g. insulin, heart or seizure medicine). */
  needsMedication?: boolean;
  /** Uses a walker or wheelchair, recent injury, or tires easily. */
  limitedMobility?: boolean;
  /** May not be able to call out or tell someone their name. */
  nonverbal?: boolean;
}

export type UrgencyLevel = "Low" | "Moderate" | "High" | "Critical";

export interface RiskFactor {
  /** Short label for a chip, e.g. "Cold exposure". */
  label: string;
  /** One-line, plain-English reason shown under the label. */
  reason: string;
  /** Points this factor added (shown in a "how we scored this" view). */
  points: number;
  /** Used to pick an icon/colour in the UI. */
  category: "exposure" | "time" | "terrain" | "person";
}

export interface UrgencyResult {
  level: UrgencyLevel;
  score: number;
  /** Badge colour suggestion for the UI. */
  color: "green" | "yellow" | "orange" | "red";
  risks: RiskFactor[];
  nextSteps: string[];
  /** e.g. "about 5 hours ago", or null if the photo has no time data. */
  timeSincePhoto: string | null;
  disclaimer: string;
}

export const DISCLAIMER =
  "Estimates only — not medical or emergency advice. If someone may be in danger, call 911 first.";

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function assessUrgency(
  scene: SceneClues,
  person: PersonFactors = {},
  now: Date = new Date(),
): UrgencyResult {
  const risks: RiskFactor[] = [];
  const steps = new Set<string>();
  const add = (r: RiskFactor) => risks.push(r);

  const isChild = person.ageGroup === "child";
  const isOlder = person.ageGroup === "older_adult";
  const extraVulnerable = isChild || isOlder || !!person.mayWanderOrBeConfused;
  const outdoors = ["park", "trail", "wilderness", "beach"].includes(scene.setting ?? "");

  // --- Rule 1: Time since the photo -----------------------------------------
  // Why: the longer someone has been missing, the more tired, hungry, thirsty
  // and exposed they get, and the further they may have moved.
  let hours: number | null = null;
  if (scene.photoTakenAt) {
    hours = (now.getTime() - scene.photoTakenAt.getTime()) / 3_600_000;
    if (hours >= 24) {
      add({ label: "Missing over a day", reason: "More than 24 hours since this photo — dehydration and exhaustion become serious.", points: 3, category: "time" });
    } else if (hours >= 6) {
      add({ label: "Several hours passed", reason: "6+ hours since this photo — the search area grows the longer it takes.", points: 2, category: "time" });
    } else if (hours >= 2) {
      add({ label: "A few hours passed", reason: "2+ hours since this photo — they may have moved on from this spot.", points: 1, category: "time" });
    }
  } else {
    // No timestamp: we can't tell, so assume some time has passed.
    add({ label: "Photo time unknown", reason: "The photo has no time data, so we can't tell how long ago it was taken.", points: 1, category: "time" });
  }

  // --- Rule 2: Cold ----------------------------------------------------------
  // Why: hypothermia can set in even above freezing, faster when wet or windy,
  // and faster for children and older adults.
  const t = scene.temperatureC;
  const wet = (scene.weather ?? []).some((w) => ["rain", "snow", "sleet", "drizzle"].includes(w.toLowerCase()));
  if (t !== undefined && t <= 10 && outdoors) {
    const severe = t <= 4 || (t <= 10 && wet);
    add({
      label: "Cold exposure",
      reason: `Around ${fmtTemp(t)}${wet ? " and wet" : ""} — risk of hypothermia${severe ? ", especially overnight" : ""}.`,
      points: severe ? 3 : 2,
      category: "exposure",
    });
    steps.add("Bring blankets, dry layers and warm drinks for when the person is found.");
  }

  // --- Rule 3: Heat ----------------------------------------------------------
  // Why: heat exhaustion and dehydration can become dangerous within hours,
  // especially for kids, older adults, and anyone on certain medications.
  if (t !== undefined && t >= 27) {
    const severe = t >= 32;
    add({
      label: "Heat exposure",
      reason: `Around ${fmtTemp(t)} — risk of dehydration and heat illness.`,
      points: severe ? 3 : 2,
      category: "exposure",
    });
    steps.add("Carry extra water and check shaded spots (under trees, bridges, building overhangs).");
  }

  // --- Rule 4: Water nearby --------------------------------------------------
  // Why: drowning is a leading danger for wandering children and people with
  // dementia or autism, who are often drawn to water.
  if (scene.nearWater) {
    add({
      label: "Water nearby",
      reason: extraVulnerable
        ? "Water is close by, and this person may be drawn to it — check it first."
        : "Water is close by — slips, falls and cold water are a risk.",
      points: extraVulnerable ? 3 : 2,
      category: "exposure",
    });
    steps.add("Search shorelines, docks and banks near the photo location first.");
  }

  // --- Rule 5: Darkness ------------------------------------------------------
  // Why: night brings colder temperatures, falls, and makes searching harder.
  if (scene.timeOfDay === "evening") {
    add({ label: "Darkness coming", reason: "Photo looks like evening — daylight to search is running out.", points: 1, category: "exposure" });
    steps.add("Bring flashlights and start searching before dark.");
  } else if (scene.timeOfDay === "night") {
    add({ label: "Nighttime", reason: "Photo looks like night — harder to see, colder, and easier to fall.", points: 2, category: "exposure" });
    steps.add("Bring flashlights and reflective vests; search in pairs.");
  }

  // --- Rule 6: Remote or difficult terrain ----------------------------------
  // Why: fewer people around to help, weaker phone signal, and a higher chance
  // of falls or getting stuck.
  if (scene.setting === "wilderness" || scene.setting === "trail") {
    const steep = scene.terrain === "steep";
    add({
      label: "Remote terrain",
      reason: `Looks like a ${scene.setting}${steep ? " with steep ground" : ""} — fewer people to help and a risk of falls.`,
      points: steep ? 3 : 2,
      category: "terrain",
    });
    steps.add("Alert park rangers or local search and rescue and share the likely trailhead.");
  } else if (scene.terrain === "steep") {
    add({ label: "Steep ground", reason: "The ground looks steep — a fall could stop them from getting help.", points: 1, category: "terrain" });
  }

  // --- Rule 7: Bad weather ---------------------------------------------------
  // Why: rain, snow and fog lower body temperature and make people harder to spot.
  const badWeather = (scene.weather ?? []).filter((w) =>
    ["rain", "snow", "sleet", "fog", "storm", "wind"].includes(w.toLowerCase()),
  );
  if (badWeather.length > 0) {
    add({ label: "Bad weather", reason: `Signs of ${badWeather.join(", ")} — harder to stay warm and harder to spot someone.`, points: 1, category: "exposure" });
  }

  // --- Rule 8: Who the person is --------------------------------------------
  // Why: some people can't look after themselves or ask for help, so the same
  // conditions are more dangerous for them.
  if (isChild) {
    add({ label: "Young child", reason: "Children may hide when scared and can't judge danger well.", points: 2, category: "person" });
    steps.add("Check small hiding spots close to the photo location (bushes, playground equipment, cars).");
  } else if (isOlder) {
    add({ label: "Older adult", reason: "Older adults get cold, hot or dehydrated faster.", points: 1, category: "person" });
  }
  if (person.mayWanderOrBeConfused) {
    add({ label: "May be confused", reason: "They may not know they're lost or may not answer when called.", points: 2, category: "person" });
    steps.add("Check places they used to go often (old home, workplace, church, a favourite shop).");
  }
  if (person.needsMedication) {
    add({ label: "Needs medication", reason: "Missing doses can become a medical emergency.", points: 2, category: "person" });
    steps.add("Tell emergency services which medication they need and when the last dose was.");
  }
  if (person.limitedMobility) {
    add({ label: "Limited mobility", reason: "They're likely still close to the photo spot but less able to get to safety.", points: 1, category: "person" });
    steps.add("Focus the first search close to the photo location.");
  }
  if (person.nonverbal) {
    add({ label: "May not respond", reason: "They may not call out or answer, so searchers must look, not just listen.", points: 1, category: "person" });
  }

  // --- Score -> level --------------------------------------------------------
  const score = risks.reduce((sum, r) => sum + r.points, 0);
  const level: UrgencyLevel = score >= 9 ? "Critical" : score >= 6 ? "High" : score >= 3 ? "Moderate" : "Low";
  const color = ({ Low: "green", Moderate: "yellow", High: "orange", Critical: "red" } as const)[level];

  // Steps that always apply, in priority order.
  const nextSteps = [
    ...(level === "High" || level === "Critical" ? ["Call 911 now if you haven't already, and share this report with them."] : ["If you're worried, contact local police or 911."]),
    ...steps,
    "Share the photo and the top likely locations with everyone searching.",
  ];

  // Most important risks first.
  risks.sort((a, b) => b.points - a.points);

  return {
    level,
    score,
    color,
    risks,
    nextSteps,
    timeSincePhoto: hours === null ? null : describeHours(hours),
    disclaimer: DISCLAIMER,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shows both units, e.g. "3°C (37°F)". */
function fmtTemp(c: number): string {
  return `${Math.round(c)}°C (${Math.round((c * 9) / 5 + 32)}°F)`;
}

function describeHours(h: number): string {
  if (h < 1) return "less than an hour ago";
  if (h < 48) return `about ${Math.round(h)} hour${Math.round(h) === 1 ? "" : "s"} ago`;
  return `about ${Math.round(h / 24)} days ago`;
}
