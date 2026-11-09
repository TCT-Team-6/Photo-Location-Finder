---
name: Image Locator integration rollout
description: User-directed constraints for extending the existing provider integration in small reviewed steps.
---

Extend the Image Locator integration one step at a time, then stop and summarize for user testing before continuing. Preserve existing layouts, themes, loading/retry panels, photo dates, optional details, library, maps, lead refresh, and the separate Recreation/Journalism desks.

**Why:** The user supplied an integration prompt explicitly requiring small careful changes without breaking working features.

**How to apply:** Keep Image Locator calls server-to-server and PostgreSQL as the source of truth. Do not adopt the provider's ephemeral case storage or internal GPS-test endpoints. Database changes must only add nullable columns; change API contracts through the OpenAPI spec and code generation. Run the requested checks and disclose pre-existing failures rather than claiming a clean whole-project check. These constraints do not authorize connecting private missing-person case evidence to automated location analysis.

Video analysis uses persisted background work rather than a browser request that stays open for several minutes. Reliable production execution needs always-on compute; approving the feature plan did not authorize changing publishing settings.

**Why:** The user approved background video jobs and an always-on hosting requirement after being told that Autoscale is request-based and Reserved VM hosting may change costs. A six-minute upstream timeout is not a guarantee that a browser or hosting proxy will keep the request alive.

**How to apply:** Preserve job recovery and per-record access controls, resume status checking after reloads, and obtain separate approval before changing production hosting. Do not describe video processing as reliable on idle Autoscale merely because jobs are persisted.
