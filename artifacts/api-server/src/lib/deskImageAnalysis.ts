import OpenAI from "openai";
import type { LocationCandidate, VisualClue } from "@workspace/db";

export type DeskImageAnalysis = {
  summary: string;
  candidates: LocationCandidate[];
  clues: VisualClue[];
};

export async function analyzeDeskImage(
  client: OpenAI,
  image: Buffer,
  contentType: string,
  desk: "fake-news",
  question?: string,
): Promise<DeskImageAnalysis> {
  const review = await analyzeJournalismImage(
    client,
    image,
    contentType,
    question,
  );
  return { ...review, candidates: [] };
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
