---
name: Locator model choice
description: User-reported external geolocation model selection and rationale for accurate project descriptions.
---

The user reports that after further testing GAEA and other Qwen-based geolocation models, they retained GPT-4o vision for the external geolocation backend.

**Why:** In the user's tests, the alternatives shared the overconfidence/hallucination flaw and performed worse than GPT-4o vision.

**How to apply:** Do not describe GAEA-7B as the selected production model in submission copy. Attribute the comparison to their testing, not a universal benchmark. This is a user-reported external backend decision, not independent verification of provider internals or evidence that geolocation outputs are guaranteed correct.
