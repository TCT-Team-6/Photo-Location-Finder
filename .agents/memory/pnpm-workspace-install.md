---
name: pnpm workspace manifest changes
description: An environment-specific reminder to inspect shared workspace configuration after adding a package.
---

After adding a package in this workspace, inspect the shared workspace manifest diff as well as the package and lockfile changes. The installed pnpm version may reorder keys and rewrite comments or override formatting unrelated to the requested dependency.

**Why:** A package add rewrote the security notes and many override declarations even though their intended values did not need to change.

**How to apply:** Keep only the dependency and lockfile changes needed for the task; restore incidental workspace-manifest churn before verification.
