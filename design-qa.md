# Airport Split-Flap Board and Navbar — Design QA

- Source visual truth: `/tmp/airport-board-reference.jpg`
  (`https://as2.ftcdn.net/v2/jpg/07/44/01/83/1000_F_744018355_aLjwRjjmGe5q2B8ys0rPbFY9DDZKmq49.jpg`)
- Homepage production screenshot: `/tmp/flipflop-navbar-production.png`
- Mobile production screenshot:
  `/tmp/flipflop-navbar-production-mobile-final.png`
- Airport-guide screenshot: `/tmp/flipflop-navbar-guide.png`
- Mobile-menu screenshot: `/tmp/flipflop-mobile-menu-v2.png`
- Desktop viewport: 1280 × 720 CSS px at device scale factor 1
- Mobile viewport: 390 × 844 CSS px at device scale factor 1
- State: production build, loaded data, split-flap animation complete

## Full-view evidence

The homepage remains a dense, warm-black mechanical airport board with
individually framed character cells, condensed off-white lettering, horizontal
row dividers, and green status lamps. The navbar now uses the same material,
character cells, status lamp, proportions, and compact control treatment.

The dark navbar also carries cleanly into the light airport-guide pages. On
mobile, the brand contracts to `HONEST`, the three controls remain visible
without overflow, and the menu opens as a matching dark instrument panel.

## Required fidelity surfaces

- Fonts and typography: uppercase condensed monospaced glyphs stay aligned to
  individual mechanical cells. Utility labels and controls use the same compact
  monospaced vocabulary.
- Spacing and layout rhythm: the 56px navbar and sticky table heading move
  together as the navbar hides on scroll. Desktop and mobile have no horizontal
  overflow.
- Colors and visual tokens: warm near-black and brown panels, off-white type,
  muted brass status text, and green indicator lamps remain consistent across
  the board, navbar, and mobile menu.
- Image quality and asset fidelity: no decorative raster assets, fake
  photographic elements, or WebGL substitutes were introduced. The interface
  itself provides the mechanical treatment.
- Copy and content: the homepage remains limited to navbar controls and the
  airport table. The mobile menu contains only airport browsing and account
  actions.

## Performance verification

- Airport rows use `content-visibility: auto`, layout/paint/style containment,
  and an intrinsic fallback row size, allowing the browser to skip offscreen
  row rendering while preserving the complete server-rendered link list.
- Animated flap pseudo-elements finish at opacity `0`, leaving the static glyph
  layer to render after the transition instead of retaining active overlay
  layers.
- No Three.js/WebGL dependency or client-side board renderer was added.
- Production Web Vitals at `http://localhost:3000/`:
  - TTFB: 10.3ms
  - FCP: 416ms
  - LCP: 416ms
  - CLS: 0
- The homepage airport directory remains server-rendered; all airport rows are
  present as descriptive links.

## Browser verification

- Production build rendered all 11 local database rows.
- Desktop and mobile horizontal overflow: 0px.
- Navbar height: 57px.
- Table heading follows the navbar offset and returns to `top: 0` when the
  navbar hides.
- Search dialog opens and closes from the navbar.
- Airport-row navigation reaches `/airports/sin`, where the styled navbar and
  normal footer remain present.
- Mobile menu locks body scroll, fills the viewport width, and uses the dark
  split-flap palette.
- Browser errors: none.
- Console note: local production preview cannot load the Vercel Analytics
  deployment script; this is expected outside a deployed Vercel environment.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

No P3 changes are required.

final result: passed
