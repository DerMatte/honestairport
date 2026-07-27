import { Suspense } from "react";
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
    <section className="home-intro relative overflow-hidden px-5 pt-12 pb-8 sm:px-6 sm:pt-16 sm:pb-10">
      <div className="mx-auto grid max-w-[94rem] gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
        <div className="hero-enter">
          <p className="skeuo-label">Independent airport intelligence</p>
          <h1 className="mt-4 max-w-5xl text-[clamp(3.4rem,8vw,7.8rem)] leading-[0.8] uppercase tracking-[-0.035em] text-[#22292b]">
            Every airport.
            <span className="block text-[#3f7182]">One honest board.</span>
          </h1>
        </div>
        <div className="skeuo-hero-note">
          <span className="skeuo-hero-note__icon" aria-hidden="true">
            i
          </span>
          <p>
            Compare scores, disruption, location, and traveler guidance the way
            airports once showed departures: one decisive line at a time.
          </p>
        </div>
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
    <AirportDirectory
      scoredAirports={scoredAirports.map(toAirportDirectoryAirport)}
      allAirports={allAirports}
    />
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
