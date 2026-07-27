import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { AirportDirectory } from "@/app/components/airport-directory";
import {
  AIRPORT_GUIDES_CACHE_TAG,
  AIRPORT_PROFILES_CACHE_TAG,
  getAllAirports,
  getAllHonestAirports,
} from "@/lib/airport-content";
import { toAirportDirectoryAirport } from "@/lib/airport-utils";

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
    <div className="airport-board-only">
      <Suspense>
        <HomeDirectory />
      </Suspense>
    </div>
  );
}
