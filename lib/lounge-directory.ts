/**
 * Lounge directory domain logic: types, slugs, validation, and raw (uncached)
 * Postgres access for the `airport_lounges` table. Next-free on purpose —
 * scripts run it directly via tsx to seed and enrich lounge rows.
 *
 * Like `airport_profiles`, this table is deliberately separate from
 * `airport_guides` so the guide pipeline can never clobber web-verified
 * lounge facts: seeding only happens while an airport has zero rows, and the
 * enrichment sync updates rows in place by their stable slug.
 *
 * App code should read through `lib/airport-content.ts`, which wraps these
 * reads in Next's data cache with the `airport-lounges` tag.
 */
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { AirportLounge, AirportLoungeVerdict } from "./airport-guides";
import { getDb, isDatabaseConfigured } from "./db";
import { airportLounges, type AirportGuideRow, type AirportLoungeRow } from "./db/schema";

// --- Access programs --------------------------------------------------------

/**
 * Membership/entitlement programs a traveler can hold to get in. Stored in
 * jsonb (not a PG enum) so extending this list needs no migration. `other`
 * covers lounge-brand memberships and one-offs — it must carry a `label`.
 */
export const LOUNGE_ACCESS_PROGRAMS = [
  "priority-pass",
  "lounge-key",
  "dragon-pass",
  "amex-platinum",
  "amex-centurion",
  "chase-sapphire-reserve",
  "chase-sapphire-lounge",
  "capital-one-venture-x",
  "delta-sky-club",
  "united-club",
  "admirals-club",
  "lufthansa",
  "star-alliance-gold",
  "oneworld-sapphire",
  "oneworld-emerald",
  "skyteam-elite-plus",
  "business-class",
  "first-class",
  "airline-status",
  "day-pass",
  "other",
] as const;

export type LoungeAccessProgram = (typeof LOUNGE_ACCESS_PROGRAMS)[number];

export const PROGRAM_LABELS: Record<LoungeAccessProgram, string> = {
  "priority-pass": "Priority Pass",
  "lounge-key": "LoungeKey",
  "dragon-pass": "DragonPass",
  "amex-platinum": "Amex Platinum",
  "amex-centurion": "Amex Centurion",
  "chase-sapphire-reserve": "Chase Sapphire Reserve",
  "chase-sapphire-lounge": "Chase Sapphire Lounge",
  "capital-one-venture-x": "Capital One Venture X",
  "delta-sky-club": "Delta Sky Club",
  "united-club": "United Club",
  "admirals-club": "Admirals Club",
  lufthansa: "Lufthansa",
  "star-alliance-gold": "Star Alliance Gold",
  "oneworld-sapphire": "oneworld Sapphire",
  "oneworld-emerald": "oneworld Emerald",
  "skyteam-elite-plus": "SkyTeam Elite Plus",
  "business-class": "Business class ticket",
  "first-class": "First class ticket",
  "airline-status": "Airline status",
  "day-pass": "Day pass",
  other: "Other",
};

export interface LoungeAccessMethod {
  program: LoungeAccessProgram;
  /** Display text; required when `program` is "other". */
  label?: string;
  /** Conditions, e.g. "same-day Delta boarding pass, 2 guests". */
  details?: string;
  /** Walk-in price, e.g. "$59". */
  price?: string;
}

export type AirportLoungeStatus = "open" | "temporarily-closed" | "closed";

// --- Validation ---------------------------------------------------------------

const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  nonEmptyString.optional(),
);

export const loungeAccessMethodSchema = z
  .object({
    program: z.enum(LOUNGE_ACCESS_PROGRAMS),
    label: optionalNonEmptyString,
    details: optionalNonEmptyString,
    price: optionalNonEmptyString,
  })
  .superRefine((method, ctx) => {
    if (method.program === "other" && !method.label) {
      ctx.addIssue({
        code: "custom",
        message: '"other" access methods must include a label naming the program',
        path: ["label"],
      });
    }
  });

/** Everything the enrichment pipeline may write for one lounge. */
export const loungeRecordSchema = z.object({
  name: nonEmptyString,
  terminal: nonEmptyString,
  zone: optionalNonEmptyString,
  location: optionalNonEmptyString,
  access: z.array(loungeAccessMethodSchema).default([]),
  hours: optionalNonEmptyString,
  amenities: z.array(nonEmptyString).default([]),
  foodAndDrinks: optionalNonEmptyString,
  showers: z.boolean().optional(),
  bestFor: z.array(nonEmptyString).default([]),
  verdict: z.enum(["worth-it", "depends", "skip"]).optional(),
  summary: nonEmptyString,
  description: optionalNonEmptyString,
  status: z.enum(["open", "temporarily-closed", "closed"]).default("open"),
  sourceUrls: z.array(z.url()).default([]),
  lastVerified: z.iso.date().nullish(),
});

export type AirportLoungeRecord = z.infer<typeof loungeRecordSchema> & { slug: string };

