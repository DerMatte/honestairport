import {
  getAirportByIata,
  getAllAirportRecords,
  isPassengerAirportName,
  type AirportRecord,
} from "./airports";
import { MAJOR_AIRPORTS_BY_RANK } from "./major-airports";

/**
 * ISO country codes for the long-tail generation wave. Order is editorial
 * (DACH / nearby Europe first, then other high-demand traveler markets).
 * Used only for sequencing — this file never invents passenger volumes.
 */
export const PRIORITY_COUNTRY_CODES = [
  "DE",
  "AT",
  "CH",
  "GB",
  "IE",
  "FR",
  "ES",
  "IT",
  "NL",
  "BE",
  "PT",
  "PL",
  "CZ",
  "HU",
  "GR",
  "HR",
  "US",
  "CA",
  "MX",
  "AE",
  "QA",
  "TR",
  "JP",
  "KR",
  "SG",
  "TH",
  "MY",
  "AU",
  "NZ",
] as const;

/**
 * Curated second wave (~100 IATAs): busy hubs, dual-airport cities, and
 * leisure/connection airports travelers search for that sit outside ACI 2024
 * top 100. Order is editorial (hubs, then leisure), not traffic rank.
 * Codes that fail `getAirportByIata` or `isPassengerAirportName` are dropped.
 */
export const TIER2_CURATED_IATAS = [
  // US secondaries / dual-airport cities
  "FLL",
  "BWI",
  "IAD",
  "DCA",
  "BNA",
  "PDX",
  "HNL",
  "SJU",
  "DAL",
  "HOU",
  "SJC",
  "OAK",
  "BUR",
  "SNA",
  "SMF",
  "IND",
  "CMH",
  "PIT",
  "CLE",
  "MSY",
  "RSW",
  "STL",
  "MCI",
  "CVG",
  // Canada
  "YVR",
  "YUL",
  "YYC",
  "YOW",
  // Mexico leisure / secondaries
  "GDL",
  "MTY",
  "SJD",
  "PVR",
  // DACH secondaries
  "STR",
  "NUE",
  "HAJ",
  "BRE",
  "FMO",
  "SZG",
  "INN",
  "BSL",
  // UK / Ireland secondaries (GLA is already tier 1)
  "NCL",
  "BRS",
  "BFS",
  "SNN",
  "ORK",
  // France secondaries
  "LYS",
  "MRS",
  "TLS",
  "BOD",
  "NTE",
  // Italy secondaries
  "LIN",
  "NAP",
  "BLQ",
  "VCE",
  "CTA",
  "PMO",
  // Iberia + islands
  "VLC",
  "SVQ",
  "ALC",
  "IBZ",
  "ACE",
  "FUE",
  "LPA",
  "TFS",
  "OPO",
  "FAO",
  // Benelux
  "EIN",
  "CRL",
  // CEE / Balkans / Greece leisure + hubs
  "KRK",
  "GDN",
  "OTP",
  "SOF",
  "BEG",
  "ZAG",
  "SPU",
  "DBV",
  "TIA",
  "SKG",
  "HER",
  "RHO",
  "CFU",
  "JTR",
  "JMK",
  // MENA leisure / secondaries
  "AYT",
  "ADB",
  "BAH",
  "MCT",
  "SHJ",
  "SSH",
  // Asia-Pacific hubs + leisure
  "DPS",
  "MNL",
  "SGN",
  "HAN",
  "DMK",
  "HKT",
  "NGO",
  "FUK",
  "CTS",
  "OKA",
  "PUS",
  "CJU",
  "MEL",
  "BNE",
  "AKL",
] as const;

export const DEFAULT_GENERATION_BATCH_SIZE = 10;

export type GenerationPriorityTier = 1 | 2 | 3;

export interface GenerationPriorityAirport {
  iata: string;
  tier: GenerationPriorityTier;
  name: string;
  city: string;
  country: string;
}

const PRIORITY_COUNTRY_RANK = new Map<string, number>(
  PRIORITY_COUNTRY_CODES.map((code, index) => [code, index]),
);

function toPriorityAirport(
  iata: string,
  tier: GenerationPriorityTier,
): GenerationPriorityAirport | null {
  const record = getAirportByIata(iata);
  if (!record) return null;
  if (!isPassengerAirportName(record.name)) return null;

  return {
    iata: record.iata_code.toUpperCase(),
    tier,
    name: record.name,
    city: record.city_name,
    country: record.iata_country_code,
  };
}

function compareTier3(a: AirportRecord, b: AirportRecord): number {
  const rankA = PRIORITY_COUNTRY_RANK.get(a.iata_country_code) ?? Number.POSITIVE_INFINITY;
  const rankB = PRIORITY_COUNTRY_RANK.get(b.iata_country_code) ?? Number.POSITIVE_INFINITY;
  if (rankA !== rankB) return rankA - rankB;

  const cityCmp = a.city_name.localeCompare(b.city_name, "en");
  if (cityCmp !== 0) return cityCmp;

  const nameCmp = a.name.localeCompare(b.name, "en");
  if (nameCmp !== 0) return nameCmp;

  return a.iata_code.localeCompare(b.iata_code, "en");
}

function pushUnique(
  result: GenerationPriorityAirport[],
  seen: Set<string>,
  airport: GenerationPriorityAirport | null,
): void {
  if (!airport || seen.has(airport.iata)) return;
  seen.add(airport.iata);
  result.push(airport);
}

function buildGenerationPriorityAirports(): GenerationPriorityAirport[] {
  const seen = new Set<string>();
  const result: GenerationPriorityAirport[] = [];

  for (const { iata } of MAJOR_AIRPORTS_BY_RANK) {
    pushUnique(result, seen, toPriorityAirport(iata, 1));
  }

  for (const iata of TIER2_CURATED_IATAS) {
    pushUnique(result, seen, toPriorityAirport(iata, 2));
  }

  const remaining = getAllAirportRecords()
    .filter((record) => {
      const iata = record.iata_code.toUpperCase();
      if (seen.has(iata)) return false;
      if (!PRIORITY_COUNTRY_RANK.has(record.iata_country_code)) return false;
      return isPassengerAirportName(record.name);
    })
    .toSorted(compareTier3);

  for (const record of remaining) {
    pushUnique(result, seen, toPriorityAirport(record.iata_code, 3));
  }

  return result;
}

let cachedPriority: GenerationPriorityAirport[] | undefined;

export function listGenerationPriorityAirports(): readonly GenerationPriorityAirport[] {
  cachedPriority ??= buildGenerationPriorityAirports();
  return cachedPriority;
}

export function listGenerationPriorityIatas(): string[] {
  return listGenerationPriorityAirports().map((airport) => airport.iata);
}

export function getNextMissingForGeneration(
  existingIatas: Set<string>,
  limit: number,
): GenerationPriorityAirport[] {
  if (limit <= 0) return [];

  const existing = new Set(
    [...existingIatas].map((iata) => iata.trim().toUpperCase()).filter(Boolean),
  );

  const missing: GenerationPriorityAirport[] = [];
  for (const airport of listGenerationPriorityAirports()) {
    if (existing.has(airport.iata)) continue;
    missing.push(airport);
    if (missing.length >= limit) break;
  }
  return missing;
}

export function formatGenerationPriorityLine(airport: GenerationPriorityAirport): string {
  return `T${airport.tier}  ${airport.iata}  ${airport.name} (${airport.city}, ${airport.country})`;
}
