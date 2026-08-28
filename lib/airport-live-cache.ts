import { cacheLife } from "next/cache";
import {
  getAirportLiveData,
  type AirportLiveData,
} from "./airport-live-data";

/**
 * Short-lived cached live payload for first paint. Must stay well below the
 * 24h guide cache so Overview never serves stale security / disruption data.
 */
export async function getCachedAirportLiveData(
  iata: string,
): Promise<AirportLiveData | null> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 60 * 60 });

  try {
    return await getAirportLiveData(iata);
  } catch {
    return null;
  }
}
