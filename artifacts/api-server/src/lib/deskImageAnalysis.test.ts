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

test("Recreation searches public source-image matches rather than locations", async () => {
  const { client, requests } = mockClient({
    output: [{
      type: "web_search_call",
      results: [{
        type: "image_result",
        image_url: "https://images.example/source.jpg",
        source_website_url: "https://archive.example/photo",
        caption: "A matching archival photograph",
      }],
    }],
  });

  const report = await analyzeDeskImage(client, image, "image/jpeg", "recreation");

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.tool_choice, "required");
  assert.match(JSON.stringify(requests[0]?.tools), /image/);
  const prompt = requests[0]?.input?.[0]?.content?.find(
    (item) => item.type === "input_text",
  )?.text ?? "";
  assert.match(prompt, /source images/i);
  assert.match(prompt, /Do not search for the real-world location/i);
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0]?.place, "A matching archival photograph");
  assert.equal(report.candidates[0]?.mapsUrl, "https://archive.example/photo");
  assert.equal(report.candidates[0]?.photoReferences?.[0]?.imageUrl, "https://images.example/source.jpg");
  assert.match(report.summary, /none is confirmed as the original/i);
});

test("Recreation reports a clear no-result response when image search finds no matches", async () => {
  const { client, requests } = mockClient({ output: [] });

  const report = await analyzeDeskImage(client, image, "image/png", "recreation");

  assert.equal(requests.length, 1);
  assert.deepEqual(report.candidates, []);
  assert.deepEqual(report.clues, []);
  assert.match(report.summary, /No plausible original source image was found/i);
  assert.match(report.summary, /may miss private, removed, or poorly indexed images/i);
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
