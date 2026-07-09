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

### Local database (needed for real content)
- The app boots without `DATABASE_URL` but all content sections (guides, profiles, reviews) render empty — so for any meaningful local work you need Postgres.
- `pnpm db:dev` boots a disposable embedded Postgres on port 54329 (no Docker); data persists in the gitignored `.dev-postgres/`. Keep it running in its own terminal.
- Put `DATABASE_URL=postgres://dev:dev@127.0.0.1:54329/honestairport` in `.env.local`, then `pnpm db:migrate` (idempotent; tracks applied migrations in `public.__drizzle_migrations`).
- There is no committed seed for `airport_profiles`/`airport_reviews`. A populated `.dev-postgres/` may already carry guides from a snapshot; the homepage directory only lists airports that have an `airport_profiles` row, while guide-only airports still render as guide-only detail pages at `/airports/[slug]`.
- No `psql` binary is installed; query the DB via `tsx` using `getDb()` from `lib/db` if needed.

### Lint
- `pnpm lint` runs ESLint. There are pre-existing lint errors (`@next/next/no-html-link-for-pages` in a few files) — these are in the base code and not regressions.

### AI scripts (optional, require API keys)
- `pnpm generate:airport` — requires `AI_GATEWAY_API_KEY` in `.env.local`.
- `pnpm generate:airport:grok <IATA> | --next [--dry-run]` — local `grok` CLI, no API key needed. Researches and writes both the markdown guide (`airport_guides`) and the Airportist Score profile (`airport_profiles`) in one pass. `--next` picks, in order: any major airport missing a guide, then any major airport missing a score, then the stalest guide — this is how every airport gets rated one by one, not just the original 10. Designed for the VPS cron (flock-guarded, no overlapping runs).
- `pnpm review:airports` — requires `CURSOR_API_KEY` in `.env.local`.
- `pnpm sync:images <IATA>|--next` — sources 5-12 Wikimedia Commons photos per airport (grok CLI curates), uploads to Vercel Blob (`BLOB_READ_WRITE_TOKEN`), writes `airport_images` rows. Runs on the VPS cron at :15/:45 alongside the guide generator.
- `pnpm sync:ratings <IATA>|--next|--all` — fetches each airport's Google Maps aggregate rating + review count via ScrapingBee (`SCRAPINGBEE_API_KEY`), writes `airport_google_ratings` rows (30-day freshness window); pages show it as "Google rating" next to the Airportist Score. `scripts/sync-google-ratings-cron.sh` is the VPS cron wrapper.
- These are not needed for the core web app.

### Key caveats
- pnpm is the package manager (lockfile: `pnpm-lock.yaml`). Use `pnpm`, not npm.
- `pnpm.onlyBuiltDependencies` in `package.json` controls which packages can run install scripts. If adding new native deps, update that list.
