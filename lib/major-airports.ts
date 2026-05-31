import { getAirportByIata } from "./airports";

/**
 * World's busiest airports by annual passenger traffic (ACI 2024 rankings).
 * Used to prioritize guide generation — highest rank first.
 */
export const MAJOR_AIRPORTS_BY_RANK: readonly { rank: number; iata: string }[] = [
  { rank: 1, iata: "ATL" },
  { rank: 2, iata: "DXB" },
  { rank: 3, iata: "DFW" },
  { rank: 4, iata: "LHR" },
  { rank: 5, iata: "HND" },
  { rank: 6, iata: "DEN" },
  { rank: 7, iata: "IST" },
  { rank: 8, iata: "LAX" },
  { rank: 9, iata: "ORD" },
  { rank: 10, iata: "DEL" },
  { rank: 11, iata: "CDG" },
  { rank: 12, iata: "AMS" },
  { rank: 13, iata: "FRA" },
  { rank: 14, iata: "JFK" },
  { rank: 15, iata: "CAN" },
  { rank: 16, iata: "ICN" },
  { rank: 17, iata: "MIA" },
  { rank: 18, iata: "MUC" },
  { rank: 19, iata: "SIN" },
  { rank: 20, iata: "MAD" },
  { rank: 21, iata: "BKK" },
  { rank: 22, iata: "PHX" },
  { rank: 23, iata: "SFO" },
  { rank: 24, iata: "SEA" },
  { rank: 25, iata: "EWR" },
  { rank: 26, iata: "MCO" },
  { rank: 27, iata: "LAS" },
  { rank: 28, iata: "CLT" },
  { rank: 29, iata: "BCN" },
  { rank: 30, iata: "SZX" },
  { rank: 31, iata: "KUL" },
  { rank: 32, iata: "PEK" },
  { rank: 33, iata: "PVG" },
  { rank: 34, iata: "SVO" },
  { rank: 35, iata: "GRU" },
  { rank: 36, iata: "SYD" },
  { rank: 37, iata: "YYZ" },
  { rank: 38, iata: "HKG" },
  { rank: 39, iata: "DOH" },
  { rank: 40, iata: "BOM" },
  { rank: 41, iata: "CGK" },
  { rank: 42, iata: "MEX" },
  { rank: 43, iata: "FCO" },
  { rank: 44, iata: "ZRH" },
  { rank: 45, iata: "VIE" },
  { rank: 46, iata: "CPH" },
  { rank: 47, iata: "ARN" },
  { rank: 48, iata: "NRT" },
  { rank: 49, iata: "KIX" },
  { rank: 50, iata: "TPE" },
  { rank: 51, iata: "DUB" },
  { rank: 52, iata: "MAN" },
  { rank: 53, iata: "BOS" },
  { rank: 54, iata: "IAH" },
  { rank: 55, iata: "MSP" },
  { rank: 56, iata: "DTW" },
  { rank: 57, iata: "PHL" },
  { rank: 58, iata: "SLC" },
  { rank: 59, iata: "SAN" },
  { rank: 60, iata: "TPA" },
  { rank: 61, iata: "AUS" },
  { rank: 62, iata: "RDU" },
  { rank: 63, iata: "SAW" },
  { rank: 64, iata: "PKX" },
  { rank: 65, iata: "AUH" },
  { rank: 66, iata: "JNB" },
  { rank: 67, iata: "CAI" },
  { rank: 68, iata: "TLV" },
  { rank: 69, iata: "ATH" },
  { rank: 70, iata: "LIS" },
  { rank: 71, iata: "BRU" },
  { rank: 72, iata: "GVA" },
  { rank: 73, iata: "MXP" },
  { rank: 74, iata: "WAW" },
  { rank: 75, iata: "PRG" },
  { rank: 76, iata: "BUD" },
  { rank: 77, iata: "HEL" },
  { rank: 78, iata: "OSL" },
  { rank: 79, iata: "LGW" },
  { rank: 80, iata: "STN" },
  { rank: 81, iata: "DUS" },
  { rank: 82, iata: "BER" },
  { rank: 83, iata: "CGN" },
  { rank: 84, iata: "HAM" },
  { rank: 85, iata: "NCE" },
  { rank: 86, iata: "BOG" },
  { rank: 87, iata: "LIM" },
  { rank: 88, iata: "SCL" },
  { rank: 89, iata: "GIG" },
  { rank: 90, iata: "CUN" },
  { rank: 91, iata: "RUH" },
  { rank: 92, iata: "JED" },
  { rank: 93, iata: "CTU" },
  { rank: 94, iata: "WUH" },
  { rank: 95, iata: "SHA" },
  { rank: 96, iata: "EDI" },
  { rank: 97, iata: "BHX" },
  { rank: 98, iata: "GLA" },
  { rank: 99, iata: "AGP" },
  { rank: 100, iata: "PMI" },
] as const;

export interface MajorAirportCandidate {
  rank: number;
  iata: string;
  name: string;
  city: string;
  country: string;
}

export function getMajorAirportCandidates(): MajorAirportCandidate[] {
  return MAJOR_AIRPORTS_BY_RANK.flatMap(({ rank, iata }) => {
    const record = getAirportByIata(iata);
    if (!record) return [];

    return [
      {
        rank,
        iata,
        name: record.name,
        city: record.city_name,
        country: record.iata_country_code,
      },
    ];
  });
}
