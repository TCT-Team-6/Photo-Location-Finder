---
name: External tester access
description: Scope and security boundary for the user's external automation agent
---

The user requested programmatic login for an **external** tester in both development and production, with separate tester access secrets.

**Why:** Built-in Replit tester login alone does not provide access to their external agent.

**How to apply:** Keep automation isolated to dedicated test accounts and normal Clerk sessions and ownership checks. Never substitute a personal account, offer arbitrary-user impersonation, or put long-lived tester keys in browser code or URLs. Production testing may create real records or incur AI usage; use fictional fixtures.
