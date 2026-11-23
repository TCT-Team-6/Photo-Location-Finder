---
name: Whereabouts visual direction
description: User-requested references and usability constraints for the app's visual redesign.
---

Readability takes priority: body text at least 16px, main paragraphs 18px, labels and captions at least 13px. Use monospace only for tags of three words or fewer; longer labels and sentences use sans-serif sentence case. Gray text must meet 4.5:1 contrast.

**Why:** The user requested app-wide readability improvements after the visual redesign.
**How to apply:** Preserve these minimums in future UI work. Keep Home to the hero, three-step how-it-works, audience section, and one safety section; put detailed methods and technology explanations on About.

Base Whereabouts aesthetics and feel on the (Not Boring) Camera iOS app and https://a24.raviklaassens.com/. It should be a little avant-garde, but design must not impede function. Consult CSS Design Awards winners or finalists when uncertain how to redesign a feature.

**Why:** The user explicitly requested a complete app-wide aesthetic redesign using these references.

**How to apply:** Preserve functional workflows and readable, accessible controls while using tactile surfaces, expressive imagery, and restrained motion. This authorizes visual changes to the previously preserved UI, not changes to privacy boundaries or analysis behavior.

The user wants a fuller, geolocation/OSINT-focused experience rather than sparse layouts. Additional references are https://www.crz.studio/ for animated, substantive storytelling and https://metic.studio/en for the magnifier/inspection theme. Explain the technology and five-stage pipeline; binary-to-metadata or clue reveals may illustrate the process.

**Why:** The user found the redesigned investigation page empty and wanted the visuals to reflect image/video geolocation and missing-person support.
**How to apply:** Use available space for useful investigation context, not decoration alone. Label illustrative clues and metadata, preserve reduced-motion access, and describe only capabilities the app actually provides.

