import { test } from "node:test";
import assert from "node:assert/strict";
import { createTicketLimiter, isDedicatedTester, matchesTesterSecret, testerLoginConfig, TESTER_EXTERNAL_ID, TESTER_MARKER } from "./tester-login";

const dev = "d".repeat(48), prod = "p".repeat(48);
const env = { NODE_ENV: "development", CLERK_SECRET_KEY: "sk_test_fixture", TESTER_LOGIN_SECRET_DEV: dev, TESTER_LOGIN_SECRET_PROD: prod };
test("uses separate keys and correct Clerk environment; fails closed", () => {
  assert.equal(testerLoginConfig(env)?.secret, dev);
  assert.equal(testerLoginConfig({ ...env, NODE_ENV: "production", CLERK_SECRET_KEY: "sk_live_fixture" })?.secret, prod);
  for (const change of [
    { NODE_ENV: undefined }, { NODE_ENV: "test" }, { TESTER_LOGIN_DISABLED: "true" },
    { TESTER_LOGIN_SECRET_DEV: "" }, { TESTER_LOGIN_SECRET_DEV: "short" },
    { TESTER_LOGIN_SECRET_DEV: prod }, { TESTER_LOGIN_SECRET_DEV: ` ${dev}` },
    { CLERK_SECRET_KEY: "sk_live_fixture" }, { NODE_ENV: "production" },
  ]) assert.equal(testerLoginConfig({ ...env, ...change }), null);
});
test("compares complete keys without accepting prefixes or other environment key", () => {
  assert.equal(matchesTesterSecret(dev, dev), true);
  for (const bad of [undefined, "", prod, dev.slice(1), dev + "x", "a".repeat(513)])
    assert.equal(matchesTesterSecret(bad, dev), false);
});
test("only a dedicated, marked, unlocked account can receive tickets", () => {
  const user = { id: "user_fixture", externalId: TESTER_EXTERNAL_ID, privateMetadata: { testerLogin: TESTER_MARKER }, banned: false, locked: false };
  assert.equal(isDedicatedTester(user), true);
  for (const change of [{ externalId: null }, { externalId: "owner" }, { privateMetadata: {} }, { banned: true }, { locked: true }])
    assert.equal(isDedicatedTester({ ...user, ...change }), false);
});
test("ticket issuance throttle resets after its window", () => {
  const allow = createTicketLimiter(2);
  assert.equal(allow(1), true); assert.equal(allow(2), true);
  assert.equal(allow(3), false); assert.equal(allow(60_001), true);
});
