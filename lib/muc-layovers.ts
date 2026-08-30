/**
 * MUC-only layover wayfinding. A typed path table — not a graph engine.
 *
 * Minutes come only from Munich Airport's published connecting-flights page
 * (and the S-Bahn time HonestAirport already published for MAC Level 02).
 * Walk times, MCT, and security waits are never invented: unpublished pairs
 * return `minutes: null` and the UI prints "unpublished".
 *
 * Source: https://www.munich-airport.com/connecting-flights-260553
 */

export const MUC_LAYOVERS_IATA = "MUC";

export const MUC_CONNECTING_FLIGHTS_URL =
  "https://www.munich-airport.com/connecting-flights-260553";

/** Official published figures we are allowed to show. Do not add estimates. */
export const MUC_PUBLISHED = {
  shuttleRide: "5–7 min ride",
  shuttleHours: "06:00–23:00",
  ptsRide: "~1 min",
  ptsHours: "04:00–24:00",
  ptsFreq: "every 4 min",
  sbahnToHbf: "~45 min",
  sbahnFreq: "~every 20 min",
} as const;

export const MUC_PATH_TYPES = [
  "same_zone",
  "reclear",
  "different_terminal",
] as const;

export type MucPathType = (typeof MUC_PATH_TYPES)[number];

export const MUC_ZONE_IDS = [
  "t1-a",
  "t1-b",
  "t1-c",
  "t1-d",
  "t1-e",
  "t1-f",
  "t1-pier",
  "t2",
  "t2-sat",
  "hbf",
] as const;

export type MucZoneId = (typeof MUC_ZONE_IDS)[number];

export interface MucZone {
  id: MucZoneId;
  label: string;
  group: "Terminal 1" | "Terminal 2" | "City";
}

export const MUC_ZONES: readonly MucZone[] = [
  { id: "t1-a", label: "T1 A", group: "Terminal 1" },
  { id: "t1-b", label: "T1 B", group: "Terminal 1" },
  { id: "t1-c", label: "T1 C", group: "Terminal 1" },
  { id: "t1-d", label: "T1 D", group: "Terminal 1" },
  { id: "t1-e", label: "T1 E", group: "Terminal 1" },
  { id: "t1-f", label: "T1 F / Hall F (landside)", group: "Terminal 1" },
  { id: "t1-pier", label: "T1 Pier (non-Schengen)", group: "Terminal 1" },
  { id: "t2", label: "T2", group: "Terminal 2" },
  { id: "t2-sat", label: "T2 satellite", group: "Terminal 2" },
  { id: "hbf", label: "München Hbf (S-Bahn)", group: "City" },
];

export const MUC_ZONE_GROUPS: readonly {
  label: MucZone["group"];
  zones: readonly MucZone[];
}[] = [
  {
    label: "Terminal 1",
    zones: MUC_ZONES.filter((zone) => zone.group === "Terminal 1"),
  },
  {
    label: "Terminal 2",
    zones: MUC_ZONES.filter((zone) => zone.group === "Terminal 2"),
  },
  {
    label: "City",
    zones: MUC_ZONES.filter((zone) => zone.group === "City"),
  },
];

export const MUC_ZONE_BY_ID: Readonly<Record<MucZoneId, MucZone>> =
  Object.fromEntries(MUC_ZONES.map((zone) => [zone.id, zone])) as Record<
    MucZoneId,
    MucZone
  >;

export const MUC_FIRST_CLASS_PINS =
  "First Class pins: G21, H21, K11, L11. Senator listed G24/H24.";

export interface MucLayoverResult {
  from: MucZoneId;
  to: MucZoneId;
  pathType: MucPathType;
  pathLabel: string;
  /** Published minutes, or null when the airport has not published a time. */
  minutes: string | null;
  trap: string;
  sourceHref: typeof MUC_CONNECTING_FLIGHTS_URL;
  pinsNote?: string;
}

const T1_MODULES = new Set<MucZoneId>([
  "t1-a",
  "t1-b",
  "t1-c",
  "t1-d",
  "t1-e",
]);

const T1_AIRSIDE = new Set<MucZoneId>([...T1_MODULES, "t1-pier"]);
const T2_FAMILY = new Set<MucZoneId>(["t2", "t2-sat"]);

export function isMucLayoversIata(iata: string): boolean {
  return iata.trim().toUpperCase() === MUC_LAYOVERS_IATA;
}

/**
 * Preview gate: MUC only, and only with `?layovers=1` or
 * `NEXT_PUBLIC_MUC_LAYOVERS=1`. Other airports never pass.
 */
export function isMucLayoversPreviewEnabled(
  iata: string,
  layoversParam: string | null | undefined,
  envFlag: string | undefined = process.env.NEXT_PUBLIC_MUC_LAYOVERS,
): boolean {
  if (!isMucLayoversIata(iata)) {
    return false;
  }
  return layoversParam === "1" || envFlag === "1";
}

export function isMucZoneId(value: string): value is MucZoneId {
  return MUC_ZONE_BY_ID[value as MucZoneId] !== undefined;
}

export function mucLayoverMinutesLabel(minutes: string | null): string {
  return minutes ?? "unpublished";
}

export function mucPathTypeLabel(
  pathType: MucPathType,
  options: { pts?: boolean } = {},
): string {
  switch (pathType) {
    case "same_zone":
      return options.pts ? "Same-zone / airside PTS" : "Same-zone walk";
    case "reclear":
      return "Reclear trap";
    case "different_terminal":
      return "Different-terminal transfer";
    default: {
      const exhaustiveCheck: never = pathType;
      return exhaustiveCheck;
    }
  }
}

