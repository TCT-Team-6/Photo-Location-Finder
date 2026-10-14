import type { LocationCandidate, VisualClue } from "@workspace/db";

const LOCATION_ANALYZER_URL =
  "https://mit-app-inventor-backend.onrender.com/analyze";
const MAX_ANALYZER_RESPONSE_BYTES = 2 * 1024 * 1024;

export type ImageLocationAnalysis = {
  summary: string;
  candidates: LocationCandidate[];
  clues: VisualClue[];
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown, maxLength = 1200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return null;
}

function confidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.25;
  const normalized = value > 1 && value <= 100 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

function stringList(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item) => {
      const result = text(item, 220);
      return result ? [result] : [];
    })
    .slice(0, limit);
}

function candidateName(value: JsonRecord | null): string | null {
  return value
    ? firstText(value.name, value.place, value.location_name, value.title)?.slice(
        0,
        180,
      ) ?? null
    : null;
}

function coordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= min && value <= max ? value : null;
}

function mapsUrl(
  place: string,
  region: string | null,
  country: string | null,
  latitude: number | null,
  longitude: number | null,
): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set(
    "query",
    latitude !== null && longitude !== null
      ? `${latitude},${longitude}`
      : [place, region, country].filter(Boolean).join(", "),
  );
  return url.toString();
}

function visualClues(vision: JsonRecord | null, body: JsonRecord): VisualClue[] {
  const trace = Array.isArray(body.reasoning_trace)
    ? body.reasoning_trace
        .map(asRecord)
        .find((stage) => text(stage?.stage)?.toLowerCase() === "visual clues")
    : null;
  const traceDetails = stringList(trace?.details, 10);
  const observations: string[] = [...traceDetails];

  if (observations.length === 0 && vision) {
    const scene = asRecord(vision.scene);
    const visibleFeatures = scene
      ? Object.entries(scene)
          .filter(([, visible]) => visible === true)
          .map(([feature]) => feature.replaceAll("_", " "))
      : [];
    if (visibleFeatures.length) {
      observations.push(`Scene features: ${visibleFeatures.join(", ")}.`);
    }
    for (const [label, value] of [
      ["Architecture", vision.architecture],
      ["Vegetation", vision.vegetation],
      ["Terrain", vision.terrain],
      ["Climate", vision.climate],
    ] as const) {
      const detail = text(value, 300);
      if (detail) observations.push(`${label}: ${detail}`);
    }
    const roadSide = text(vision.road_side, 80);
    if (roadSide) observations.push(`Traffic drives on the ${roadSide}.`);
  }

  if (observations.length === 0) {
    observations.push(...stringList(body.evidence, 10));
  }

  const seen = new Set<string>();
  return observations.flatMap((rawObservation) => {
    const observation = rawObservation
      .replaceAll("_", " ")
      .replace(/\s+/g, " ")
      .trim();
    const normalized = observation.toLowerCase();
    if (seen.has(normalized)) return [];
    seen.add(normalized);
    const separator = observation.indexOf(":");
    const hasLabel = separator > 0 && separator < 48;
    return [
      {
        label: hasLabel ? observation.slice(0, separator).trim() : "Scene observation",
        observation: hasLabel
          ? observation.slice(separator + 1).trim()
          : observation,
        significance:
          "Reported by the Image Locator service from the submitted photograph.",
      },
    ];
  });
}

