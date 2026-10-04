import { isIP } from "node:net";
import type OpenAI from "openai";
import type {
  LocationCandidate,
  LocationPhotoReference,
} from "@workspace/db";

const imageSearchTool = {
  type: "web_search" as const,
  external_web_access: true,
  search_context_size: "low" as const,
  search_content_types: ["image"],
  image_settings: {
    max_results: 3,
    caption: true,
  },
};

function safePublicHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const hostForIpCheck =
      hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      isIP(hostForIpCheck) !== 0 ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function parseLocationPhotoReferences(
  output: unknown,
): LocationPhotoReference[] {
  if (!Array.isArray(output)) return [];

  const searchResults = output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    return record.type === "web_search_call" && Array.isArray(record.results)
      ? record.results
      : [];
  });

  const seenImageUrls = new Set<string>();
  const references: LocationPhotoReference[] = [];
  for (const item of searchResults) {
    if (!item || typeof item !== "object") continue;
    const result = item as Record<string, unknown>;
    if (result.type !== "image_result") continue;

    const imageUrl = safePublicHttpsUrl(result.image_url);
    const sourceUrl = safePublicHttpsUrl(result.source_website_url);
    if (!imageUrl || !sourceUrl || seenImageUrls.has(imageUrl)) continue;
    seenImageUrls.add(imageUrl);

    references.push({
      imageUrl,
      thumbnailUrl: safePublicHttpsUrl(result.thumbnail_url),
      sourceUrl,
      caption:
        typeof result.caption === "string"
          ? result.caption.trim().slice(0, 280) || null
          : null,
    });
    if (references.length === 3) break;
  }

  return references;
}

export async function searchLocationPhotoReferences(
  client: OpenAI,
  candidate: LocationCandidate,
): Promise<LocationPhotoReference[]> {
  const locationName = [candidate.place, candidate.region, candidate.country]
    .filter(Boolean)
    .join(", ");

  const response = await client.responses.create({
    model: process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-5.4-mini",
    tools: [imageSearchTool],
    tool_choice: "required",
    include: ["web_search_call.results"],
    max_output_tokens: 128,
    input: [
      "Search the live internet for up to three public reference photos of this named location.",
      `Location name: ${JSON.stringify(locationName)}`,
      "Use the place name as the search query. Do not search for or upload any private source photograph, filename, or personal notes.",
      "Return image search results with their source pages. These are location references, not verified matches to the private photograph.",
    ].join("\n"),
  });

  return parseLocationPhotoReferences(response.output);
}