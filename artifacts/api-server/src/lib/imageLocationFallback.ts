import type { LocationCandidate, VisualClue } from "@workspace/db";

const RANK_SCORES = [0.25, 0.18, 0.12];
const FALLBACK_CAVEAT =
  "Low-confidence AI visual guess; not verified. The score indicates relative rank, not probability.";

export type LocationVisionFallback = {
  candidates: LocationCandidate[];
  clues: VisualClue[];
};

type VisionCall = (prompt: string, imageDataUrl: string) => Promise<string>;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

export function isGenericUnknownPlace(value: string): boolean {
  return /^(?:unknown(?: location)?|no (?:likely )?location(?: found)?|location (?:unknown|undetermined)|undetermined|n\/a|none)$/i.test(value.trim());
}

function mapsUrl(place: string, region: string | null, country: string | null): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", [place, region, country].filter(Boolean).join(", "));
  return url.toString();
}

function parseJson(raw: string): JsonRecord | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return asRecord(JSON.parse(raw.slice(start, end + 1)));
  } catch {
    return null;
  }
}

export function parseLocationVisionFallback(raw: string): LocationVisionFallback {
  const parsed = parseJson(raw);
  if (!parsed) return { candidates: [], clues: [] };

  const seen = new Set<string>();
  const candidates: LocationCandidate[] = [];
  for (const value of Array.isArray(parsed.candidates) ? parsed.candidates : []) {
    const source = asRecord(value);
    if (!source || candidates.length >= RANK_SCORES.length) continue;
    const place = cleanText(source.place, 180);
    if (!place || isGenericUnknownPlace(place)) continue;
    const regionValue = cleanText(source.region, 120);
    const countryValue = cleanText(source.country, 120);
    const region =
      regionValue && !isGenericUnknownPlace(regionValue) ? regionValue : null;
    const country =
      countryValue && !isGenericUnknownPlace(countryValue) ? countryValue : null;
    const key = [place, region ?? "", country ?? ""].join("|").toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rationale =
      cleanText(source.rationale, 800) ??
      "Visible scene features suggest this as a possible location.";
    const clues = Array.isArray(source.clues)
      ? source.clues.flatMap((clue) => {
          const text = cleanText(clue, 180);
      return text && !isGenericUnknownPlace(text) ? [text] : [];
        }).slice(0, 5)
      : [];
    candidates.push({
      place,
      region,
      country,
      confidence: RANK_SCORES[candidates.length]!,
      rationale: `${rationale} ${FALLBACK_CAVEAT}`,
      clues,
      mapsUrl: mapsUrl(place, region, country),
    });
  }

  const clues: VisualClue[] = Array.isArray(parsed.observations)
    ? parsed.observations.flatMap((value) => {
        const observation = asRecord(value);
        const label = cleanText(observation?.label, 120);
        const detail = cleanText(observation?.observation, 360);
        return label && detail && !isGenericUnknownPlace(detail)
          ? [{
              label,
              observation: detail,
              significance:
                "Reported by the secondary vision model; this clue does not verify a location.",
            }]
          : [];
      }).slice(0, 8)
    : [];

  return { candidates, clues };
}

export async function requestLocationVisionFallback(
  image: Buffer,
  contentType: string,
  callVision: VisionCall = async (prompt, imageDataUrl) => {
    const { analyzeImageWithVision } = await import(
      "@workspace/integrations-openai-ai-server"
    );
    return analyzeImageWithVision(prompt, imageDataUrl);
  },
): Promise<LocationVisionFallback> {
  const prompt = [
    "The primary location service returned no usable location for this personal photo.",
    "Use only visible pixels in the photo. Do not use metadata, EXIF, web search, reverse-image search, or outside sources.",
    "Return one to three ranked low-confidence location guesses rather than 'unknown' whenever any plausible visual inference can be made.",
    "If an exact place is unclear, give broader city, region, or country candidates. Prefer a broad plausible guess over no guess.",
    "Do not invent exact coordinates, street addresses, business names, signs, or landmarks that are not visibly legible.",
    "Separate visible observations from location inference. Guesses are not verification.",
    'Return only JSON in this shape: {"candidates":[{"place":"...","region":"...","country":"...","rationale":"...","clues":["..."]}],"observations":[{"label":"...","observation":"..."}]}.',
    'Use an empty candidates array only if the image is blank, corrupted, or has no interpretable visual scene.',
  ].join("\n");
  const imageDataUrl = `data:${contentType};base64,${image.toString("base64")}`;
  return parseLocationVisionFallback(await callVision(prompt, imageDataUrl));
}

export async function generateLocationVisionFallback(
  image: Buffer,
  contentType: string,
): Promise<LocationVisionFallback> {
  return requestLocationVisionFallback(image, contentType);
}