export function normalizeImageLocationResponse(
  value: unknown,
): ImageLocationAnalysis {
  const body = asRecord(value);
  if (!body) {
    throw new Error("The Image Locator service returned invalid location data.");
  }
  if (body.success === false) {
    throw new Error("The Image Locator service could not analyze this image.");
  }

  const details = asRecord(body.details);
  const vision = asRecord(details?.vision) ?? asRecord(body.vision);
  const bestGuess = asRecord(vision?.best_guess_location);
  const visionCandidates = Array.isArray(vision?.candidates)
    ? vision.candidates.map(asRecord).filter((item): item is JsonRecord => !!item)
    : [];
  const topLevelCandidates = Array.isArray(body.candidates)
    ? body.candidates.map(asRecord).filter((item): item is JsonRecord => !!item)
    : [];
  const alternatives = Array.isArray(body.alternatives)
    ? body.alternatives.map(asRecord).filter((item): item is JsonRecord => !!item)
    : [];
  const possibleCandidates = [
    ...visionCandidates,
    ...topLevelCandidates,
    ...alternatives,
  ];

  const primaryName = firstText(
    body.location_name,
    bestGuess?.name,
    candidateName(possibleCandidates[0] ?? null),
  );
  const primarySource =
    possibleCandidates.find(
      (candidate) =>
        candidateName(candidate)?.toLocaleLowerCase() ===
        primaryName?.toLocaleLowerCase(),
    ) ?? null;

  const normalizedCandidates: LocationCandidate[] = [];
  const seenCandidates = new Set<string>();
  const appendCandidate = (
    source: JsonRecord,
    name: string,
    primary: boolean,
  ) => {
    const region = firstText(
      primary ? body.region : null,
      source.region,
      primary ? bestGuess?.region : null,
    );
    const country = firstText(
      primary ? body.country : null,
      source.country,
      primary ? bestGuess?.country : null,
    );
    const key = name.trim().toLocaleLowerCase();
    if (seenCandidates.has(key) || normalizedCandidates.length >= 4) return;
    seenCandidates.add(key);

    const latitude = coordinate(
      primary ? body.latitude ?? source.latitude : source.latitude,
      -90,
      90,
    );
    const longitude = coordinate(
      primary ? body.longitude ?? source.longitude : source.longitude,
      -180,
      180,
    );
    const reason = firstText(source.why, source.rationale, source.reason);
    const warning = primary ? text(body.warning, 500) : null;
    normalizedCandidates.push({
      place: name.slice(0, 180),
      region: region?.slice(0, 120) ?? null,
      country: country?.slice(0, 120) ?? null,
      confidence: confidence(
        primary ? body.confidence ?? source.confidence : source.confidence,
      ),
      rationale: [
        reason ??
          (primary
            ? "Primary location identified by the Image Locator service."
            : "Alternative location identified by the Image Locator service."),
        ...(warning ? [warning] : []),
      ]
        .join(" ")
        .slice(0, 1200),
      clues: stringList(source.clues),
      mapsUrl: mapsUrl(name, region, country, latitude, longitude),
    });
  };

  if (primaryName) {
    appendCandidate(
      {
        ...(primarySource ?? {}),
        region: body.region ?? primarySource?.region,
        country: body.country ?? primarySource?.country,
        confidence: body.confidence ?? primarySource?.confidence,
        latitude: body.latitude ?? bestGuess?.latitude ?? primarySource?.latitude,
        longitude:
          body.longitude ?? bestGuess?.longitude ?? primarySource?.longitude,
      },
      primaryName,
      true,
    );
  }

  for (const source of possibleCandidates) {
    const name = candidateName(source);
    if (name) appendCandidate(source, name, false);
    if (normalizedCandidates.length >= 4) break;
  }

  normalizedCandidates.sort((left, right) => right.confidence - left.confidence);

  const serviceSummary = text(body.summary);
  const summaryConflictsWithRanking =
    !!serviceSummary &&
    !!normalizedCandidates[0] &&
    (normalizedCandidates[0].place.toLocaleLowerCase() !==
      primaryName?.toLocaleLowerCase() ||
      normalizedCandidates.slice(1).some((candidate) =>
        serviceSummary.toLocaleLowerCase().includes(candidate.place.toLocaleLowerCase()),
      ));
  const warning = text(body.warning, 500);
  const summaryParts = [
    summaryConflictsWithRanking ? null : serviceSummary,
    warning && !(summaryConflictsWithRanking ? false : serviceSummary?.includes(warning))
      ? warning
      : null,
  ].filter((part): part is string => !!part);

  return {
    summary:
      summaryParts.join(" ") ||
      (normalizedCandidates.length
        ? `The Image Locator service ranked ${normalizedCandidates[0].place} as its strongest location lead.`
        : "The Image Locator service returned no likely location."),
    candidates: normalizedCandidates,
    clues: visualClues(vision, body),
  };
}

function safeUploadFilename(originalName: string): string {
  const extension = originalName.match(/(\.[a-z0-9]{1,10})$/i)?.[1]?.toLowerCase();
  return `upload${extension ?? ""}`;
}

export async function analyzeImageLocation(
  image: Buffer,
  contentType: string,
  originalName: string,
): Promise<ImageLocationAnalysis> {
  const form = new FormData();
  const imageBlob = new Blob([new Uint8Array(image)], { type: contentType });
  form.append("image", imageBlob, safeUploadFilename(originalName));

  let response: Response;
  try {
    response = await fetch(LOCATION_ANALYZER_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new Error("The Image Locator service could not be reached.");
  }

  if (!response.ok) {
    throw new Error(
      `The Image Locator service returned HTTP ${response.status}.`,
    );
  }

  const responseText = await response.text();
  if (Buffer.byteLength(responseText, "utf8") > MAX_ANALYZER_RESPONSE_BYTES) {
    throw new Error("The Image Locator service response was too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("The Image Locator service returned invalid JSON.");
  }

  return normalizeImageLocationResponse(parsed);
}