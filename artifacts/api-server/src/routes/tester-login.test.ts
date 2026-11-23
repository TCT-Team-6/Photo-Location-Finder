import assert from "node:assert/strict";
import { once } from "node:events";
import { after, mock, test } from "node:test";
import express from "express";
import { TESTER_EXTERNAL_ID, TESTER_MARKER } from "../lib/tester-login";

// Fictional credentials, not the real runner's configured secrets.
process.env.NODE_ENV = "development";
process.env.CLERK_SECRET_KEY = "sk_test_fixture";
process.env.TESTER_LOGIN_SECRET_DEV = "d".repeat(48);
process.env.TESTER_LOGIN_SECRET_PROD = "p".repeat(48);
delete process.env.TESTER_LOGIN_DISABLED;
let users: any[] = [];
let issuedTo: string | undefined;
let lookups = 0;
mock.module("@clerk/express", { namedExports: { clerkClient: {
  users: {
    getUserList: async ({ externalId }: any) => {
      assert.deepEqual(externalId, [TESTER_EXTERNAL_ID]); lookups++; return { data: users };
    },
    createUser: async (data: any) => { users = [{ ...data, id: "dedicated_fixture", banned: false, locked: false }]; return users[0]; },
  },
  signInTokens: {
    createSignInToken: async ({ userId, expiresInSeconds }: any) => {
      issuedTo = userId; assert.equal(expiresInSeconds, 60); return { token: "fictional-one-use-ticket" };
    },
  },
} } });
const { default: router } = await import("./tester-login.js");
const app = express();
app.use(express.json());
app.use((req, _res, next) => { (req as any).log = { info() {}, error() {}, warn() {} }; next(); });
app.use(router);
const server = app.listen(0);
await once(server, "listening");
after(() => { server.close(); server.closeAllConnections(); });
const address = server.address();
if (!address || typeof address === "string") throw new Error("Missing test port");
const url = `http://127.0.0.1:${address.port}/testing/sign-in-ticket`;
const goodHeaders = { "X-Tester-Key": "d".repeat(48), "Content-Type": "application/json" };
test("rejects untrusted requests before accessing Clerk and never caches responses", async () => {
  for (const headers of [{}, { "X-Tester-Key": "wrong" }, { "X-Tester-Key": "p".repeat(48) }, { ...goodHeaders, Origin: "https://attacker.example" }]) {
    const response = await fetch(url, { method: "POST", headers });
    assert.equal(response.status, 401); assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(lookups, 0);
  for (const body of [{ userId: "owner" }, { redirect: "https://attacker.example" }, []]) {
    assert.equal((await fetch(url, { method: "POST", headers: goodHeaders, body: JSON.stringify(body) })).status, 400);
  }
  assert.equal((await fetch(url + "?userId=owner", { method: "POST", headers: goodHeaders })).status, 400);
  assert.equal(lookups, 0);
});
test("provisions only the dedicated marked user and issues a 60-second ticket", async () => {
  const response = await fetch(url, { method: "POST", headers: goodHeaders });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ticket: "fictional-one-use-ticket", expiresInSeconds: 60, environment: "development" });
  assert.equal(issuedTo, "dedicated_fixture");
  assert.equal(users[0].privateMetadata.testerLogin, TESTER_MARKER);
});
test("will not issue tickets to an unmarked or banned existing account", async () => {
  issuedTo = undefined;
  users[0].privateMetadata = {};
  assert.equal((await fetch(url, { method: "POST", headers: goodHeaders })).status, 503);
  assert.equal(issuedTo, undefined);
  users[0].privateMetadata = { testerLogin: TESTER_MARKER };
  users[0].banned = true;
  assert.equal((await fetch(url, { method: "POST", headers: goodHeaders })).status, 503);
  assert.equal(issuedTo, undefined);
});
test("disabled configuration prevents all account operations", async () => {
  const before = lookups;
  process.env.TESTER_LOGIN_DISABLED = "true";
  assert.equal((await fetch(url, { method: "POST", headers: goodHeaders })).status, 404);
  assert.equal(lookups, before);
});
