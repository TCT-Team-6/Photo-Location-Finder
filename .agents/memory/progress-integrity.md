---
name: Loading progress integrity
description: Distinguish decorative pipeline animation from observed backend progress.
---

Loading animations may illustrate a conceptual workflow, but must not present unreported stages as confirmed backend progress.

**Why:** The user requested an animated five-stage waiting display, while the analysis integration returns one response rather than live per-stage updates. Decorative movement must not misrepresent what the application knows.

**How to apply:** Retain actual upload/analysis status separately from illustrative processing stages. No timed completion checkmarks, invented percentages, matches, or confidence values. Only show granular live progress if an actual backend event contract is added. Respect reduced-motion preferences.

Tool labels must name verified integrations rather than guess hidden model names, distinguish non-AI upload/storage work, and account for different analysis desks.

**Why:** The location provider's internal models are not available through the app's integration, and OpenAI model names can be overridden on the server.

**How to apply:** Use provider-level labels when model identity is unavailable, mark optional tools as optional, and never treat illustrative stage labels as evidence of a particular internal tool call.

The user explicitly liked the isolated interactive component preview.

**Why:** They said “nice component preview” before requesting tool labels.

**How to apply:** For future waiting-state changes, offer an isolated preview that does not require uploads or live analysis calls.
