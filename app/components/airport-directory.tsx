import { AirportCard, AirportGuideCard } from "@/app/components/airport-card";
import type { AirportSummary } from "@/lib/airport-content";
import type { AirportDirectoryAirport } from "@/lib/types";

interface AirportDirectoryProps {
  scoredAirports: AirportDirectoryAirport[];
  allAirports: AirportSummary[];
}

type DirectoryEntry =
  | { kind: "scored"; airport: AirportDirectoryAirport }
  | { kind: "guide"; airport: AirportSummary };

export function AirportDirectory({
  scoredAirports,
  allAirports,
}: AirportDirectoryProps) {
  const scoredIatas = new Set(scoredAirports.map((airport) => airport.iata));
  const guideOnlyAirports = allAirports
    .filter((airport) => !scoredIatas.has(airport.iata))
    .sort((a, b) => a.name.localeCompare(b.name));
  const entries: DirectoryEntry[] = [
    ...scoredAirports.map((airport) => ({
      kind: "scored" as const,
      airport,
    })),
    ...guideOnlyAirports.map((airport) => ({
      kind: "guide" as const,
      airport,
    })),
  ];

  return (
    <section aria-label="Airport directory" className="airport-board">
      <div className="airport-board-heading" aria-hidden="true">
        <span />
        <span>Code</span>
        <span>Airport</span>
        <span>City / country</span>
        <span>Score</span>
        <span>Status</span>
      </div>

      {entries.map((entry, index) =>
        entry.kind === "scored" ? (
          <AirportCard
            key={entry.airport.iata}
            airport={entry.airport}
            sequence={index + 1}
          />
        ) : (
          <AirportGuideCard
            key={entry.airport.iata}
            airport={entry.airport}
            sequence={index + 1}
          />
        ),
      )}
    </section>
  );
}
