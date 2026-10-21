---
name: Loading progress integrity
description: Distinguish decorative pipeline animation from observed backend progress.
---

Loading animations may illustrate a conceptual workflow, but must not present unreported stages as confirmed backend progress.

**Why:** The user requested an animated five-stage waiting display, while the analysis integration returns one response rather than live per-stage updates. Decorative movement must not misrepresent what the application knows.

**How to apply:** Retain actual upload/analysis status separately from illustrative processing stages. No timed completion checkmarks, invented percentages, matches, or confidence values. Only show granular live progress if an actual backend event contract is added. Respect reduced-motion preferences.
