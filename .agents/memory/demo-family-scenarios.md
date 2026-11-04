---
name: Demo family scenarios
description: Fictional family inputs and presentation rules for the public sample cases.
---

Demo family facts are explicit scenario inputs, not photo-derived findings. Use the supplied scorer unchanged, with photo times relative to the time the sample result opens.

**Why:** The user specified fictional family scenarios to demonstrate meaningful urgency levels without changing the real analysis pipeline.

**How to apply:** Keep sample-specific facts and scoring separate from live inference. Lost hiker uses five hours, steep trail, 6°C, afternoon, adult; missing grandparent uses three hours, park, 29°C, evening, age 78/older adult, wandering/confusion and medication; child separated uses thirty minutes, beach, water nearby, 30°C, afternoon, child. Expected levels are High, Critical, High. Do not change the scorer or add unstated scenario facts to reach these levels.

Keep demo warnings concise: one fictional-scenarios line at the top and the scorer's single disclaimer. The five-second named-stage walkthrough is illustrative, not backend stage telemetry.

**Why:** The user requested a less repetitive presentation for a demo video while preserving the distinction from real searches.

**How to apply:** Simplify only demo presentation; retain live-analysis safety explanations and truthful progress behavior.

The expanded public demo is a fictional search-case briefing, including a teen at a public city street at night. Map “city” to the scorer's existing `urban` value; three hours, 12°C, night and teen yield Moderate without changing any rules.

**Why:** The user asked for four precomputed cases, annotations, a decision trail, a walking-distance search plan, an emergency-contact-gated start flow and a printable team summary, without touching auth or live analysis.

**How to apply:** Treat the search radius as an illustrative walking-distance estimate, not tracking or a bound on where someone can be. Keep prepared GPT-4o/OpenStreetMap trail statements explicitly fictional, not evidence of tool calls. Never persist names/care notes entered in the public demo or send them in analytics.
