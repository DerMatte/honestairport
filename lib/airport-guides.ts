/**
 * Airport guide domain logic: types, markdown parsing, validation, and raw
 * (uncached) Postgres access. This module is Next-free on purpose — scripts
 * and agents run it directly via tsx to read and write guides in the DB.
 *
 * App code should read through `lib/airport-content.ts`, which wraps these
 * reads in Next's data cache with revalidation tags.
 */
import { eq } from "drizzle-orm";
import matter from "gray-matter";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "./db";
import { airportGuideRevisions, airportGuides, type AirportGuideRow } from "./db/schema";
import type { ImportantTip, ImportantTipCategory } from "./types";

export interface AirportBentoTip {
  category?: "timing" | "terminal" | "food" | "status";
  label: string;
  title: string;
  summary: string;
  detail?: string;
}

export type AirportLoungeVerdict = "worth-it" | "depends" | "skip";

export interface AirportLounge {
  name: string;
  terminal: string;
  zone?: string;
  access: string[];
  hours?: string;
  amenities?: string[];
  bestFor?: string[];
  verdict?: AirportLoungeVerdict;
  summary: string;
}

export type AirportWaterOptionKind = "purchase" | "refill" | "free";

export interface AirportWaterOption {
  kind: AirportWaterOptionKind;
  name: string;
  terminal: string;
  /** Walkable landmark reference, e.g. "Opposite McDonald's near Gate B12". */
  location: string;
  zone?: "airside" | "landside";
  price?: string;
  summary: string;
  isBestValue?: boolean;
  isBestQuality?: boolean;
}

export interface AirportFrontmatter {
  iata: string;
  name: string;
  city: string;
  country: string;
  lastUpdated: string;
  sources?: string[];
  quickFacts?: string[];
  bentoTips?: AirportBentoTip[];
  lounges?: AirportLounge[];
  waterOptions?: AirportWaterOption[];
}

export interface AirportContent {
  frontmatter: AirportFrontmatter;
  content: string;
}

export interface AirportSummary {
  iata: string;
  name: string;
  city: string;
  country: string;
  lastUpdated: string;
}

export interface AirportGuideSummary {
  iata: string;
  lastUpdated: string;
  quickFacts: string[];
  sources: string[];
  sourceLinks: AirportGuideSourceLink[];
  importantTips: ImportantTip[];
  lounges: AirportLounge[];
  waterOptions: AirportWaterOption[];
  sections: AirportGuideSections;
}

export interface AirportGuideSourceLink {
  label: string;
  href: string;
}

export interface AirportGuideSection {
  title: string;
  items: string[];
}

export interface AirportGuideSections {
  airportTricks?: AirportGuideSection;
  terminalNavigation?: AirportGuideSection;
  groundTransport?: AirportGuideSection;
  loungesAmenities?: AirportGuideSection;
  waterHydration?: AirportGuideSection;
  foodAndDrink?: AirportGuideSection;
  budgetTravelerTips?: AirportGuideSection;
}

const WATER_KEYWORD_PATTERN =
  /\b(water|bottle|refill|hydration|fountain|drinking\s+water|fill\s+up)\b/i;

export function isWaterRelatedGuideItem(item: string): boolean {
  return WATER_KEYWORD_PATTERN.test(item);
}

