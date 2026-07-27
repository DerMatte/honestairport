# Airport Split-Flap Board — Design QA

- Source visual truth: `/tmp/airport-board-reference.jpg`
  (`https://as2.ftcdn.net/v2/jpg/07/44/01/83/1000_F_744018355_aLjwRjjmGe5q2B8ys0rPbFY9DDZKmq49.jpg`)
- Implementation screenshot: `/tmp/airport-board-production-final.png`
- Combined comparison: `/tmp/airport-board-production-comparison-final.png`
- Responsive evidence: `/tmp/airport-board-production-mobile-final.png`
- Desktop viewport: 1000 × 510 CSS px at device scale factor 1
- Source pixels: 1000 × 509
- Implementation pixels: 1000 × 510
- Mobile viewport and pixels: 390 × 844 at device scale factor 1
- Density normalization: no resampling required; source and desktop
  implementation were compared at effectively identical pixel dimensions.
- State: loaded homepage, split-flap entrance animation complete

## Full-view comparison evidence

The source and production render were placed in one 2000 × 510 comparison
image. Both show a dense, warm-black mechanical board with individually framed
character cells, narrow off-white lettering, horizontal row dividers, and green
status lamps. The implementation intentionally uses a straight-on readable
table rather than copying the source photo's camera perspective and surrounding
terminal lighting.

## Focused-region comparison

A separate crop was not needed. At the matched 1000 × 510 size, the full-view
comparison keeps the first nine rows, individual glyph cells, flap seams,
indicator lamps, column alignment, and row rhythm clearly readable.

## Required fidelity surfaces

- Fonts and typography: the condensed monospaced face, uppercase treatment,
  tracking, size, and character-cell alignment reproduce the source's mechanical
  timetable character. Final glyph size was increased after the first pass.
- Spacing and layout rhythm: dense one-airport rows, narrow gaps, fixed columns,
  and a sticky table heading preserve the board rhythm. Mobile collapses to
  lamp, code, airport, and score without horizontal overflow.
- Colors and visual tokens: warm near-black and brown panels, off-white
  lettering, muted brass disruption text, and green lamps match the source.
- Image quality and asset fidelity: the reference photograph is used only as
  visual direction; the product contains no substituted decorative imagery or
  fake photographic assets. The mechanical cells are the actual interface.
- Copy and content: the visible content is limited to airport code, airport,
  city/country, score, and status. Hero, map, filters, counters, console copy,
  header, and footer are absent from the homepage.

## Comparison history

1. Initial pass
   - P2: glyphs were visibly smaller and dimmer than the reference.
   - Fix: increased the split-flap type scale to
     `clamp(0.96rem, 1.35vw, 1.1rem)` while retaining the dense row height.
   - Post-fix evidence: `/tmp/airport-board-production-comparison-final.png`
     shows stronger character scale without column collisions.
   - P1: CSS-only homepage chrome suppression could persist during a client
     navigation to an airport guide.
   - Fix: made the existing header and extracted footer route-aware with
     `usePathname`, removing the `body:has(...)` suppression.
   - Post-fix evidence: browser checks found zero homepage header/footer
     elements, then one visible header and footer on `/airports/sin`.
2. Final pass
   - No actionable P0, P1, or P2 visual differences remain.
   - The source's oblique photographic perspective is an intentional
     non-product characteristic and not an implementation mismatch.

## Browser verification

- Production build rendered 11 local database rows.
- Homepage header count: 0; footer count: 0.
- Desktop horizontal overflow: 0 px.
- Mobile horizontal overflow: 0 px.
- Sticky column heading remained at `top: 0` while scrolling.
- Airport rows are exposed as descriptive links and the first row navigated to
  `/airports/sin`; guide-page chrome returned correctly.
- Browser errors: none.
- Console note: local production preview cannot load the Vercel Analytics
  deployment script; this is expected outside a deployed Vercel environment.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

No P3 changes are required for this deliberately minimal homepage.

final result: passed