// --- Slugs ---------------------------------------------------------------------

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Assign a URL slug to each new lounge, avoiding `existingSlugs` (an
 * airport's already-persisted slugs) and collisions within the batch.
 * Collision ladder: name → name + terminal → numeric suffix. Slugs are
 * identity — assign once, never re-derive for a row that already has one.
 */
export function assignLoungeSlugs<T extends { name: string; terminal: string }>(
  lounges: T[],
  existingSlugs: ReadonlySet<string>,
): Array<T & { slug: string }> {
  const taken = new Set(existingSlugs);

  return lounges.map((lounge) => {
    const base = slugify(lounge.name) || "lounge";
    let slug = base;
    if (taken.has(slug)) {
      const withTerminal = slugify(`${lounge.name} ${lounge.terminal}`);
      slug = withTerminal && !taken.has(withTerminal) ? withTerminal : slug;
    }
    for (let n = 2; taken.has(slug); n += 1) {
      slug = `${base}-${n}`;
    }
    taken.add(slug);
    return { ...lounge, slug };
  });
}

// --- Free-text access mapping ---------------------------------------------------

const ACCESS_PATTERNS: Array<[RegExp, LoungeAccessProgram]> = [
  [/priority\s*pass/i, "priority-pass"],
  [/lounge\s*key/i, "lounge-key"],
  [/dragon\s*pass/i, "dragon-pass"],
  [/centurion/i, "amex-centurion"],
  [/(amex|american\s*express)/i, "amex-platinum"],
  [/sapphire\s*lounge/i, "chase-sapphire-lounge"],
  [/(chase|sapphire)/i, "chase-sapphire-reserve"],
  [/venture\s*x|capital\s*one/i, "capital-one-venture-x"],
  [/sky\s*club/i, "delta-sky-club"],
  [/united\s*club/i, "united-club"],
  [/admirals\s*club/i, "admirals-club"],
  [/lufthansa|senator\s+lounge/i, "lufthansa"],
  [/star\s*alliance/i, "star-alliance-gold"],
  [/one\s*world\s*emerald/i, "oneworld-emerald"],
  [/one\s*world/i, "oneworld-sapphire"],
  [/sky\s*team/i, "skyteam-elite-plus"],
  [/first\s*class/i, "first-class"],
  [/business\s*class/i, "business-class"],
  [/(elite|gold|platinum|silver)\s+(status|member|tier)|frequent\s*flyer/i, "airline-status"],
  [/day\s*pass|walk[-\s]*in|paid\s*(entry|access)|pay\s*(at|per)/i, "day-pass"],
];

/** Best-effort mapping of a guide's free-text access string to a program. */
export function mapAccessString(value: string): LoungeAccessMethod {
  const trimmed = value.trim();
  for (const [pattern, program] of ACCESS_PATTERNS) {
    if (pattern.test(trimmed)) {
      // Keep the original text as details only when it says more than the
      // program label already does ("Priority Pass" → no details).
      const redundant = trimmed.toLowerCase() === PROGRAM_LABELS[program].toLowerCase();
      return redundant ? { program } : { program, details: trimmed };
    }
  }
  return { program: "other", label: trimmed };
}

// --- Views -----------------------------------------------------------------------

/** What the UI renders — table rows and legacy guide-jsonb lounges both map here. */
export interface AirportLoungeView {
  /** Absent for guide-jsonb fallback lounges, which have no subpage. */
  slug?: string;
  name: string;
  terminal: string;
  zone?: string;
  location?: string;
  access: LoungeAccessMethod[];
  hours?: string;
  amenities: string[];
  foodAndDrinks?: string;
  showers?: boolean;
  bestFor: string[];
  verdict?: AirportLoungeVerdict;
  summary: string;
  description?: string;
  status: AirportLoungeStatus;
  sourceUrls: string[];
  /** ISO date of the last web verification; absent for unverified seeds. */
  lastVerified?: string;
}

export function loungeRowToView(row: AirportLoungeRow): AirportLoungeView {
  return {
    slug: row.slug,
    name: row.name,
    terminal: row.terminal,
    zone: row.zone ?? undefined,
    location: row.location ?? undefined,
    access: row.access,
    hours: row.hours ?? undefined,
    amenities: row.amenities,
    foodAndDrinks: row.foodAndDrinks ?? undefined,
    showers: row.showers ?? undefined,
    bestFor: row.bestFor,
    verdict: row.verdict ?? undefined,
    summary: row.summary,
    description: row.description ?? undefined,
    status: row.status,
    sourceUrls: row.sourceUrls,
    lastVerified: row.lastVerified ?? undefined,
  };
}

export function guideLoungeToView(lounge: AirportLounge): AirportLoungeView {
  return {
    name: lounge.name,
    terminal: lounge.terminal,
    zone: lounge.zone,
    access: lounge.access.map(mapAccessString),
    hours: lounge.hours,
    amenities: lounge.amenities ?? [],
    bestFor: lounge.bestFor ?? [],
    verdict: lounge.verdict,
    summary: lounge.summary,
    status: "open",
    sourceUrls: [],
  };
}

// --- Uncached DB access ------------------------------------------------------------

export async function fetchAirportLoungeRows(iata: string): Promise<AirportLoungeRow[]> {
  if (!isDatabaseConfigured()) {
    console.warn("DATABASE_URL is not set; airport lounges are unavailable.");
    return [];
  }

  return getDb()
    .select()
    .from(airportLounges)
    .where(eq(airportLounges.iata, iata.toUpperCase()))
    .orderBy(asc(airportLounges.terminal), asc(airportLounges.name));
}

export async function fetchAirportLoungeRow(
  iata: string,
  slug: string,
): Promise<AirportLoungeRow | null> {
  if (!isDatabaseConfigured()) {
    console.warn("DATABASE_URL is not set; airport lounges are unavailable.");
    return null;
  }

  const rows = await getDb()
    .select()
    .from(airportLounges)
    .where(and(eq(airportLounges.iata, iata.toUpperCase()), eq(airportLounges.slug, slug)))
    .limit(1);

  return rows[0] ?? null;
}

export async function fetchAllAirportLoungeRows(): Promise<AirportLoungeRow[]> {
  if (!isDatabaseConfigured()) {
    console.warn("DATABASE_URL is not set; airport lounges are unavailable.");
    return [];
  }

  return getDb()
    .select()
    .from(airportLounges)
    .orderBy(asc(airportLounges.iata), asc(airportLounges.terminal), asc(airportLounges.name));
}

/** Insert or update lounges by their stable (iata, slug) identity. */
export async function upsertAirportLounges(
  iata: string,
  records: AirportLoungeRecord[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  const normalizedIata = iata.toUpperCase();
  const db = getDb();

  await db.transaction(async (tx) => {
    for (const record of records) {
      const values = {
        iata: normalizedIata,
        slug: record.slug,
        name: record.name,
        terminal: record.terminal,
        zone: record.zone ?? null,
        location: record.location ?? null,
        access: record.access,
        hours: record.hours ?? null,
        amenities: record.amenities,
        foodAndDrinks: record.foodAndDrinks ?? null,
        showers: record.showers ?? null,
        bestFor: record.bestFor,
        verdict: record.verdict ?? null,
        summary: record.summary,
        description: record.description ?? null,
        status: record.status,
        sourceUrls: record.sourceUrls,
        lastVerified: record.lastVerified ?? null,
        updatedAt: new Date(),
      };

      await tx
        .insert(airportLounges)
        .values(values)
        .onConflictDoUpdate({
          target: [airportLounges.iata, airportLounges.slug],
          set: values,
        });
    }
  });
}

export async function setAirportLoungeStatus(
  iata: string,
  slug: string,
  status: AirportLoungeStatus,
): Promise<void> {
  await getDb()
    .update(airportLounges)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(airportLounges.iata, iata.toUpperCase()), eq(airportLounges.slug, slug)));
}

