import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import { analyzeDeskImage } from "./deskImageAnalysis.js";

type ProviderRequest = {
  tools?: unknown[];
  tool_choice?: string;
  input?: Array<{
    content?: Array<{ type?: string; text?: string; image_url?: string }>;
  }>;
};

function mockClient(response: { output?: unknown[]; output_text?: string }) {
  const requests: ProviderRequest[] = [];
  const client = {
    responses: {
      create: async (request: ProviderRequest) => {
        requests.push(request);
        return response;
      },
    },
  } as unknown as OpenAI;
  return { client, requests };
}

const image = Buffer.from("test image");

test("Journalism remains a visual review without reverse-image search", async () => {
  const { client, requests } = mockClient({ output_text: '{"assessment":"No conclusive editing signs."}' });
  const report = await analyzeDeskImage(client, image, "image/png", "fake-news");
  assert.equal(requests[0]?.tools, undefined);
  assert.deepEqual(report.candidates, []);
  assert.match(report.summary, /not forensic authentication/);
});

test("Journalism includes the supplied question and cautious limits in the report", async () => {
  const suppliedQuestion = "Do the shadows support the stated time of day?";
  const { client, requests } = mockClient({
    output_text: JSON.stringify({
      assessment: "A faint edge halo could be consistent with editing, but is not conclusive.",
      observations: [{
        label: "Edge detail",
        observation: "A narrow halo appears along one high-contrast boundary.",
        significance: "This can occur during editing, but may also result from compression.",
      }],
      question_answer: "The shadows appear broadly consistent, though the image alone cannot establish when it was taken.",
    }),
  });

  const report = await analyzeDeskImage(
    client,
    image,
    "image/jpeg",
    "fake-news",
    ` ${suppliedQuestion} `,
  );

  const prompt = requests[0]?.input?.[0]?.content?.find(
    (item) => item.type === "input_text",
  )?.text ?? "";
  assert.match(prompt, new RegExp(suppliedQuestion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(report.summary, new RegExp(suppliedQuestion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(report.summary, /Analyst answer: The shadows appear broadly consistent/i);
  assert.match(report.summary, /not forensic authentication/i);
  assert.match(prompt, /pixels alone often cannot establish provenance/i);
  assert.equal(report.candidates.length, 0);
  assert.equal(report.clues[0]?.label, "Edge detail");
});
