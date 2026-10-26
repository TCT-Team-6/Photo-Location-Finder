---
name: Image Locator integration rollout
description: User-directed constraints for extending the existing provider integration in small reviewed steps.
---

Extend the Image Locator integration one step at a time, then stop and summarize for user testing before continuing. Preserve existing layouts, themes, loading/retry panels, photo dates, optional details, library, maps, lead refresh, and the separate Recreation/Journalism desks.

**Why:** The user supplied an integration prompt explicitly requiring small careful changes without breaking working features.

**How to apply:** Keep Image Locator calls server-to-server and PostgreSQL as the source of truth. Do not adopt the provider's ephemeral case storage or internal GPS-test endpoints. Database changes must only add nullable columns; change API contracts through the OpenAPI spec and code generation. Run the requested checks and disclose pre-existing failures rather than claiming a clean whole-project check. These constraints do not authorize connecting private missing-person case evidence to automated location analysis.
