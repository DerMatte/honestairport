# HonestAirport

HonestAirport is a premium traveler-focused airport directory inspired by the clarity of hotelist-style directories, but built for airports. It helps travelers compare airports, understand disruption risk, and find practical Traveler Tips before they leave for the terminal.

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS 4
- shadcn/ui components
- React Hook Form + Zod ready for future forms
- Lucide icons
- Vercel deployment ready

## Getting Started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to view the directory.

## Current MVP

- Homepage hero with search by airport name, code, city, country, or region
- Filterable airport cards by Airportist Score, region, amenities, and disruption level
- Sort options for Highest Score, Most Reviewed, and Least Disruptions
- Lightweight static world map with clickable airport pins
- Detail pages at `/airports/[slug]`
- Tabs for Overview, Getting There, Facilities & Amenities, Traveler Tips & Hacks, Current Disruptions, and Reviews & Photos
- Flighty-style mock disruption data with delay percentages, cancellation pressure, alert tags, and update timestamps
- SEO metadata and airport JSON-LD
- Loading skeletons and empty states

## Seed Airports

The MVP includes 10 major airports:

- JFK, LAX, ORD, ATL
- LHR, CDG, FRA
- DXB, SIN, HND

## Project Structure

```text
app/
  airports/[slug]/page.tsx       Airport detail route
  airports/[slug]/loading.tsx    Detail loading skeleton
  components/                    Product components
  layout.tsx                     Root shell and metadata
  page.tsx                       Homepage route
components/ui/                   shadcn/ui primitives
lib/
  airport-utils.ts               Filtering, sorting, labels, JSON-LD helpers
  data.ts                        Structured sample airport data
  types.ts                       Airport, Disruption, Amenity, Tip, Review types
```

Airport guides live in Postgres (`airport_guides`); use `pnpm guide` to list, export, and save them. The former Markdown files under `content/airports/` were a one-time seed source and have been removed.

## Data Model

Core interfaces live in `lib/types.ts`:

- `Airport`
- `Disruption`
- `Amenity`
- `Tip`
- `Review`

Each airport includes an Airportist Score, score breakdown, stats, coordinates, transport options, amenities, Traveler Tips, reviews, placeholder photo metadata, and current disruption data.

## Disruption Data Roadmap

Current disruption data is realistic mock data. A production version can replace it with a server-side ingestion pipeline that scrapes `https://flighty.com/airports` with Cheerio on a Vercel Cron schedule, or with a licensed third-party aviation operations API exposed through a Next.js route handler.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
```

## Future Roadmap

- Real disruption ingestion and historical reliability trends
- User-submitted reviews and tip validation
- Airport comparison pages
- Personalized layover recommendations
- Real terminal navigation and walking-time maps
- Photo uploads with moderation
- Forms powered by React Hook Form + Zod