export function filterWaterRelatedGuideItems(items: string[]): string[] {
  return items.filter(isWaterRelatedGuideItem);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isImportantTipCategory(value: unknown): value is ImportantTipCategory {
  return value === "timing" || value === "terminal" || value === "food" || value === "status";
}

function normalizeHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toDisplayText(value: string): string {
  return value
    .replace(/^\s*[-*]\s+/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function getMarkdownSections(content: string): Map<string, { title: string; body: string }> {
  const matches = [...content.matchAll(/^##\s+(.+)$/gm)];
  const sections = new Map<string, { title: string; body: string }>();

  matches.forEach((match, index) => {
    const title = match[1]?.trim();

    if (!title) {
      return;
    }

    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? content.length;
    sections.set(normalizeHeading(title), {
      title,
      body: content.slice(start, end).trim(),
    });
  });

  return sections;
}

function readGuideSection(
  sections: Map<string, { title: string; body: string }>,
  aliases: string[],
): AirportGuideSection | undefined {
  const section = aliases
    .map((alias) => sections.get(normalizeHeading(alias)))
    .find((match): match is { title: string; body: string } => Boolean(match));

  if (!section) {
    return undefined;
  }

  const items = section.body
    .split(/\r?\n/)
    .map(toDisplayText)
    .filter(isNonEmptyString)
    .slice(0, 8);

  if (items.length === 0) {
    return undefined;
  }

  return {
    title: section.title,
    items,
  };
}

function sourceLabelFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function stripOfficialSourcesSection(content: string): string {
  return content.replace(/\n##\s+Official Sources[\s\S]*$/i, "").trim();
}

export function extractOfficialSourceLinks(
  content: string,
  fallbackSources: string[] = [],
): AirportGuideSourceLink[] {
  const match = content.match(/\n##\s+Official Sources\s*\n([\s\S]*?)$/i);
  const links: AirportGuideSourceLink[] = [];
  const seen = new Set<string>();

  function addLink(label: string, href: string) {
    const trimmedHref = href.trim();
    const trimmedLabel = label.trim();
    if (!trimmedHref || seen.has(trimmedHref)) return;
    seen.add(trimmedHref);
    links.push({ label: trimmedLabel || sourceLabelFromUrl(trimmedHref), href: trimmedHref });
  }

  if (match) {
    for (const line of match[1].split("\n")) {
      const markdownLink = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (markdownLink) {
        addLink(markdownLink[1], markdownLink[2]);
        continue;
      }

      const bareUrl = line.match(/https?:\/\/\S+/);
      if (bareUrl) {
        addLink(sourceLabelFromUrl(bareUrl[0]), bareUrl[0]);
      }
    }
  }

  if (links.length > 0) {
    return links;
  }

  return fallbackSources.map((href) => ({
    label: sourceLabelFromUrl(href),
    href,
  }));
}

function getAirportGuideSections(content: string): AirportGuideSections {
  const sections = getMarkdownSections(stripOfficialSourcesSection(content));

  return {
    airportTricks: readGuideSection(sections, [
      "Best Airport Tricks & Hacks",
      "Insider Tips & Tricks",
    ]),
    terminalNavigation: readGuideSection(sections, [
      "Terminals & Navigation",
      "Terminal & Navigation Guide",
      "Terminal Navigation",
    ]),
    groundTransport: readGuideSection(sections, [
      "Ground Transport & Parking",
      "Getting There & Away",
    ]),
    loungesAmenities: readGuideSection(sections, [
      "Lounges, Food & Amenities",
      "Lounges & Amenities",
      "Lounges",
    ]),
    waterHydration: readGuideSection(sections, [
      "Water & Hydration",
      "Water Bottles & Refills",
    ]),
    foodAndDrink: readGuideSection(sections, ["Food & Drink"]),
    budgetTravelerTips: readGuideSection(sections, ["Budget Traveler Tips"]),
  };
}

function isWaterOptionKind(value: unknown): value is AirportWaterOptionKind {
  return value === "purchase" || value === "refill" || value === "free";
}

function isWaterZone(value: unknown): value is NonNullable<AirportWaterOption["zone"]> {
  return value === "airside" || value === "landside";
}

function toWaterOptions(waterOptions: unknown): AirportWaterOption[] {
  if (!Array.isArray(waterOptions)) {
    return [];
  }

  return waterOptions.flatMap((option) => {
    if (typeof option !== "object" || option === null) {
      return [];
    }

    const candidate = option as Record<string, unknown>;

    if (
      !isWaterOptionKind(candidate.kind) ||
      !isNonEmptyString(candidate.name) ||
      !isNonEmptyString(candidate.terminal) ||
      !isNonEmptyString(candidate.location) ||
      !isNonEmptyString(candidate.summary)
    ) {
      return [];
    }

    return [
      {
        kind: candidate.kind,
        name: candidate.name.trim(),
        terminal: candidate.terminal.trim(),
        location: candidate.location.trim(),
        zone: isWaterZone(candidate.zone) ? candidate.zone : undefined,
        price: isNonEmptyString(candidate.price) ? candidate.price.trim() : undefined,
        summary: candidate.summary.trim(),
        isBestValue: candidate.isBestValue === true ? true : undefined,
        isBestQuality: candidate.isBestQuality === true ? true : undefined,
      } satisfies AirportWaterOption,
    ];
  });
}

function isLoungeVerdict(value: unknown): value is AirportLoungeVerdict {
  return value === "worth-it" || value === "depends" || value === "skip";
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isNonEmptyString).map((item) => item.trim());
}

function toLounges(lounges: unknown): AirportLounge[] {
  if (!Array.isArray(lounges)) {
    return [];
  }

  return lounges.flatMap((lounge) => {
    if (typeof lounge !== "object" || lounge === null) {
      return [];
    }

    const candidate = lounge as Record<string, unknown>;

    if (
      !isNonEmptyString(candidate.name) ||
      !isNonEmptyString(candidate.terminal) ||
      !isNonEmptyString(candidate.summary)
    ) {
      return [];
    }

    return [
      {
        name: candidate.name.trim(),
        terminal: candidate.terminal.trim(),
        zone: isNonEmptyString(candidate.zone) ? candidate.zone.trim() : undefined,
        access: toStringList(candidate.access),
        hours: isNonEmptyString(candidate.hours) ? candidate.hours.trim() : undefined,
        amenities: toStringList(candidate.amenities),
        bestFor: toStringList(candidate.bestFor),
        verdict: isLoungeVerdict(candidate.verdict) ? candidate.verdict : undefined,
        summary: candidate.summary.trim(),
      } satisfies AirportLounge,
    ];
  });
}

function toImportantTips(iata: string, bentoTips: AirportBentoTip[] = []): ImportantTip[] {
  return bentoTips
    .filter(
      (tip) =>
        isNonEmptyString(tip.label) &&
        isNonEmptyString(tip.title) &&
        isNonEmptyString(tip.summary),
    )
    .map((tip, index) => ({
      id: `${iata.toLowerCase()}-guide-tip-${index + 1}`,
      category: isImportantTipCategory(tip.category) ? tip.category : "status",
      label: tip.label.trim(),
      title: tip.title.trim(),
      summary: tip.summary.trim(),
      detail: isNonEmptyString(tip.detail) ? tip.detail.trim() : undefined,
    }));
}

export function getAirportGuideSummary(content: AirportContent): AirportGuideSummary {
  const { frontmatter } = content;
  const iata = isNonEmptyString(frontmatter.iata) ? frontmatter.iata.trim() : "unknown";
  const quickFacts = Array.isArray(frontmatter.quickFacts) ? frontmatter.quickFacts : [];
  const sources = Array.isArray(frontmatter.sources) ? frontmatter.sources : [];
  const bentoTips = Array.isArray(frontmatter.bentoTips) ? frontmatter.bentoTips : [];

  return {
    iata,
    lastUpdated: isNonEmptyString(frontmatter.lastUpdated)
      ? frontmatter.lastUpdated.trim()
      : "Unknown",
    quickFacts: quickFacts.filter(isNonEmptyString).map((fact) => fact.trim()),
    sources: sources.filter(isNonEmptyString).map((source) => source.trim()),
    sourceLinks: extractOfficialSourceLinks(
      content.content,
      sources.filter(isNonEmptyString).map((source) => source.trim()),
    ),
    importantTips: toImportantTips(iata, bentoTips),
    lounges: toLounges(frontmatter.lounges),
    waterOptions: toWaterOptions(frontmatter.waterOptions),
    sections: getAirportGuideSections(content.content),
  };
}

// --- Markdown <-> row conversion ---------------------------------------------

/** Parse a full guide document (frontmatter + body) as produced by the generator. */
export function parseAirportGuideMarkdown(markdown: string): AirportContent {
  const { data, content } = matter(markdown);
  return {
    frontmatter: data as AirportFrontmatter,
    content: content.trim(),
  };
}

export function rowToAirportContent(row: AirportGuideRow): AirportContent {
  return {
    frontmatter: {
      iata: row.iata,
      name: row.name,
      city: row.city,
      country: row.country,
      lastUpdated: row.lastUpdated,
      sources: row.sources,
      quickFacts: row.quickFacts,
      bentoTips: row.bentoTips,
      lounges: row.lounges,
      waterOptions: row.waterOptions,
    },
    content: row.content,
  };
}

export function rowToAirportSummary(row: AirportGuideRow): AirportSummary {
  return {
    iata: row.iata,
    name: row.name,
    city: row.city,
    country: row.country,
    lastUpdated: row.lastUpdated,
  };
}

// --- Validation ---------------------------------------------------------------

const nonEmptyString = z.string().trim().min(1);

const bentoTipSchema = z.object({
  category: z.enum(["timing", "terminal", "food", "status"]),
  label: nonEmptyString,
  title: nonEmptyString,
  summary: nonEmptyString,
  detail: nonEmptyString.optional(),
});

const loungeSchema = z.object({
  name: nonEmptyString,
  terminal: nonEmptyString,
  zone: nonEmptyString.optional(),
  access: z.array(nonEmptyString).optional(),
  hours: nonEmptyString.optional(),
  amenities: z.array(nonEmptyString).optional(),
  bestFor: z.array(nonEmptyString).optional(),
  verdict: z.enum(["worth-it", "depends", "skip"]).optional(),
  summary: nonEmptyString,
});

const waterOptionSchema = z
  .object({
    kind: z.enum(["purchase", "refill", "free"]),
    name: nonEmptyString,
    terminal: nonEmptyString,
    location: nonEmptyString.min(
      12,
      "must name a walkable landmark (e.g. next to Heinemann, opposite McDonald's)",
    ),
    zone: z.enum(["airside", "landside"]).optional(),
    price: nonEmptyString.optional(),
    summary: nonEmptyString,
    isBestValue: z.boolean().optional(),
    isBestQuality: z.boolean().optional(),
  })
  .superRefine((option, ctx) => {
    if (option.kind === "purchase" && !option.price) {
      ctx.addIssue({
        code: "custom",
        message: "purchase options must include a price",
        path: ["price"],
      });
    }

    if (option.location.trim().toLowerCase() === option.terminal.trim().toLowerCase()) {
      ctx.addIssue({
        code: "custom",
        message: "location must be more specific than the terminal name alone",
        path: ["location"],
      });
    }
  });

export const airportFrontmatterSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter uppercase IATA code"),
  name: nonEmptyString,
  city: nonEmptyString,
  country: nonEmptyString,
  lastUpdated: z.iso.date(),
  sources: z.array(z.url()).min(1),
  quickFacts: z.array(nonEmptyString).min(1),
  bentoTips: z.array(bentoTipSchema).min(1),
  lounges: z.array(loungeSchema).min(1),
  waterOptions: z.array(waterOptionSchema).optional(),
});

export const REQUIRED_GUIDE_SECTIONS: Array<{
  key: keyof AirportGuideSections;
  label: string;
}> = [
  { key: "airportTricks", label: "Best Airport Tricks & Hacks" },
  { key: "terminalNavigation", label: "Terminals & Navigation" },
  { key: "groundTransport", label: "Ground Transport & Parking" },
  { key: "loungesAmenities", label: "Lounges, Food & Amenities" },
];

/**
 * Full quality gate for a guide: frontmatter schema plus the section
 * extraction the site relies on. Returns a list of human-readable errors,
 * empty when the guide is valid. This is the only gate between an AI-written
 * guide and production now that content no longer goes through PR review.
 */
export function validateAirportGuide(content: AirportContent): string[] {
  const errors: string[] = [];

  const result = airportFrontmatterSchema.safeParse(content.frontmatter);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const at = issue.path.length > 0 ? issue.path.join(".") : "frontmatter";
      errors.push(`frontmatter ${at}: ${issue.message}`);
    }
  }

  const summary = getAirportGuideSummary(content);
  for (const { key, label } of REQUIRED_GUIDE_SECTIONS) {
    const section = summary.sections[key];
    if (!section || section.items.length === 0) {
      errors.push(`section "## ${label}" is missing or empty (heading drift?)`);
    }
  }

  return errors;
}

// --- Uncached DB access ---------------------------------------------------------

export async function fetchAirportGuideRow(iata: string): Promise<AirportGuideRow | null> {
  if (!isDatabaseConfigured()) {
    console.warn("DATABASE_URL is not set; airport guides are unavailable.");
    return null;
  }

  const rows = await getDb()
    .select()
    .from(airportGuides)
    .where(eq(airportGuides.iata, iata.toUpperCase()))
    .limit(1);

  return rows[0] ?? null;
}

export async function fetchAllAirportGuideRows(): Promise<AirportGuideRow[]> {
  if (!isDatabaseConfigured()) {
    console.warn("DATABASE_URL is not set; airport guides are unavailable.");
    return [];
  }

  return getDb().select().from(airportGuides);
}

export async function listAirportGuideIatas(): Promise<string[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const rows = await getDb().select({ iata: airportGuides.iata }).from(airportGuides);
  return rows.map((row) => row.iata.toUpperCase()).sort();
}

export async function airportGuideExists(iata: string): Promise<boolean> {
  return (await fetchAirportGuideRow(iata)) !== null;
}

/**
 * Validate and write a guide. Snapshots the previous row into
 * `airport_guide_revisions` inside the same transaction, so every overwrite
 * by the content pipeline stays recoverable.
 *
 * Throws when the guide fails validation.
 */
export async function upsertAirportGuide(content: AirportContent): Promise<AirportGuideRow> {
  const errors = validateAirportGuide(content);
  if (errors.length > 0) {
    throw new Error(
      `Guide for ${content.frontmatter.iata ?? "unknown"} failed validation:\n  ${errors.join("\n  ")}`,
    );
  }

  const { frontmatter } = content;
  const iata = frontmatter.iata.toUpperCase();

  const values = {
    iata,
    name: frontmatter.name.trim(),
    city: frontmatter.city.trim(),
    country: frontmatter.country.trim(),
    lastUpdated: frontmatter.lastUpdated.trim(),
    sources: frontmatter.sources ?? [],
    quickFacts: frontmatter.quickFacts ?? [],
    bentoTips: frontmatter.bentoTips ?? [],
    lounges: toLounges(frontmatter.lounges),
    waterOptions: toWaterOptions(frontmatter.waterOptions),
    content: content.content,
    updatedAt: new Date(),
  };

  const db = getDb();

  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(airportGuides)
      .where(eq(airportGuides.iata, iata))
      .limit(1);

    if (existing[0]) {
      await tx.insert(airportGuideRevisions).values({
        iata,
        snapshot: existing[0],
      });
    }

    const [row] = await tx
      .insert(airportGuides)
      .values(values)
      .onConflictDoUpdate({
        target: airportGuides.iata,
        set: values,
      })
      .returning();

    return row;
  });
}
