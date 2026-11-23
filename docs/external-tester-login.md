# External tester login

The app provides a dedicated automation login using **real Clerk sessions**.
Normal sign-in and API ownership checks are unchanged. No administrator role,
arbitrary-user impersonation, database bypass, or shared personal account is used.

## Environments

- Preview: use the current development preview origin and `TESTER_LOGIN_SECRET_DEV`.
- Published app: use `https://photo-location-finder-v-6.replit.app` and `TESTER_LOGIN_SECRET_PROD`.
  This route becomes available there only after publishing the change.
- The keys must differ and each must contain 32–512 characters without surrounding
  whitespace. Keep them in the external agent's secret store, not source control.
- Each Clerk environment gets a **separate dedicated account**, created lazily on
  the first authorized request. It has the reserved external ID
  `whereabouts-external-tester-v1` and a server-controlled private metadata marker.
  The reserved `example.test` email is not a deliverable inbox.
- The runtime environment and Clerk key type must agree. Misconfiguration fails
  closed with HTTP 404. A development key cannot be used to sign into production.
- If Replit's private-preview gate prevents access before the request reaches
  this app, your external runner also needs authorized platform access. This
  tester key does not bypass Replit's project privacy controls.

## Protocol

1. From the agent's **server-side runner**, POST to
   `/api/testing/sign-in-ticket` with header `X-Tester-Key: <environment secret>`.
   Send no body or query parameters. Browser-origin requests are rejected.
2. The no-store JSON response contains `ticket`, `expiresInSeconds: 60`, and
   `environment`. Do not log it. The ticket can be redeemed only once.
3. In a **new browser context**, open `/tester-login`. Fill
   `[data-testid="input-tester-ticket"]` with the ticket, then click
   `[data-testid="button-tester-sign-in"]`.
4. Successful login navigates to `/investigate`. Browser API calls use the normal
   Clerk session cookie. Do not attach the tester key to regular API requests.
5. Close the context when finished. Do not persist cookies/storage state unless
   your runner protects that file as a credential. Existing signed-in contexts
   are deliberately rejected to avoid accidentally testing a personal account.

The sign-in page also links to **Automation tester sign-in**. That page accepts
one-use tickets, not the long-lived tester keys.

## Playwright example

Copy `scripts/testing/tester-session.mjs` into your external Node/Playwright project,
or import it from this repository. It exports `createTesterSession`.

```js
import { chromium } from "playwright";
import { createTesterSession } from "./tester-session.mjs";

const environment = process.env.TEST_ENVIRONMENT; // development or production
const secret = environment === "production"
  ? process.env.TESTER_LOGIN_SECRET_PROD
  : process.env.TESTER_LOGIN_SECRET_DEV;
const browser = await chromium.launch();
try {
  const { context, page } = await createTesterSession(browser, {
    baseUrl: process.env.APP_BASE_URL, // HTTPS origin, no path
    environment,
    secret,
  });
  // Run tests on page. Use fictional evidence only.
  // Do not enable screenshots/tracing while the ticket is being entered.
  await page.waitForURL("**/investigate");
  await context.close();
} finally {
  await browser.close();
}
```

## Limits, safety and revocation

- Five authorized ticket requests per minute **per API process**. Autoscaling can
  multiply this limit; it is not an infrastructure-wide quota.
- The account can create, edit and delete **its own** records like any normal user.
  Production uploads/AI calls can incur usage and create real persistent records.
  Use fictional fixtures, and remove only records created by your tests.
- A 60-second **ticket** lifetime does not limit the resulting session to 60 seconds;
  sessions follow Clerk's configured policy. Closing a context removes the
  runner's cookies but is not server-side revocation.
- To block new tickets, remove the corresponding tester secret or set
  `TESTER_LOGIN_DISABLED=true`, restart/redeploy the relevant environment.
  Rotate keys through Secrets if exposed. Disabling issuance does not revoke
  existing tickets or sessions: revoke those sessions or ban the dedicated user
  through your authorized Clerk administration tools when immediate revocation
  is necessary.
- 401: wrong key or a browser-origin request. 404: disabled/misconfigured.
  400: unexpected parameters. 429: wait one minute. 503: Clerk provisioning or
  account unavailable. Never fix a 503 by substituting a personal account.
