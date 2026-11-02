---
name: Preview process lifecycle
description: Why the Whereabouts managed preview starts Vite directly, and how to handle recurring orphaned servers.
---

Keep the Whereabouts managed development service's Vite startup as a direct Node process, without adding a pnpm-to-shell-to-Vite process chain again.

**Why:** After task merges/restarts, the previous pnpm-spawned Vite process repeatedly survived while the replacement workflow failed because the port was occupied. Direct Node startup was verified to terminate the previous server on a subsequent managed restart.

**How to apply:** Artifact-managed service commands execute from the artifact directory, not the workspace root. Use artifact-relative paths and validated artifact updates. If a stale server reappears, confirm its command and working directory before terminating only that artifact's old process group; never stop unrelated services.
