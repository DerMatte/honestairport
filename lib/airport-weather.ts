import { cacheLife } from "next/cache";
import { getAirportByIata } from "./airports";

const LOCATIONFORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
const FETCH_TIMEOUT_MS = 8_000;

// met.no terms: identify the app via User-Agent and truncate coordinates to
// four decimals so requests stay cacheable on their side.
const USER_AGENT = "TravelGuide/1.0 (+https://github.com/DerMatte/travelguide)";

export interface AirportWeather {
  iata: string;
  temperatureC: number;
  /** met.no symbol code, e.g. "partlycloudy_night". */
  symbolCode: string;
  /** Human-readable condition derived from the symbol code, e.g. "Partly cloudy". */
  condition: string;
  updatedAt?: string;
}

interface LocationforecastResponse {
  properties?: {
    meta?: { updated_at?: string };
    timeseries?: Array<{
      time?: string;
      data?: {
        instant?: { details?: { air_temperature?: number } };
        next_1_hours?: { summary?: { symbol_code?: string } };
        next_6_hours?: { summary?: { symbol_code?: string } };
        next_12_hours?: { summary?: { symbol_code?: string } };
      };
    }>;
  };
}

function conditionLabel(symbolCode: string): string {
  const base = symbolCode.split("_")[0];
  const label = base
    .replace(/^lightss/, "light s") // API quirk: "lightssleet…" / "lightssnow…"
    .replace(/^light(?=[a-z])/, "light ")
    .replace(/^heavy(?=[a-z])/, "heavy ")
    .replace("clearsky", "clear sky")
    .replace("partlycloudy", "partly cloudy")
    .replace("andthunder", " and thunder")
    .replace("showers", " showers");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Current conditions at the airport from met.no Locationforecast (no API key;
 * free for attribution-friendly use). Returns null on any upstream hiccup so
 * the page simply omits the weather line instead of failing.
 */
export async function getAirportWeather(iata: string): Promise<AirportWeather | null> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 60 * 60 * 3 });

  const record = getAirportByIata(iata);
  if (!record) {
    return null;
  }

  const url = new URL(LOCATIONFORECAST_URL);
  url.searchParams.set("lat", record.latitude.toFixed(4));
  url.searchParams.set("lon", record.longitude.toFixed(4));

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`met.no returned ${response.status}`);
    }

    const json = (await response.json()) as LocationforecastResponse;
    const now = json.properties?.timeseries?.[0]?.data;
    const temperature = now?.instant?.details?.air_temperature;
    const symbolCode =
      now?.next_1_hours?.summary?.symbol_code ??
      now?.next_6_hours?.summary?.symbol_code ??
      now?.next_12_hours?.summary?.symbol_code;

    if (typeof temperature !== "number" || !symbolCode) {
      return null;
    }

    return {
      iata: record.iata_code,
      temperatureC: temperature,
      symbolCode,
      condition: conditionLabel(symbolCode),
      updatedAt: json.properties?.meta?.updated_at,
    };
  } catch {
    return null;
  }
}
