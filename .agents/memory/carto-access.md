---
name: CARTO access
description: Raster tile authentication and misleading successful image responses
---
CARTO raster maps require a Basemaps key as of September 25, 2026, per https://docs.carto.com/faqs/carto-basemaps.

**Why:** Missing keys return tiles displaying an API-key notice instead of geography; checking only HTTP success misses the failure.

**How to apply:** Authenticate both background and labels layers. Preserve attribution and an origin referrer for domain-restricted browser keys. Verify actual tile content, not just response status; never assume old anonymous CARTO examples still work.
