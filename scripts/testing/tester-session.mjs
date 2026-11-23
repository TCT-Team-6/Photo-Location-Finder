/**
 * Import this from your external Playwright runner (Node.js 20+).
 * Never run it in browser JavaScript, enable request tracing, or log its inputs.
 */
export async function createTesterSession(browser, { baseUrl, secret, environment }) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash ||
      base.pathname !== "/") throw new Error("Use the app's HTTPS origin as baseUrl.");
  if (!["development", "production"].includes(environment)) throw new Error("Choose a tester environment.");
  if (!secret || secret.length < 32) throw new Error("Tester secret is missing or too short.");

  // Plain Node fetch: credentials are not included in Playwright request traces.
  const response = await fetch(new URL("/api/testing/sign-in-ticket", base), {
    method: "POST",
    headers: { "X-Tester-Key": secret, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Tester ticket request failed (${response.status}).`);
  const result = await response.json();
  if (result.environment !== environment || typeof result.ticket !== "string" || result.expiresInSeconds !== 60)
    throw new Error("Unexpected tester environment or ticket response.");

  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(new URL("/tester-login", base).href);
    // The long-lived key never enters the page; only the short-lived ticket does.
    await page.getByTestId("input-tester-ticket").fill(result.ticket);
    result.ticket = "";
    await page.getByTestId("button-tester-sign-in").click();
    await page.waitForURL(new URL("/investigate", base).href, { timeout: 30_000 });
    const status = await page.evaluate(async () => (await fetch("/api/investigations")).status);
    if (status !== 200) throw new Error("Tester browser did not receive an authenticated app session.");
    return { context, page };
  } catch {
    await context.close();
    // Do not include SDK/request exception details, which may contain tokens.
    throw new Error("Tester browser sign-in failed. Request a fresh ticket; check configuration and account tasks.");
  }
}
