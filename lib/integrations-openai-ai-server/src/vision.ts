import { openai } from "./client";

export async function analyzeImageWithVision(
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  const response = await openai.responses.create({
    model: "gpt-5.6-luna",
    max_output_tokens: 8192,
    text: {
      format: {
        type: "json_schema",
        name: "location_vision_guesses",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            candidates: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  place: { type: "string" },
                  region: { type: "string" },
                  country: { type: "string" },
                  rationale: { type: "string" },
                  clues: { type: "array", items: { type: "string" } },
                },
                required: ["place", "region", "country", "rationale", "clues"],
              },
            },
            observations: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  label: { type: "string" },
                  observation: { type: "string" },
                },
                required: ["label", "observation"],
              },
            },
          },
          required: ["candidates", "observations"],
        },
      },
    },
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: prompt },
        { type: "input_image", image_url: imageDataUrl, detail: "high" },
      ],
    }],
  });

  return response.output_text ?? "";
}
