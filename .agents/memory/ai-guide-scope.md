---
name: AI Guide safety boundary
description: Approved live-guide scope and fictional guided demo requirements.
---

Keep the existing upload and analysis screens as they are. For live cases, the AI Guide organizes the user's last-seen information and evidence, asks follow-up questions, shows the Call 911 button and safety notice, and prepares a summary to share with authorized responders. It must not infer whereabouts or connect missing-person evidence to location analysis. Every action needs a tap from the user.

**Why:** The user explicitly approved the privacy-safe version instead of the original automatic missing-person location workflow.

**How to apply:** Keep live guide intake separate from the location pipeline. Preserve urgency scoring and regular screens. Keep summaries grounded in reported facts, without assigning invented confidence scores.

The Alex and Grandpa Joe guided demos use saved data and show location results and grounded action cards. Show “Sample case, fictional data” on every demo screen.

**Why:** The user requested deterministic fictional demonstrations, clearly distinguished from live cases.

**How to apply:** Do not call live AI or save demo cases. Preserve the label through conversation, progress, results and print views.

For photo-storage repairs, do not set up any new paid service. Reuse the regular investigation flow's storage method and keep photos private. If that flow also needs App Storage, stop and tell the user rather than setting it up.

**Why:** The user explicitly required this boundary before any storage configuration changes.

**How to apply:** Inspect the existing upload path first; do not provision App Storage under the current authorization.
