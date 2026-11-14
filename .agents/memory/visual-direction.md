---
name: Whereabouts visual direction
description: User-requested references and usability constraints for the app's visual redesign.
---

Base Whereabouts aesthetics and feel on the (Not Boring) Camera iOS app and https://a24.raviklaassens.com/. It should be a little avant-garde, but design must not impede function. Consult CSS Design Awards winners or finalists when uncertain how to redesign a feature.

**Why:** The user explicitly requested a complete app-wide aesthetic redesign using these references.

**How to apply:** Preserve functional workflows and readable, accessible controls while using tactile surfaces, expressive imagery, and restrained motion. This authorizes visual changes to the previously preserved UI, not changes to privacy boundaries or analysis behavior.

The user wants a fuller, geolocation/OSINT-focused experience rather than sparse layouts. Additional references are https://www.crz.studio/ for animated, substantive storytelling and https://metic.studio/en for the magnifier/inspection theme. Explain the technology and five-stage pipeline; binary-to-metadata or clue reveals may illustrate the process.

**Why:** The user found the redesigned investigation page empty and wanted the visuals to reflect image/video geolocation and missing-person support.
**How to apply:** Use available space for useful investigation context, not decoration alone. Label illustrative clues and metadata, preserve reduced-motion access, and describe only capabilities the app actually provides.

The homepage should primarily follow Metic (https://www.cssdesignawards.com/sites/metic/50230/). Use a fully 3D Three.js/R3F loupe with understated spring inertia and tilt. The latest brief supersedes hover-follow with press-and-hold pickup from a wall-mounted cradle, free dragging, and elastic return on release. Binary is a photo-aligned wall derived from RGB pixels on opaque paper; after one second stillness, a 400–600ms glitch reveals a continuous minified JSON wall. No sidebar or small JSON box.

The glass must refract the actual scene behind it everywhere, including the docked panel and hardware. Pickup growth is only 1.1× (a small 1.12× overshoot), not the earlier large inspection size. Photo/data entry is a feathered, reversible 250ms transition, and cursor hover changes animate rather than snap.

**Why:** The user explicitly corrected empty-looking docked glass, excessive pickup growth, abrupt binary switching, and abrupt cursor feedback.

**Why:** The user explicitly corrected the button-driven magnifier, its static-image optical illusion, and then the sidebar reveal and timing.
**How to apply:** Preserve free dragging and in-lens reveal; provide touch and keyboard equivalents. Distinguish pixel measurements, extracted metadata, and user-authored regional estimates. Use paper (#f4f4f2), ink, and one red accent. The user wants a viewport-height photo/tool-panel section with shared scroll-driven lighting across 3D and CSS surfaces, plus a site-wide pointer cursor with native text input behavior. GSAP/Lenis independent scroll-driven animations supersede the earlier no-animation rule. Preserve existing routes, data, API calls, and logic.