/**
 * Guides for lounge-less airports sometimes carry an explanatory placeholder
 * entry ("No lounges available") — never a real lounge, never a page.
 */
const PLACEHOLDER_LOUNGE_NAME = /\bno\s+(dedicated\s+)?(vip\s+)?lounges?\b|^none\b|^n\/?a$/i;

/** A guide's lounges minus explanatory placeholder entries. */
export function realGuideLounges(lounges: AirportLounge[]): AirportLounge[] {
  return lounges.filter((lounge) => !PLACEHOLDER_LOUNGE_NAME.test(lounge.name));
}

/**
 * Copy a guide's jsonb lounges into the directory as unverified seed rows
 * (`lastVerified: null`). No-op once the airport has any rows, so the guide
 * pipeline can call this after every upsert without ever overwriting
 * web-verified data. Returns the number of rows inserted.
 */
export async function seedLoungesFromGuide(row: AirportGuideRow): Promise<number> {
  const lounges = realGuideLounges(row.lounges);
  if (!isDatabaseConfigured() || lounges.length === 0) {
    return 0;
  }

  const existing = await fetchAirportLoungeRows(row.iata);
  if (existing.length > 0) {
    return 0;
  }

  const records = assignLoungeSlugs(lounges, new Set()).map((lounge) => ({
    slug: lounge.slug,
    name: lounge.name,
    terminal: lounge.terminal,
    zone: lounge.zone,
    location: undefined,
    access: lounge.access.map(mapAccessString),
    hours: lounge.hours,
    amenities: lounge.amenities ?? [],
    foodAndDrinks: undefined,
    showers: undefined,
    bestFor: lounge.bestFor ?? [],
    verdict: lounge.verdict,
    summary: lounge.summary,
    description: undefined,
    status: "open" as const,
    sourceUrls: [],
    lastVerified: null,
  }));

  await upsertAirportLounges(row.iata, records);
  return records.length;
}
