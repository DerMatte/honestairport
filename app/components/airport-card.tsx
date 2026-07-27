import Link from "next/link";
import { SplitFlapText } from "@/app/components/split-flap-text";
import { disruptionLabel } from "@/lib/airport-utils";
import type { AirportSummary } from "@/lib/airport-content";
import type { AirportDirectoryAirport } from "@/lib/types";

interface AirportCardProps {
  airport: AirportDirectoryAirport;
  sequence: number;
}

function rowDelay(sequence: number): number {
  return Math.min(sequence - 1, 10) * 72;
}

export function AirportCard({ airport, sequence }: AirportCardProps) {
  const delay = rowDelay(sequence);

  return (
    <Link
      href={`/airports/${airport.slug}`}
      prefetch={false}
      aria-label={`Open the ${airport.name} guide, disruption ${disruptionLabel(airport.disruption.status).toLowerCase()}`}
      className="airport-board-row group"
    >
      <span
        className={`airport-board-indicator airport-board-indicator--${airport.disruption.status}`}
        aria-hidden="true"
      />
      <SplitFlapText
        className="airport-board-code"
        delay={delay}
        length={3}
        text={airport.iata}
      />
      <SplitFlapText
        className="airport-board-destination"
        delay={delay + 40}
        length={22}
        text={airport.shortName}
      />
      <SplitFlapText
        className="airport-board-location"
        delay={delay + 110}
        length={20}
        text={`${airport.city}, ${airport.country}`}
        tone="muted"
      />
      <SplitFlapText
        className="airport-board-score"
        delay={delay + 170}
        length={3}
        text={airport.airportistScore.toFixed(1)}
      />
      <SplitFlapText
        className="airport-board-status"
        delay={delay + 220}
        length={8}
        text={disruptionLabel(airport.disruption.status)}
        tone={airport.disruption.status === "normal" ? "ivory" : "amber"}
      />
    </Link>
  );
}

interface AirportGuideCardProps {
  airport: AirportSummary;
  sequence: number;
}

export function AirportGuideCard({ airport, sequence }: AirportGuideCardProps) {
  const delay = rowDelay(sequence);

  return (
    <Link
      href={`/airports/${airport.iata.toLowerCase()}`}
      prefetch={false}
      aria-label={`Open the ${airport.name} guide`}
      className="airport-board-row group"
    >
      <span
        className="airport-board-indicator airport-board-indicator--muted"
        aria-hidden="true"
      />
      <SplitFlapText
        className="airport-board-code"
        delay={delay}
        length={3}
        text={airport.iata}
      />
      <SplitFlapText
        className="airport-board-destination"
        delay={delay + 40}
        length={22}
        text={airport.name}
      />
      <SplitFlapText
        className="airport-board-location"
        delay={delay + 110}
        length={20}
        text={`${airport.city}, ${airport.country}`}
        tone="muted"
      />
      <SplitFlapText
        className="airport-board-score"
        delay={delay + 170}
        length={3}
        text="---"
        tone="muted"
      />
      <SplitFlapText
        className="airport-board-status"
        delay={delay + 220}
        length={8}
        text="GUIDE"
        tone="muted"
      />
    </Link>
  );
}
