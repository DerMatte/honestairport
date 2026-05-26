import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "content/airports");

export interface AirportFrontmatter {
  iata: string;
  name: string;
  city: string;
  country: string;
  lastUpdated: string;
  sources?: string[];
  quickFacts?: string[];
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
