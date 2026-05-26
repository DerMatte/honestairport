# TravelGuide — Per-Airport Knowledge Pages

The best practical travel information for major airports, presented as clean, scannable Markdown pages (one per airport).

**Focus**: Security tips, clever tricks & hacks, navigation, lounges, and ground transport — prioritized for real travelers.

Inspired by high-signal "grokipedia"-style knowledge pages.

## Getting Started

```bash
npm install
npm run dev
```

Visit http://localhost:3000 — you'll see the airport directory with live search.

Click any airport (JFK and LAX have real high-quality content) to see the rendered page.

## Key Features (Current)

- Extremely simple Markdown-driven content (`/content/airports/*.md`)
- Clean, readable design with tips & tricks front-and-center
- Client-side search on the directory
- Fully static/SSG pages (great performance)
- AI SDK-powered generator script for drafting new pages

## Adding a New Airport (Manual)

1. Create `content/airports/xxx.md` (lowercase IATA).
2. Follow the exact heading structure used in `jfk.md` / `lax.md`.
3. Add proper YAML frontmatter (`iata`, `name`, `lastUpdated`, `sources`, optional `quickFacts`).
4. The page appears automatically.

## Using the AI Content Generator (Recommended for Drafts)

```bash
# Requires AI_GATEWAY_API_KEY (your Vercel AI Gateway key with xAI access)
AI_GATEWAY_API_KEY=your_gateway_key npx tsx scripts/generate-airport.ts LHR
AI_GATEWAY_API_KEY=your_gateway_key npx tsx scripts/generate-airport.ts CDG "Focus on families and long-haul connections"
```

The generator uses `streamText` + **Grok 4.3 via the Vercel AI Gateway** (model: `xai/grok-4.3`).

**Always** human-review and fact-check generated pages before publishing. The script is a powerful drafting assistant, not a source of truth.

## Tech Stack (Intentionally Minimal)

- Next.js App Router + TypeScript
- Tailwind
- `gray-matter` + `react-markdown` + `remark-gfm` (simple, no heavy MDX)
- Vercel AI SDK (`ai` + `@ai-sdk/openai`) — used only in the generator script

No database. No CMS. Pure files + Git.

## Deploy

Deploy to Vercel with one click (or `vercel` CLI). Everything is static and works great on the free tier.

## Philosophy

- One excellent page beats many mediocre ones.
- Tips and tricks are the star of the show.
- Every claim should be traceable to an official or highly reputable source.
- Start narrow, go deep.

---

Built following the approved implementation plan for a simple, high-signal airport knowledge site.
