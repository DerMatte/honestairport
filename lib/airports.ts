import airportsJson from "./airports.json";
import { haversineKm } from "./geo";

export interface AirportRecord {
  city_name: string;
  iata_city_code: string;
  iata_country_code: string;
  icao_code: string | null;
  iata_code: string;
  latitude: number;
  longitude: number;
  city: string | null;
  time_zone: string;
  name: string;
  id: string;
}

const airports = airportsJson as AirportRecord[];
const airportsByIata = new Map(airports.map((airport) => [airport.iata_code, airport]));

/** Extra spellings common in German frequent-flyer forum posts. */
const FORUM_CITY_ALIASES: Readonly<Record<string, readonly string[]>> = {
  MUC: ["München", "Muenchen"],
  FRA: ["Frankfurt am Main"],
  BER: ["Hauptstadtflughafen"],
  DUS: ["Düsseldorf", "Duesseldorf"],
  CGN: ["Köln", "Koeln", "Cologne/Bonn"],
  VIE: ["Wien"],
  HAM: ["Hamburg"],
  STR: ["Stuttgart"],
  NUE: ["Nürnberg", "Nuernberg", "Nuremberg"],
  DTM: ["Dortmund"],
  LEJ: ["Leipzig"],
  CDG: ["Roissy"],
  AMS: ["Schiphol"],
  BKK: ["Suvarnabhumi", "Don Mueang"],
};

const NAME_STOP_WORDS = new Set([
  "airport",
  "international",
  "regional",
  "airfield",
  "field",
  "municipal",
  "county",
  "air",
  "base",
  "the",
  "and",
  "of",
]);

export function getAirportByIata(iata: string): AirportRecord | undefined {
  return airportsByIata.get(iata.trim().toUpperCase());
}

export function getAllAirportRecords(): readonly AirportRecord[] {
  return airports;
}

export interface NearbyAirport {
  iata: string;
  name: string;
  city: string;
  distanceKm: number;
  slug: string;
}

const DEFAULT_NEARBY_MAX_KM = 150;
const DEFAULT_NEARBY_LIMIT = 6;

export function getNearbyAirports(
  iata: string,
  options: { maxKm?: number; limit?: number } = {},
): NearbyAirport[] {
  const subject = getAirportByIata(iata);
  if (!subject) return [];

  const maxKm = options.maxKm ?? DEFAULT_NEARBY_MAX_KM;
  const limit = options.limit ?? DEFAULT_NEARBY_LIMIT;
  const subjectIata = subject.iata_code.toUpperCase();

  const nearby: NearbyAirport[] = [];

  for (const record of airports) {
    if (record.iata_code.toUpperCase() === subjectIata) continue;

    const distanceKm = haversineKm(
      subject.latitude,
      subject.longitude,
      record.latitude,
      record.longitude,
    );

    if (distanceKm > maxKm) continue;

    nearby.push({
      iata: record.iata_code,
      name: record.name,
      city: record.city_name,
      distanceKm,
      slug: record.iata_code.toLowerCase(),
    });
  }

  nearby.sort((a, b) => a.distanceKm - b.distanceKm);
  return nearby.slice(0, limit);
}

export function getMatchTermsForAirport(airport: AirportRecord): string[] {
  const terms = new Set<string>([airport.iata_code, airport.city_name]);

  if (airport.icao_code) {
    terms.add(airport.icao_code);
  }

  for (const part of airport.name.split(/[\s/()-]+/)) {
    const cleaned = part.replace(/[^a-zA-Z0-9äöüÄÖÜß-]/g, "");
    if (cleaned.length > 2 && !NAME_STOP_WORDS.has(cleaned.toLowerCase())) {
      terms.add(cleaned);
    }
  }

  for (const alias of FORUM_CITY_ALIASES[airport.iata_code] ?? []) {
    terms.add(alias);
  }

  return [...terms];
}

export function matchIataCodesInText(
  text: string,
  candidateIatas: ReadonlySet<string>,
): string[] {
  const matched = new Set<string>();
  const normalizedHaystack = normalizeForMatch(text);

  for (const iata of candidateIatas) {
    if (new RegExp(`\\b${escapeRegExp(iata)}\\b`, "i").test(text)) {
      matched.add(iata);
      continue;
    }

    const airport = airportsByIata.get(iata);
    if (!airport) continue;

    for (const term of getMatchTermsForAirport(airport)) {
      if (term.length === 3 && term.toUpperCase() === iata) continue;

      const normalizedTerm = normalizeForMatch(term);
      if (normalizedTerm.length < 4) continue;

      if (normalizedHaystack.includes(normalizedTerm)) {
        matched.add(iata);
        break;
      }
    }
  }

  return [...matched].sort();
}

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
