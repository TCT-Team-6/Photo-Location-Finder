import OpenAI from "openai";
import type { LocationCandidate, VisualClue } from "@workspace/db";
import { parseLocationPhotoReferences } from "./locationPhotoSearch";

export type DeskImageAnalysis = {
  summary: string;
  candidates: LocationCandidate[];
  clues: VisualClue[];
};

export async function analyzeDeskImage(
  client: OpenAI,
  image: Buffer,
  contentType: string,
  desk: "recreation" | "fake-news",
  question?: string,
): Promise<DeskImageAnalysis> {
  if (desk === "recreation") {
    return analyzeRecreationImage(client, image, contentType);
  }

  const review = await analyzeJournalismImage(
    client,
    image,
    contentType,
    question,
  );
  return { ...review, candidates: [] };
}

const sourceImageSearchTool = {
  type: "web_search" as const,
  external_web_access: true,
  search_context_size: "high" as const,
  search_content_types: ["image"],
  image_settings: { max_results: 5, caption: true },
};

export async function analyzeRecreationImage(
  client: OpenAI,
  image: Buffer,
  contentType: string,
): Promise<DeskImageAnalysis> {
  const dataUrl = `data:${contentType};base64,${image.toString("base64")}`;
  const response = await client.responses.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
    tools: [sourceImageSearchTool],
    tool_choice: "required",
    include: ["web_search_call.results"],
    max_output_tokens: 700,
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            "Find possible original/source images that this recreation, redraw, staged copy, or edited image may be based on.",
            "Inspect the supplied image, describe distinctive visual elements, and search public image sources for likely source-image matches.",
            "Do not search for the real-world location. Do not claim a result is the original unless the source page or image is an unmistakable match.",
            "Return image search results and their public source pages. If no plausible match is found, say so plainly.",
          ].join(" "),
        },
        { type: "input_image", image_url: dataUrl, detail: "high" },
      ],
    }],
  });
  const references = parseLocationPhotoReferences(response.output);
  const candidates = references.map((reference, index) => ({
    place: reference.caption?.trim() || `Possible source image ${index + 1}`,
    region: null,
    country: null,
    confidence: 0,
    rationale: reference.caption?.trim() || "Possible public source image found by visual web search.",
    clues: [],
    mapsUrl: reference.sourceUrl,
    photoReferences: [reference],
    photoSearchStatus: "found" as const,
  }));
  return {
    summary: candidates.length
      ? `Source-image search found ${candidates.length} possible public match${candidates.length === 1 ? "" : "es"}. Compare each image and its source; none is confirmed as the original.`
      : "No plausible original source image was found in the public image search. The search may miss private, removed, or poorly indexed images.",
    candidates,
    clues: [],
  };
}

type JournalismReview = {
  summary: string;
  clues: VisualClue[];
};

export async function analyzeJournalismImage(
  client: OpenAI,
  image: Buffer,
  contentType: string,
  question: string | undefined,
): Promise<JournalismReview> {
  const dataUrl = `data:${contentType};base64,${image.toString("base64")}`;
  const response = await client.responses.create({
    model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
    max_output_tokens: 1200,
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: [
            "Review this image for visual signs of editing, compositing, CGI, or AI generation.",
            "Do not present visual inspection as proof of authenticity or fabrication. Explain that pixels alone often cannot establish provenance.",
            "Give a cautious assessment and name concrete visible details, separating observations from interpretation.",
            question?.trim()
              ? `Answer the user's question directly and separately: ${JSON.stringify(question.trim())}`
              : "No user question was supplied.",
            'Return only JSON: {"assessment":"...","observations":[{"label":"...","observation":"...","significance":"..."}],"question_answer":"..."}',
          ].join("\n"),
        },
        { type: "input_image", image_url: dataUrl, detail: "high" },
      ],
    }],
  });
  const raw = response.output_text?.trim() ?? "";
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = { assessment: raw };
  }
  const assessment =
    typeof parsed.assessment === "string" && parsed.assessment.trim()
      ? parsed.assessment.trim()
      : "The image could not be assessed from visual evidence alone.";
  const answer =
    typeof parsed.question_answer === "string" ? parsed.question_answer.trim() : "";
  const clues: VisualClue[] = Array.isArray(parsed.observations)
    ? parsed.observations.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const clue = value as Record<string, unknown>;
        if (
          typeof clue.label !== "string" ||
          typeof clue.observation !== "string" ||
          typeof clue.significance !== "string"
        ) return [];
        return [{
          label: clue.label.slice(0, 160),
          observation: clue.observation.slice(0, 500),
          significance: clue.significance.slice(0, 500),
        }];
      }).slice(0, 8)
    : [];
  return {
    summary: [
      `Image-integrity review: ${assessment}`,
      question?.trim() ? `Your question: ${question.trim()}` : "",
      question?.trim() ? `Analyst answer: ${answer || "No direct answer was returned."}` : "",
      "This is an AI-generated visual assessment, not forensic authentication. Check the image's original file, provenance, and independent sources.",
    ].filter(Boolean).join("\n\n"),
    clues,
  };
}
