---
name: OpenAI access
description: Project-specific rules for selecting and storing the OpenAI provider credential.
---

Do not retry `setupReplitAIIntegrations`. The user declined Replit AI credit access and instructed that their own provider API key be collected only through the secure secrets flow, never in chat.

**Why:** the user explicitly requested this after declining the initial integration setup.

**How to apply:** For OpenAI access in this project, use the user's securely stored key from application code. Never request, print, or inspect its value.