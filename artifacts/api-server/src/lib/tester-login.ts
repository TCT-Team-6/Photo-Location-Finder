import { createHash, timingSafeEqual } from "node:crypto";

export const TESTER_EXTERNAL_ID = "whereabouts-external-tester-v1";
export const TESTER_MARKER = "whereabouts-agent-login-v1";
export const TICKET_LIFETIME_SECONDS = 60;

export function testerLoginConfigIssue(env: NodeJS.ProcessEnv): string | null {
  const production = env.NODE_ENV === "production";
  if (env.NODE_ENV !== "production" && env.NODE_ENV !== "development") return "Unsupported runtime environment";
  if (env.TESTER_LOGIN_DISABLED === "true") return "Explicitly disabled";
  const secret = production ? env.TESTER_LOGIN_SECRET_PROD : env.TESTER_LOGIN_SECRET_DEV;
  if (!secret || secret.length < 32 || secret.length > 512 || secret.trim() !== secret) return "Tester key must contain 32–512 characters without surrounding whitespace";
  if (env.TESTER_LOGIN_SECRET_DEV === env.TESTER_LOGIN_SECRET_PROD) return "Development and production tester keys must differ";
  // A live Clerk tenant must never accept the development access key.
  if (!production && !env.CLERK_SECRET_KEY?.startsWith("sk_test_")) return "Development runtime requires a test Clerk tenant";
  if (production && !env.CLERK_SECRET_KEY?.startsWith("sk_live_")) return "Production runtime requires a live Clerk tenant";
  return null;
}

export function testerLoginConfig(env: NodeJS.ProcessEnv) {
  if (testerLoginConfigIssue(env)) return null;
  const production = env.NODE_ENV === "production";
  const secret = (production ? env.TESTER_LOGIN_SECRET_PROD : env.TESTER_LOGIN_SECRET_DEV)!;
  return { secret, environment: production ? "production" as const : "development" as const };
}

export function matchesTesterSecret(supplied: string | undefined, expected: string) {
  if (!supplied || supplied.length > 512) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(expected));
}

export type TesterIdentity = {
  id: string;
  externalId: string | null;
  privateMetadata: Record<string, unknown>;
  banned: boolean;
  locked: boolean;
};

export function isDedicatedTester(user: TesterIdentity) {
  return user.externalId === TESTER_EXTERNAL_ID &&
    user.privateMetadata.testerLogin === TESTER_MARKER && !user.banned && !user.locked;
}

/** Bounded per-process throttle, after credential validation; no unbounded IP map. */
export function createTicketLimiter(limit = 5, windowMs = 60_000) {
  let start = 0;
  let count = 0;
  return (now: number) => {
    if (now - start >= windowMs) { start = now; count = 0; }
    if (count >= limit) return false;
    count++;
    return true;
  };
}