const TRAP = {
  hallF:
    "Hall F is landside/public only; Tel Aviv including Lufthansa Tel Aviv uses T1 F, not T2.",
  nightShuttle: "No connecting shuttle 23:00–06:00.",
  nightShuttleAndPts:
    "No connecting shuttle 23:00–06:00, and you cannot walk to the satellite — take the PTS.",
  ptsWalk: "You cannot walk — take the PTS train.",
  pier: "T1 Pier has all T1 non-Schengen traffic since 21 April 2026; passport control sits between Schengen T1 and the pier.",
  sas: "SAS checks in at T1 D, not T2.",
  sbahn:
    "S1/S8 is landside under the Munich Airport Center, Level 02, about every 20 min. Walk to the station is unpublished.",
  t2Passport:
    "Passport control is required for Schengen ↔ non-Schengen. Walk minutes are unpublished.",
  unpublished:
    "Walk minutes and MCT are unpublished — the airport does not publish a connection window.",
} as const;

function pinsNoteFor(to: MucZoneId): string | undefined {
  return to === "t2" || to === "t2-sat" ? MUC_FIRST_CLASS_PINS : undefined;
}

function makeResult(
  from: MucZoneId,
  to: MucZoneId,
  pathType: MucPathType,
  minutes: string | null,
  trap: string,
  options: { pts?: boolean } = {},
): MucLayoverResult {
  return {
    from,
    to,
    pathType,
    pathLabel: mucPathTypeLabel(pathType, options),
    minutes,
    trap,
    sourceHref: MUC_CONNECTING_FLIGHTS_URL,
    pinsNote: pinsNoteFor(to),
  };
}

function isT1Module(id: MucZoneId): boolean {
  return T1_MODULES.has(id);
}

function isT1Airside(id: MucZoneId): boolean {
  return T1_AIRSIDE.has(id);
}

function isT2Family(id: MucZoneId): boolean {
  return T2_FAMILY.has(id);
}

function isHallF(id: MucZoneId): boolean {
  return id === "t1-f";
}

function isHbf(id: MucZoneId): boolean {
  return id === "hbf";
}

function isSat(id: MucZoneId): boolean {
  return id === "t2-sat";
}

function isT2Main(id: MucZoneId): boolean {
  return id === "t2";
}

function isPier(id: MucZoneId): boolean {
  return id === "t1-pier";
}

function involvesT1D(from: MucZoneId, to: MucZoneId): boolean {
  return from === "t1-d" || to === "t1-d";
}

/**
 * Resolve a MUC origin/destination pair. Symmetric published facts are
 * applied in both directions. Unpublished pairs never get a guessed time.
 */
export function lookupMucLayover(from: MucZoneId, to: MucZoneId): MucLayoverResult {
  if (from === to) {
    if (isT2Main(from)) {
      return makeResult(from, to, "same_zone", null, TRAP.t2Passport);
    }
    if (involvesT1D(from, to)) {
      return makeResult(from, to, "same_zone", null, TRAP.sas);
    }
    return makeResult(from, to, "same_zone", null, TRAP.unpublished);
  }

  if (isHbf(from) || isHbf(to)) {
    const trap = isHallF(from) || isHallF(to) ? TRAP.hallF : TRAP.sbahn;
    return makeResult(from, to, "reclear", MUC_PUBLISHED.sbahnToHbf, trap);
  }

  if (isHallF(from) || isHallF(to)) {
    return makeResult(from, to, "reclear", null, TRAP.hallF);
  }

  if ((isT2Main(from) && isSat(to)) || (isSat(from) && isT2Main(to))) {
    return makeResult(
      from,
      to,
      "same_zone",
      MUC_PUBLISHED.ptsRide,
      TRAP.ptsWalk,
      { pts: true },
    );
  }

  const fromT1 = isT1Airside(from);
  const toT1 = isT1Airside(to);
  const fromT2 = isT2Family(from);
  const toT2 = isT2Family(to);
  if ((fromT1 && toT2) || (fromT2 && toT1)) {
    const viaSat = isSat(from) || isSat(to);
    return makeResult(
      from,
      to,
      "different_terminal",
      viaSat
        ? `${MUC_PUBLISHED.shuttleRide}, then ${MUC_PUBLISHED.ptsRide} PTS`
        : MUC_PUBLISHED.shuttleRide,
      viaSat ? TRAP.nightShuttleAndPts : TRAP.nightShuttle,
    );
  }

  if ((isPier(from) && isT1Module(to)) || (isT1Module(from) && isPier(to))) {
    return makeResult(from, to, "reclear", null, TRAP.pier);
  }

  if (isT1Module(from) && isT1Module(to)) {
    return makeResult(
      from,
      to,
      "same_zone",
      null,
      involvesT1D(from, to) ? TRAP.sas : TRAP.unpublished,
    );
  }

  return makeResult(from, to, "same_zone", null, TRAP.unpublished);
}

/** Minutes strings that may appear in a result. Used by tests as a lock. */
export const MUC_ALLOWED_MINUTES = new Set<string | null>([
  null,
  MUC_PUBLISHED.shuttleRide,
  MUC_PUBLISHED.ptsRide,
  `${MUC_PUBLISHED.shuttleRide}, then ${MUC_PUBLISHED.ptsRide} PTS`,
  MUC_PUBLISHED.sbahnToHbf,
]);
