import assert from "node:assert/strict";
import { once } from "node:events";
import { after, mock, test } from "node:test";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import { GuideIntakeResponse, GuidePlanResponse } from "@workspace/api-zod";
import { privateCasesTable, caseLeadsTable } from "@workspace/db/schema";
import { emptyFacts, advanceGuide, type GuideFacts } from "../lib/guide";

const id = "00000000-0000-4000-8000-000000000001";
const facts: GuideFacts = { ...emptyFacts, purpose: "find_missing_person", safetyReason: "Missing and needs heart medication", needsMedication: true, lastSeenPlace: "Reported park", lastSeenTime: "2 hours ago", missingFields: [] };
let stored: any;
let aiCalls = 0;
let nextFacts = facts;
let duringAI: (() => void) | undefined;
const dialect = new PgDialect();
const database: any = {
  select: () => ({
    from: (table: unknown) => ({
      where: (condition: any) => {
        const values = dialect.sqlToQuery(condition).params;
        const rows = table === caseLeadsTable ? [] : stored && values.includes(stored.id) && values.includes(stored.userId) ? [structuredClone(stored)] : [];
        return Object.assign(Promise.resolve(rows), { for: async () => rows });
      },
    }),
  }),
  update: () => ({
    set: (value: any) => ({
      where: async () => { stored = { ...stored, ...value }; },
    }),
  }),
  transaction: (fn: (tx: any) => unknown) => fn(database),
};
mock.module("@workspace/db", { namedExports: { db: database, privateCasesTable, caseLeadsTable } });
mock.module("../middlewares/requireUser.js", {
  namedExports: { requireUser: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.headers["x-test-user"]) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.locals.userId = req.headers["x-test-user"];
    next();
  } },
});
mock.module("../lib/guide-ai.js", {
  namedExports: { extractGuideFacts: async () => { aiCalls++; duringAI?.(); return nextFacts; } },
});
const { default: router } = await import("./guide.js");
const app = express();
app.use(express.json());
app.use((_req, _res, next) => { (_req as any).log = { error() {}, warn() {} }; next(); });
app.use(router);
const server = app.listen(0);
await once(server, "listening");
after(() => { server.close(); server.closeAllConnections(); });
const address = server.address();
if (!address || typeof address === "string") throw new Error("Missing test port");
const base = `http://127.0.0.1:${address.port}`;
function reset() {
  stored = { id, userId: "owner", createdAt: new Date(0), updatedAt: new Date(0),
    data: { firstName: "Test", responderRole: "family-or-guardian", privacyAcknowledged: true, clientRequestId: id, notes: "Original notes" } };
  aiCalls = 0; nextFacts = facts; duringAI = undefined;
}
async function post(path: string, body: unknown, user: string | null = "owner") {
  return fetch(`${base}/guide/${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": user } : {}) }, body: JSON.stringify(body) });
}
test("guide rejects anonymous and other-owner requests before calling AI", async () => {
  reset();
  for (const [user, status] of [[null, 401], ["other", 404]] as const) {
    assert.equal((await post("intake", { caseId: id, text: "Test", revision: 0 }, user)).status, status);
    assert.equal((await post("plan", { caseId: id }, user)).status, status);
  }
  assert.equal(aiCalls, 0);
});
test("intake persists gate and facts, preserving normal notes", async () => {
  reset();
  const response = await post("intake", { caseId: id, text: "A fictional test report", revision: 0 });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const state = GuideIntakeResponse.parse(await response.json());
  assert.equal(state.gate, "allowed");
  assert.deepEqual(stored.data.guide, state);
  assert.equal(stored.data.lastKnownArea, "Reported park");
  assert.equal(stored.data.notes, "Original notes");
  assert.equal((await post("intake", { caseId: id, text: "Stale answer", revision: 0 })).status, 409);
  assert.equal(aiCalls, 1);
});
test("regular edit concurrent with AI never gets overwritten", async () => {
  reset();
  duringAI = () => { stored.updatedAt = new Date(100); stored.data.notes = "Newer edit"; };
  assert.equal((await post("intake", { caseId: id, text: "Test", revision: 0 })).status, 409);
  assert.equal(stored.data.notes, "Newer edit");
  assert.equal(stored.data.guide, undefined);
});
test("blocked gate is saved and cannot produce a plan or optional note", async () => {
  reset(); nextFacts = { ...facts, purpose: "tracking_concern" };
  assert.equal((await post("intake", { caseId: id, text: "Test", revision: 0 })).status, 200);
  assert.equal(stored.data.guide.gate, "blocked");
  assert.equal((await post("plan", { caseId: id })).status, 403);
  assert.equal((await post("note", { caseId: id, text: "Test", revision: 1 })).status, 403);
});
test("notes persist and appear in a report without location results or provider calls", async () => {
  reset(); stored.data.guide = advanceGuide(undefined, facts, "Test", "fixed");
  stored.data.lastKnownArea = facts.lastSeenPlace;
  const saved = await post("note", { caseId: id, text: "Phone reportedly off", revision: 1 });
  assert.equal(saved.status, 200);
  assert.equal(stored.data.guide.revision, 2);
  const plan = await post("plan", { caseId: id });
  assert.equal(plan.status, 200);
  const value = GuidePlanResponse.parse(await plan.json());
  assert.match(value.summary, /Phone reportedly off/);
  assert.equal(value.actions.length, 3);
  assert.ok(value.actions.every((action: any) => action.confidence === null && !action.kind.includes("map")));
  assert.equal(aiCalls, 0);
});
test("unexpected fields and blank messages are rejected", async () => {
  reset();
  for (const input of [{ caseId: id, text: " ", revision: 0 }, { caseId: id, text: "Test", revision: 0, location: "injected" }]) {
    assert.equal((await post("intake", input)).status, 400);
  }
  assert.equal(aiCalls, 0);
});
test("provider quota failure is explicit and leaves saved case unchanged", async () => {
  reset();
  duringAI = () => { throw Object.assign(new Error("private provider message"), { status: 429, code: "credit_balance_exhausted" }); };
  const response = await post("intake", { caseId: id, text: "Test", revision: 0 });
  assert.equal(response.status, 503);
  assert.match(await response.text(), /no available credits/);
  assert.equal(stored.data.guide, undefined);
});
