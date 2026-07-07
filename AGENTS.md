<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Project overview
TravelGuide is a Next.js 16 App Router site serving per-airport knowledge pages. Guides live in Postgres (`airport_guides` table) and are read through `lib/airport-content.ts` with the `airport-guides` cache tag; edit them via `pnpm guide` (list/show/save), not files.

### Running the app
- `pnpm dev` starts the dev server on port 3000.
- Standard scripts are in `package.json`: `dev`, `build`, `start`, `lint`.

### Lint
- `pnpm lint` runs ESLint. There are pre-existing lint errors (`@next/next/no-html-link-for-pages` in a few files) — these are in the base code and not regressions.

### AI scripts (optional, require API keys)
- `pnpm generate:airport` — requires `AI_GATEWAY_API_KEY` in `.env.local`.
- `pnpm review:airports` — requires `CURSOR_API_KEY` in `.env.local`.
- `pnpm sync:images <IATA>|--next` — sources 5-12 Wikimedia Commons photos per airport (grok CLI curates), uploads to Vercel Blob (`BLOB_READ_WRITE_TOKEN`), writes `airport_images` rows. Runs on the VPS cron at :15/:45 alongside the guide generator.
- These are not needed for the core web app.

### Key caveats
- pnpm is the package manager (lockfile: `pnpm-lock.yaml`). Use `pnpm`, not npm.
- `pnpm.onlyBuiltDependencies` in `package.json` controls which packages can run install scripts. If adding new native deps, update that list.
