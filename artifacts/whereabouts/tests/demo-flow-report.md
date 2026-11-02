# Anonymous demo journey verification

Date: 2026-11-02 (UTC)  
Route: `/demo`  
Authentication: none; no sign-in, account creation, database seeding, or product-code changes.

## Browser observations

- Opened the anonymous overview and confirmed the fixture IDs from `src/lib/demo-cases.json`: `sample-lost-hiker`, `sample-grandparent` (the Missing grandparent sample), and `sample-child-separated`.
- Overview card main-button and separate result-button flows were exercised for all three IDs. Each result was compared with the stored JSON: title, summary/context, original image loaded, source/license links, all clue labels/observations/significance text, all candidate places/regions/countries/scores/rationales/clue tags, coordinates, and map hrefs. Fictional-scenery and precomputed notices and `/sign-in` link were present.
- Candidate 2 was selected in the lost-hiker result; it became pressed and the map note changed to `Selected map lead 2: High Tatras.` Back returned to Overview.
- My library was opened anonymously. All three samples' main card buttons and separate result buttons opened matching complete results; Back returned to My library. Each result passed the same fixture comparisons.
- New investigation was opened. All three IDs were selected with `select-demo-sample`; the child-separated thumbnail picker also changed the selected value and preview. All three runs opened their exact stored result. A read-only DOM mutation observer captured `Simulated demo step`, `No live pipeline is running`, Run disabled, and `/sign-in` during the transient progress state for each run.
- Mobile viewport was resized to 390×844. All three mobile navigation tabs were used, and visible `link-demo-sign-in-mobile` (`/sign-in`) was confirmed on Overview, results, library, and New investigation. During a mobile grandparent run, the progress observer confirmed that this mobile link remained visible and targeted `/sign-in`.
- The request listener was attached before initial navigation and observed 346 requests through the completed journey. It recorded no `/api` requests and no same-origin application POST/PUT/PATCH/DELETE writes. Path-name matches for “upload” and “analysis” were Vite source-module GETs, not runtime upload/analysis calls. Three POSTs went to external Clerk development/authentication or protection hosts (`dev_browser`, `environment`, and `probe`); these were not application API writes. External Clerk, font and OpenStreetMap traffic was observed separately. No console or page exceptions were reported; browser warnings included the Clerk development-key/preload warnings.

## Reusable test

`demo-flow.spec.ts` contains the full intended regression journey, including all sample/affordance combinations in Overview and My library, all picker runs, progress-state capture, mobile checks, and request-write assertions. The test was discovered by Playwright's `--list`, but execution could not launch Chromium because the configured `chromium_headless_shell` executable is absent. No browser was installed, consistent with the no-install request; the spec has not completed under the standalone test runner.

Run from `artifacts/whereabouts`:

```sh
pnpm exec playwright install chromium
DEMO_BASE_URL=https://<preview-host> pnpm test:e2e tests/demo-flow.spec.ts
```

The workspace manifest already lists `@playwright/test` and `test:e2e`; no package install or manifest edit was made. To run the standalone spec, provision the matching Playwright Chromium headless-shell browser, then run the command above. `DEMO_BASE_URL` is optional when `REPLIT_DEV_DOMAIN` is set. The API workflow was not started.

The parent agent added the Playwright dependency, runner configuration, command, and generated-output exclusions. After the browser pass, the retained spec was corrected to return to the picker between runs, wait for image loading, exercise dropdown changes independently, and assert visible desktop sign-in links. Playwright discovery and TypeScript checks passed; the retained spec was not rerun in a browser. The browser observations above came from the completed interactive verification, not from the standalone runner.
