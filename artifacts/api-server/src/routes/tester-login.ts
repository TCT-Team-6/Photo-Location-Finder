import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import {
  createTicketLimiter, isDedicatedTester, matchesTesterSecret, testerLoginConfig, testerLoginConfigIssue,
  TESTER_EXTERNAL_ID, TESTER_MARKER, TICKET_LIFETIME_SECONDS,
} from "../lib/tester-login";

const router: IRouter = Router();
const allowTicket = createTicketLimiter();
// Serializes account provisioning within an instance; Clerk's unique external ID
// handles concurrent instances. Never reuse an arbitrary email-matched account.
let provisioning: Promise<void> | null = null;

async function getTester() {
  const find = async () => (await clerkClient.users.getUserList({ externalId: [TESTER_EXTERNAL_ID], limit: 2 })).data;
  let users = await find();
  if (!users.length) {
    provisioning ??= (async () => {
      try {
        await clerkClient.users.createUser({
          externalId: TESTER_EXTERNAL_ID,
          emailAddress: ["whereabouts-external-tester@example.test"],
          firstName: "Automation",
          lastName: "Tester",
          skipPasswordRequirement: true,
          privateMetadata: { testerLogin: TESTER_MARKER },
        });
      } catch {
        // Another server may have won the unique-ID race; only accept its
        // correctly marked account, never a different user or email match.
        if (!(await find()).some(isDedicatedTester)) throw new Error("Tester provisioning failed");
      }
    })().finally(() => { provisioning = null; });
    await provisioning;
    users = await find();
  }
  if (users.length !== 1 || !isDedicatedTester(users[0])) throw new Error("Tester identity is unavailable");
  return users[0];
}

router.post("/testing/sign-in-ticket", async (req, res) => {
  res.set({ "Cache-Control": "no-store", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff" });
  const config = testerLoginConfig(process.env);
  if (!config) {
    req.log.warn({ reason: testerLoginConfigIssue(process.env) }, "Tester login configuration is disabled");
    res.status(404).json({ error: "Tester login is not enabled." }); return;
  }
  // Server-to-server only. Never send the long-lived key from browser JavaScript.
  if (req.headers.origin || !matchesTesterSecret(req.get("X-Tester-Key"), config.secret)) {
    res.status(401).json({ error: "Invalid tester credentials." }); return;
  }
  if (Object.keys(req.query).length || (req.body != null &&
    (typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).length))) {
    res.status(400).json({ error: "Do not supply an account, redirect, or other parameters." }); return;
  }
  if (!allowTicket(Date.now())) {
    res.set("Retry-After", "60").status(429).json({ error: "Too many ticket requests. Retry in one minute." }); return;
  }
  try {
    const tester = await getTester();
    const ticket = await clerkClient.signInTokens.createSignInToken({
      userId: tester.id, expiresInSeconds: TICKET_LIFETIME_SECONDS,
    });
    req.log.info({ environment: config.environment }, "Issued dedicated tester sign-in ticket");
    res.json({ ticket: ticket.token, expiresInSeconds: TICKET_LIFETIME_SECONDS, environment: config.environment });
  } catch {
    // Clerk errors can contain sensitive request data. Do not log raw errors.
    req.log.error("Dedicated tester ticket could not be issued");
    res.status(503).json({ error: "Tester account or authentication service is unavailable." });
  }
});

export default router;
