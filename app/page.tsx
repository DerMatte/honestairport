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
  const boardRows = [
    ["SEARCH", "ANY AIRPORT", "OPEN"],
    ["COMPARE", "SCORES + DELAYS", "READY"],
    ["KNOW", "WHAT LOCALS KNOW", "BOARDING"],
  ];

  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-[#d5d0be] text-[#171917]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(90deg,rgba(16,18,16,.06)_1px,transparent_1px),linear-gradient(rgba(16,18,16,.05)_1px,transparent_1px)] [background-size:32px_32px]"
      />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-14 lg:py-20">
        <div className="hero-enter">
          <div className="flex items-center gap-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#4c5048]">
            <span className="inline-block size-2 bg-[#b54736]" />
            Independent airport intelligence
          </div>
          <h1 className="mt-5 max-w-xl text-[clamp(3.4rem,8vw,7.4rem)] leading-[0.82] font-bold uppercase tracking-[-0.035em]">
            Read the
            <span className="block text-[#a33d2f]">airport.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-[#4c5048] sm:text-lg">
            Real scores, current disruption signals, and practical traveler
            notes—arranged so you can decide at a glance.
          </p>
        </div>

        <div className="board-shell p-3 sm:p-5 lg:-rotate-[0.65deg]">
          <div className="mb-3 flex items-center justify-between border-b border-white/15 px-1 pb-3 font-mono text-[9px] uppercase tracking-[0.18em] text-board-ink/55 sm:text-[10px]">
            <span>HonestAirport / departures</span>
            <span className="flex items-center gap-2 text-board-amber">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              Board live
            </span>
          </div>
          <div className="grid grid-cols-[0.7fr_1.45fr_0.75fr] gap-1 px-1 pb-1 font-mono text-[8px] uppercase tracking-[0.14em] text-board-ink/40 sm:text-[9px]">
            <span>Action</span>
            <span>Information</span>
            <span>Status</span>
          </div>
          <div className="space-y-1.5">
            {boardRows.map((row) => (
              <div
                key={row[0]}
                className="hero-flap-in grid grid-cols-[0.7fr_1.45fr_0.75fr] gap-1 font-mono text-[clamp(.62rem,1.65vw,.9rem)] font-medium uppercase tracking-[0.04em]"
              >
                {row.map((field, index) => (
                  <span
                    key={field}
                    className={`flap-field ${index === 2 ? "text-board-amber" : ""}`}
                  >
                    {field}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between px-1 font-mono text-[8px] uppercase tracking-[0.16em] text-board-ink/35">
            <span>No sponsored rankings</span>
            <span>Est. 2025</span>
          </div>
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
