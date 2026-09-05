import { Suspense } from "react";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { AirportDirectory } from "@/app/components/airport-directory";
import { DirectorySkeleton } from "@/app/components/loading-skeletons";
import {
  AIRPORT_GUIDES_CACHE_TAG,
  AIRPORT_PROFILES_CACHE_TAG,
  getAllAirports,
  getAllHonestAirports,
} from "@/lib/airport-content";
import { toAirportDirectoryAirport } from "@/lib/airport-utils";

function HomeHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_100%_at_85%_0%,color-mix(in_oklab,var(--chart-2)_18%,transparent),transparent_60%),linear-gradient(180deg,color-mix(in_oklab,var(--primary)_7%,var(--background)),var(--background))]"
      />
      <div className="relative mx-auto max-w-7xl px-5 pt-14 pb-8 sm:px-6 sm:pt-20 sm:pb-10 lg:pt-24 lg:pb-12">
        <p className="font-mono text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Traveler airport scores
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
          Honest scores and traveler advice — get through every airport with speed
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Compare Airportist Scores, disruption risk, security times, and practical
          traveler advice before you fly.{" "}
          <Link
            href="/compare"
            className="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary"
          >
            Compare two airports
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

async function HomeDirectory() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 60 * 60 * 24 });
  cacheTag(AIRPORT_GUIDES_CACHE_TAG);
  cacheTag(AIRPORT_PROFILES_CACHE_TAG);

  const [scoredAirports, allAirports] = await Promise.all([
    getAllHonestAirports(),
    getAllAirports(),
  ]);

  return (
    <Suspense fallback={<DirectorySkeleton />}>
      <AirportDirectory
        scoredAirports={scoredAirports.map(toAirportDirectoryAirport)}
        allAirports={allAirports}
      />
    </Suspense>
  );
}

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <Suspense fallback={<DirectorySkeleton />}>
        <HomeDirectory />
      </Suspense>
    </>
  );
}
