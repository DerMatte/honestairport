import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { ImportantTip, ImportantTipCategory } from "@/lib/types";

const CONTENT_DIR = path.join(process.cwd(), "content/airports");

export interface AirportBentoTip {
  category?: "timing" | "terminal" | "food" | "status";
  label: string;
  title: string;
  summary: string;
  detail?: string;
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
  importantTips: ImportantTip[];
  sections: AirportGuideSections;
}

export interface AirportGuideSection {
  title: string;
  items: string[];
}

export interface AirportGuideSections {
  airportTricks?: AirportGuideSection;
  terminalNavigation?: AirportGuideSection;
  groundTransport?: AirportGuideSection;
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

function getAirportGuideSections(content: string): AirportGuideSections {
  const sections = getMarkdownSections(content);

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
  };
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
    importantTips: toImportantTips(iata, bentoTips),
    sections: getAirportGuideSections(content.content),
  };
}

export async function getAirportGuideSummaryByIata(
  iata: string,
): Promise<AirportGuideSummary | null> {
  const content = await getAirportContent(iata);
  return content ? getAirportGuideSummary(content) : null;
}

export async function getAirportContent(iata: string): Promise<AirportContent | null> {
  const filePath = path.join(CONTENT_DIR, `${iata.toLowerCase()}.md`);

  try {
    const fileContents = await fs.readFile(filePath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      frontmatter: data as AirportFrontmatter,
      content: content.trim(),
    };
  } catch (error) {
    console.warn(`No content file found for ${iata}:`, error);
    return null;
  }
}

export async function getAllAirportIatas(): Promise<string[]> {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", "").toUpperCase());
  } catch {
    return [];
  }
}

export async function getAllAirports(): Promise<AirportSummary[]> {
  const iatas = await getAllAirportIatas();
  const airports = await Promise.all(
    iatas.map(async (iata) => {
      const data = await getAirportContent(iata);
      if (!data) return null;

      const { frontmatter } = data;
      return {
        iata: frontmatter.iata,
        name: frontmatter.name,
        city: frontmatter.city,
        country: frontmatter.country,
        lastUpdated: frontmatter.lastUpdated,
      } satisfies AirportSummary;
    }),
  );

  return airports
    .filter((airport): airport is AirportSummary => airport !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}
