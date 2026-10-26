import type { InvestigationAnalysis } from "@workspace/db";

type RecordValue = Record<string, unknown>;
type Parser = (value: unknown) => unknown;

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, 1200) : undefined;
}

function number(min = -Infinity, max = Infinity): Parser {
  return (value) => typeof value === "number" && Number.isFinite(value) &&
    value >= min && value <= max ? value : undefined;
}

const boolean: Parser = (value) => typeof value === "boolean" ? value : undefined;
const latitude = number(-90, 90);
const longitude = number(-180, 180);
const nonnegative = number(0);
const score = number(0, 1);

function mapUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2000) return undefined;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function object(fields: Record<string, Parser>): Parser {
  return (value) => {
    const source = record(value);
    if (!source) return undefined;
    const result: RecordValue = {};
    for (const [key, parse] of Object.entries(fields)) {
      const parsed = parse(source[key]);
      if (parsed !== undefined) result[key] = parsed;
    }
    return Object.keys(result).length ? result : undefined;
  };
}

function list(parse: Parser): Parser {
  return (value) => {
    if (!Array.isArray(value)) return undefined;
    const result: unknown[] = [];
    for (const item of value) {
      const parsed = parse(item);
      if (parsed !== undefined) result.push(parsed);
      if (result.length === 10) break;
    }
    return result;
  };
}

const parseMetadata = object({
  latitude,
  longitude,
  map_url: mapUrl,
  address: text,
  confidence: score,
  source: text,
  verified: text,
  warning: text,
  meets_defined_radius: boolean,
  defined_radius_km: nonnegative,
  precision_m: nonnegative,
  elevation_m: number(),
  search_areas: list(object({
    rank: (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 1
      ? value : undefined,
    name: text,
    country: text,
    latitude,
    longitude,
    search_radius_km: nonnegative,
    score,
    map_status: text,
  })),
  rejected: list(object({ name: text, reason: text })),
  nearby_places: list(object({ title: text, distance_km: nonnegative })),
  forensics: object({
    has_gps: boolean,
    authenticity: text,
    edited: boolean,
    is_screenshot: boolean,
    metadata_stripped: boolean,
    notes: list(text),
  }),
  // Both shapes occur in the supplied guide and real backend response.
  reasoning_trace: list(object({
    stage: text,
    details: list(text),
    step: text,
    detail: text,
  })),
  details: object({ exif: object({ timestamp: text }) }),
});

export function extractImageLocationMetadata(value: unknown): InvestigationAnalysis {
  return (parseMetadata(value) ?? {}) as InvestigationAnalysis;
}
