<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Project overview
TravelGuide is a Next.js 16 App Router site serving per-airport knowledge pages. Guides live in Postgres (`airport_guides` table) and are read through `lib/airport-content.ts` with the `airport-guides` cache tag; edit them via `pnpm guide` (list/show/save), not files. The Airportist Score dataset (score breakdown, amenities, tips, transport, disruption badge) lives in a separate `airport_profiles` table, joined to `airport_guides` by `iata`; kept separate so the guide-generation pipeline can never clobber curated scoring data. Not every airport has a profile yet — `lib/airport-utils.ts`'s `filterAndSortAirports` only ever sees scored airports, so guide-only ones simply don't appear in filtered/sorted views until scored.

### Running the app
- `pnpm dev` starts the dev server on port 3000.
- Standard scripts are in `package.json`: `dev`, `build`, `start`, `lint`.

### Lint
- `pnpm lint` runs ESLint. There are pre-existing lint errors (`@next/next/no-html-link-for-pages` in a few files) — these are in the base code and not regressions.

### AI scripts (optional, require API keys)
- `pnpm generate:airport` — requires `AI_GATEWAY_API_KEY` in `.env.local`.
- `pnpm generate:airport:grok <IATA> | --next [--dry-run]` — local `grok` CLI, no API key needed. Researches and writes both the markdown guide (`airport_guides`) and the Airportist Score profile (`airport_profiles`) in one pass. `--next` picks, in order: any major airport missing a guide, then any major airport missing a score, then the stalest guide — this is how every airport gets rated one by one, not just the original 10. Designed for the VPS cron (flock-guarded, no overlapping runs).
- `pnpm review:airports` — requires `CURSOR_API_KEY` in `.env.local`.
- `pnpm sync:images <IATA>|--next` — sources 5-12 Wikimedia Commons photos per airport (grok CLI curates), uploads to Vercel Blob (`BLOB_READ_WRITE_TOKEN`), writes `airport_images` rows. Runs on the VPS cron at :15/:45 alongside the guide generator.
- `pnpm sync:ratings <IATA>|--next|--all` — fetches each airport's Google Maps aggregate rating + review count via ScrapingBee (`SCRAPINGBEE_API_KEY`), writes `airport_google_ratings` rows (30-day freshness window); pages show it as "Google rating" next to the Airportist Score. `scripts/sync-google-ratings-cron.sh` is the VPS cron wrapper.
- `pnpm sync:lounge-images <IATA>|--all [--dry-run] [--no-grok]` — Wikimedia Commons photos for individual lounges (`airport_lounge_images`, keyed by the lounge's `(iata, slug)`), rendered as a photo strip on the lounge subpage. Same license filter/attribution rules and Blob upload as `sync:images`; the assignment step (which candidate shows which lounge) tries grok, then pi, then strict name matching, and drops photos it can't tie to a specific lounge — most lounges have no Commons photos and that's a normal outcome, not a failure. No `--next` loop for that reason; the weekly cron (`scripts/sync-lounge-images-cron.sh`, Sunday 04:05) sweeps `--all`.
- `pnpm sync:lounges <IATA>|--next [--dry-run] [--limit N]` — same `pi` CLI pattern as `sync:water`, no API keys. Verifies and expands the `airport_lounges` lounge directory (one row per lounge, stable `(iata, slug)` identity, rendered at `/airports/[iata]/lounge/[slug]`) against web sources: the Priority Pass lounge finder, official airport/airline/card-program lounge pages (Delta Sky Club, Amex Centurion, chase.com/sapphire-cards/lounges, …), and recent traveler reports. Matches rows by slug (the model echoes `existingSlug`; deterministic name+terminal fallback), updates in place, never deletes — confirmed-closed lounges get `status: "closed"` so their URLs keep resolving. `--next` picks unverified airports first (majors by traffic rank), then anything past the 180-day freshness window, so it re-verifies forever. `scripts/sync-lounges-cron.sh` is the VPS cron wrapper (:20/:50). `pnpm seed:lounges` is the one-off backfill copying guide jsonb lounges into the table (guarded no-op per airport once any rows exist; the same seeding also runs inside `upsertAirportGuide`, so newly generated guides get lounge rows — and subpages — immediately). The Lounges tab reads the table via `getAirportLoungesWithFallback` and falls back to unlinked guide-jsonb cards for airports without rows.
- `pnpm sync:water <IATA>|--next [--dry-run] [--limit N]` — local `pi` CLI (GPT 5.6 via `openai-codex` provider, no API key; override with `PI_PROVIDER`/`PI_MODEL`), no other keys needed. Backfills `waterOptions` (the Water tab) for guides that predate the field: researches only water via the `pi-web-access` extension's `web_search`/`fetch_content` tools (zero-config, installed user-wide with `pi install npm:pi-web-access`), updates the guide's `waterOptions` frontmatter and `## Water & Hydration` section in place without touching `lastUpdated`, so the grok cron's stalest-first refresh order stays intact. `scripts/sync-water-options-cron.sh` is the VPS cron wrapper (runs at :10/:40); the grok generator fills water options for new guides going forward, so this backfill goes quiet once coverage is complete.
- These are not needed for the core web app.

### Key caveats
- pnpm is the package manager (lockfile: `pnpm-lock.yaml`). Use `pnpm`, not npm.
- `pnpm.onlyBuiltDependencies` in `package.json` controls which packages can run install scripts. If adding new native deps, update that list.
