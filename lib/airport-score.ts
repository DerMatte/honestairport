import type { AirportScoreBreakdown } from "@/lib/types";

const SCORE_COMPONENT_KEYS = [
  "comfort",
  "navigation",
  "food",
  "transport",
  "disruptionResilience",
] as const satisfies ReadonlyArray<keyof AirportScoreBreakdown>;

/**
 * The five score dimensions have equal influence. The published overall score
 * is calibrated near this average, but is intentionally not a formulaic copy
 * of it (see the public methodology page).
 */
export function averageScoreBreakdown(breakdown: AirportScoreBreakdown): number {
  const total = SCORE_COMPONENT_KEYS.reduce(
    (sum, key) => sum + breakdown[key],
    0,
  );

  return total / SCORE_COMPONENT_KEYS.length;
}