The homepage should primarily follow Metic (https://www.cssdesignawards.com/sites/metic/50230/). Use a fully 3D Three.js/R3F loupe with understated spring inertia and tilt. The latest brief supersedes hover-follow with press-and-hold pickup from a wall-mounted cradle, free dragging, and elastic return on release. Binary is a photo-aligned wall derived from RGB pixels on opaque paper; after one second stillness, a 400–600ms glitch reveals a continuous minified JSON wall. No sidebar or small JSON box.

The glass must refract the actual scene behind it everywhere, including the docked panel and hardware. Pickup growth is only 1.1× (a small 1.12× overshoot), not the earlier large inspection size. Photo/data entry is a feathered, reversible 250ms transition, and cursor hover changes animate rather than snap.

**Why:** The user explicitly corrected empty-looking docked glass, excessive pickup growth, abrupt binary switching, and abrupt cursor feedback.

The latest optical direction is a macro view of a display: 6× default zoom with 3×/6×/10× detents, distinct channel-brightness RGB light strips, dark screen-door gaps, subtle bloom, and consistent optics over all page surfaces. This supersedes the earlier 2.5× pixel-block view.

**Why:** The user found the binary and JSON blurry and requested visibly sharp pixel blocks.

**How to apply:** Keep the loupe above page content in a fixed overlay while anchored to the photo/tool-panel bounds and scrolling position; overshoot outside the bounds uses 20% rubber-band resistance.

Workspace screens should follow “The Field Desk”: precise paper sheets, numbered index navigation, specimen trays with crop marks, contact-sheet photos, folder tabs, and restrained paper-like motion. Preserve existing text, routes, data and logic. Use paper/ink/grey/red only, at most 2px corners except avatars/loupes, visible keyboard focus, and reduced-motion alternatives.

**Why:** The user explicitly rejected the generic dashboard layout and requested this direction across all workspace, guide, demo, settings and authentication screens.

**How to apply:** Apply the shared treatment to populated and empty states, not just the shell; never delay interaction for animation or fabricate upload progress.

Prefer fewer objects with richer optional interactions. New Investigation is a one-step-at-a-time photo/context/analyze flow. Workspace pages have at most one bordered box and one visible primary action; longer helper copy belongs in tooltips. All physical controls need click and keyboard alternatives, and only one draggable area per screen. Sound is off by default; reduced motion removes physics.

**Why:** The user explicitly requested less clutter and more usable, camera-like physical controls.

**How to apply:** Preserve existing capabilities and backend contracts while simplifying presentation. Keep the loupe decrypt on a fixed character grid: one-second dwell, approximately 600ms lock/scramble/radial resolve, immediate approximately 250ms reverse on movement; reduced motion uses a 150ms crossfade.

Workspace physical controls should share one demand-driven R3F Canvas with separate drei Views, matching lights and themed materials. Fixed breakpoint-specific footprints must not change with state; use working static-image fallbacks and normal keyboard controls.

**Why:** The user rejected flat dial/shutter controls and layout jumps, requesting the homepage loupe's dimensional quality throughout.

**How to apply:** Keep progress off the shutter and in a dismissible/reopenable paper sheet. Stage transitions require real events; unavailable detail must be labeled estimated. Preserve inputs on failure, distinguish stopping queued client work from stopping accepted server analysis, and keep motion optional.

The latest control brief requires flat-to-screen, top-down narrow-perspective geometry, not tilted objects. Use real physical materials, softbox reflections and mesh depth; no CSS/SVG imitation metal. Fallbacks must be PNG frames rendered from the same models. Visible control labels appear once only.

**Why:** The user rejected the prior controls as fake-looking and reported duplicated labels and a clipped swatch book.

**How to apply:** Keep one shared canvas, move light subtly rather than tilting controls, and reserve room for the swatch fan. Avatar initials must replace both missing URLs and failed image loads; the user has repeated this correction.

The desk selector and switches should feel like tactile 1970s lab instruments: satin finishes, fixed upright labels, direct knob dragging, hard stops, and short timed detents without springs or bounce. Remove decorative loupes and hidden messages from empty trays, not the homepage optical instrument.

**Why:** The user rejected controls that drift while scrolling, clipped objects, rotating desk labels, and switches whose states were indistinguishable.

**How to apply:** Prioritize exact scroll alignment and shadow/motion clearance before visual embellishment. Switch states must use position, a lamp or mark, and explicit ON/OFF text, remaining distinguishable in grayscale.

Hidden instrument panels must not retain active Drei render portals or explicitly visible fallback images.

**Why:** Drei's hidden/unmount lifecycle clears its scissored framebuffer area, which can erase overlapping active Views. A child's explicit `visibility:visible` also overrides an ancestor's hidden visibility and exposes ghost fallbacks.

**How to apply:** Keep layout placeholders when needed, but gate scene portals and fallback visibility on the panel's actual visibility. On removal, request a complete redraw.

Overview counters should resemble black mechanical split-flap clocks with white numerals and integrated product-name labels. “Most recent” should include the actual saved photograph as a raised Three.js print, not only its trail name.

**Why:** The user explicitly requested this reference-led material treatment, hinged split-flap motion, and tactile flip sound.

**How to apply:** Preserve real counts and private photo access; respect sound and reduced-motion preferences. Never substitute specimen counts or stock photographs for account data.

Image investigation results prioritize a full-width title, photo/evidence beside the geographic confidence map, full-width ranked candidates with a raised top lead, and safety information last.

**Why:** The user explicitly requested this information hierarchy and independently weighted geographic fields rather than one merged hotspot.

**How to apply:** Preserve geographic separation and never imply model scores are calibrated probabilities or that illustrative field widths are measured search radii.

OSM tile requests must send an origin-only Referer; do not apply the private-photo `no-referrer` policy to map tiles.

**Why:** Suppressing the Referer violates the OSM tile policy and produced blocked-map tiles. Origin-only identification avoids leaking investigation paths while identifying the website.

**How to apply:** Keep tile attribution, normal browser caching and the documented tile host; retain no-referrer on unrelated private-context outbound image requests.

Do not put an effectful renderer-failure detector in R3F Canvas's `fallback` prop.

**Why:** Fiber mounts that fallback as children of the HTML canvas even when canvas is supported. A fallback component's effect can falsely declare WebGL unavailable and unmount the real renderer.

**How to apply:** Use inert fallback content and detect real renderer creation errors or context loss separately. The user explicitly requires stopping and reporting actual 3D rendering failures rather than substituting CSS.

Canvas glyph calibration must use a positive total glyph height, measured with an alphabetic baseline, with a finite bounded fallback.

**Why:** Some browsers return negative ascent under a top baseline; treating ascent alone as height can silently produce a blank data wall despite passing unit/build checks.

**How to apply:** Validate metric signs and range before deriving text size or loop spacing, and verify visible GPU text rather than trusting phase/status attributes alone.

Live Three.js canvas textures must be reallocated when their canvas dimensions change, not merely marked for update.

**Why:** Three r187 uses immutable GPU texture storage; resizing a canvas and reusing its allocation can leave the loupe black or sampling stale content despite correct UI state.

**How to apply:** Track allocated dimensions separately from the mutable canvas, upload a replacement texture on resize, update its sampler binding, and dispose the old resource. Verify rendered pixels as well as timing attributes.

**Why:** The user explicitly corrected the button-driven magnifier, its static-image optical illusion, and then the sidebar reveal and timing.
**How to apply:** Preserve free dragging and in-lens reveal; provide touch and keyboard equivalents. Distinguish pixel measurements, extracted metadata, and user-authored regional estimates. Use paper (#f4f4f2), ink, and one red accent. The user wants a viewport-height photo/tool-panel section with shared scroll-driven lighting across 3D and CSS surfaces, plus a site-wide pointer cursor with native text input behavior. GSAP/Lenis independent scroll-driven animations supersede the earlier no-animation rule. Preserve existing routes, data, API calls, and logic.
