# Replit prompt — opening results after analysis (and related UX fixes)

Paste everything below the line into Replit Agent. It is based on a live test of the
published app (https://photo-location-finder-v-6.replit.app) on 2026-11-23, using the
tester account on a 1440×900 desktop window and an iPhone 13 viewport (390×664).

Note: the published build is newer than `WAICY-2-submission-branch` (e.g. it has
`/tester-login`, which the branch does not). File/line pointers below come from the branch
and may have moved slightly.

---

## Goal

After an analysis finishes, always take the person straight to what they just made, tell
them clearly when a background report is ready, and keep the results list easy to scan.
Do not change the analysis pipeline, scoring, or API shapes.

## 1. Second upload in the same visit goes to /library (bug, confirmed)

**Repro:** Sign in → New investigation → add 1 photo → Analyze → it opens
`/investigation/<id>` (correct). Click **New investigation** again in the sidebar.

**What happens:**
- The wizard reopens on **step 03**, not step 01.
- The finished photo is still in the tray ("01 ITEMS / LOCAL SELECTION").
- The previous case title is still filled in.
- Adding one new photo shows "PHOTOS 02".
- After analysis, the app goes to **/library** instead of the new report.

This was confirmed on desktop. On iPhone the same stale tray and step-03 state appears.

**Cause:** in `artifacts/whereabouts/src/components/original-media-intake.tsx` (`run()`),
`total = itemsRef.current.length` counts the already-saved item, so
`savedIds.length === 1 && total === 1` is false.

**Fix:**
- When an investigation finishes and the user leaves for its report, clear saved items
  from the intake tray.
- Reset the wizard to step 01 with an empty title.
- Decide the destination from the items processed in *this* run: if exactly one new item
  was analysed, open `/investigation/<id>`; if two or more, open `/library`.
- Do not count previously saved items.

## 2. Tell people when a background report is ready

**What happens:** after "Run in background", the only signal when the report is done is
the small header chip changing from "ANALYZING · 02/05" to "FILED · OPEN REPORT". There
is no toast, no `aria-live` announcement and no browser-tab title change. I tested this
while on My library, and the report took 30–55 s.

**Fix:**
- Show a toast when it completes: "Report ready: <title>". Give it an **Open report**
  button that goes to the same destination as the sheet.
- Announce the same text in a polite `aria-live` region.
- If the tab is hidden, prefix `document.title` with "✓ Report ready ·" until the user
  returns.
- If it fails, show a toast with **Review** that reopens the sheet.

## 3. "FILED · OPEN REPORT" chip stays after the report is opened

The chip stays in the header after the user has already reached the report, and it
survives new uploads. Clear it (`operation.hide` → idle) when the user lands on the
destination route, or when they start a new investigation.

## 4. Header chip is clipped on iPhone

At 390 px wide the chip runs off the right edge ("FILED · OPEN REP",
"ANALYZING · 02/0…").

**Fix:** on screens under 480 px, use a short label ("Ready ›" / "02/05") or an icon-only
chip with an aria-label. Make sure it fits next to the logo with no horizontal overflow.

## 5. Ranked leads list: add a count line and keep long lists in check

**Current behaviour:** "Likely places to check" has no count. With more than 3 leads the
list grows the page; it has no inner scroll and no "show more".
- Desktop, 7 leads: the list was 1282 px tall in a 900 px window.
- iPhone, 7 leads: 1842 px, about 2.8 screens, below the map.

(Live reports returned at most 3 leads; 7 was simulated in the browser only.)

**Fix:**
- Under the heading add a count line, e.g. "3 leads · ranked by confidence". Use "1 lead"
  for one.
- When there are more than 3 leads, show the top 3 plus a "Show all N leads" toggle. On
  desktop, alternatively cap the list at the map's height with
  `overflow-y: auto; overscroll-behavior: contain` and a fade at the bottom edge.
- Keep the map-pin → list `scrollIntoView` behaviour working inside the scroll area.
- On mobile prefer the toggle over a nested scroll.

## 6. Small result-page copy fixes

- Every lead card says "Supporting photo clues unavailable for this place", even when the
  report lists 6 visual clues. Hide that line when there are no per-place clue chips, or
  say "General clues apply — see Details in the frame".
- The decision trail says "1 place carry a Confidence value". It should be "1 place
  carries".
- The header says "Photographed Jul 29, 2011", but the safety panel says "Time since
  photo: Unknown — usable capture metadata unavailable". Use the same capture date in
  both places, or explain why one is ignored.

## 7. Upload error messages

**Unsupported file:** a `.txt` file shows "Choose a JPEG, PNG, WebP, … image, or an MP4, …
video." (good, appears under the tray). Make it name the file and lead with the problem:
"notes.txt isn't a supported photo. Choose a JPEG, PNG, WebP, …".

**Corrupt file:** a corrupt `.heic` (random bytes) is accepted into the tray with no
warning. Check that the image can be decoded on selection (HEIC can be skipped if the
browser can't decode it). If it can't be decoded, show "This file looks damaged — try
exporting it again".

## 8. Step 03 on phones

On iPhone 13 the four large "Field checklist" cards push the Analyze shutter mostly below
the fold. Make the checklist a compact 2×2 of short rows (or collapse it) so **Analyze** is
visible without scrolling.

## Acceptance checks

1. One photo → opens `/investigation/<id>`.
2. Then New investigation → empty tray at step 01; one more photo → opens its own report.
3. Two photos together → `/library`.
4. Run in background → a toast with **Open report** appears when done, and the chip
   clears once opened.
5. A report with more than 3 leads shows a count line and stays compact (toggle or
   contained scroll) on desktop and an iPhone 13 viewport.
6. The unsupported-file message names the file.
7. On iPhone 13 the header chip fits and Analyze is visible on step 03.
