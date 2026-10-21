---
name: Private missing-person case scope
description: Agreed boundaries for missing-person intake and user-supplied evidence.
---

Missing-person cases organize private, user-supplied evidence. Do not automatically search social accounts, crawl friends' posts, download linked photos, match faces, or run case evidence through the existing location finder.

**Why:** The user accepted a safer intake-and-lead-submission flow rather than an identity-search or tracking tool. Relevance assessments and self-declared roles are not independent verification.

**How to apply:** Keep case intake separate from photo-location investigations. Headshots are reference only; links are saved without fetching. Collect minimal details (approximate age and general last-known area), not exact addresses or DOB by default. Do not present scene-location suggestions as current whereabouts.

Case data and attachments must stay owner-only, with no public demo persistence or browser-local persistence of personal details. Deletion must revoke attachment access even if physical storage cleanup needs retrying.

**Why:** The agreed product is a private evidence workspace containing sensitive information, not a public missing-person directory.

**How to apply:** Enforce ownership on the server, maintain source attribution, distinguish reported dates from file metadata, and keep any future sharing or analysis explicitly scoped and separately approved.

The user approved an explicit guided manual case-review step after intake: full-size submitted photos, a timeline of reported dates, observations, and follow-up notes.

**Why:** Saving a case without a clear next action felt incomplete; the user accepted guided review rather than connecting these cases to automated location analysis.

**How to apply:** Make review discoverable on existing as well as newly created cases. Keep reported-taken, posted, and added-to-case dates distinct; missing dates must remain unknown. Review notes are the responder's assessment, not verified findings.
