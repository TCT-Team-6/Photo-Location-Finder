---
name: React and Vite cache
description: Runtime React-version mismatch troubleshooting after dependency updates.
---

After changing the workspace React version, pnpm can resolve matching `react` and `react-dom` versions while Vite still serves an older optimized dependency bundle, causing a browser-only version mismatch.

**Why:** the package symlinks were aligned, but the preview still served the prior React DOM bundle until the artifact's Vite cache was cleared.

**How to apply:** First confirm the target artifact resolves matching React packages. If the browser still reports different versions, clear that artifact's Vite dependency cache and restart its managed workflow before changing versions again.