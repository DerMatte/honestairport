#!/usr/bin/env tsx
/**
 * Validate every airport guide in content/airports/.
 *
 * Catches the failure mode where a guide with malformed frontmatter or a
 * drifted section heading silently renders incomplete: frontmatter is
 * checked against a zod schema, and the markdown body is run through the
 * same section extraction the site uses, asserting all four guide sections
 * are found.
 *
 * Runs as part of `pnpm build`; any error fails the build.
 *
 * Usage:
 *   pnpm validate:content
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  getAirportContent,
  getAirportGuideSummary,
  type AirportGuideSections,
} from "../lib/airport-content";

const CONTENT_DIR = path.join(process.cwd(), "content/airports");

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

const frontmatterSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter uppercase IATA code"),
  name: nonEmptyString,
  city: nonEmptyString,
  country: nonEmptyString,
  lastUpdated: z.iso.date(),
  sources: z.array(z.url()).min(1),
  quickFacts: z.array(nonEmptyString).min(1),
  bentoTips: z.array(bentoTipSchema).min(1),
  lounges: z.array(loungeSchema).min(1),
});

const REQUIRED_SECTIONS: Array<{ key: keyof AirportGuideSections; label: string }> = [
  { key: "airportTricks", label: "Best Airport Tricks & Hacks" },
  { key: "terminalNavigation", label: "Terminals & Navigation" },
  { key: "groundTransport", label: "Ground Transport & Parking" },
  { key: "loungesAmenities", label: "Lounges, Food & Amenities" },
];

async function validateFile(file: string): Promise<string[]> {
  const errors: string[] = [];
  const iata = file.replace(/\.md$/, "").toUpperCase();

  const content = await getAirportContent(iata);
  if (!content) {
    return ["file could not be read or parsed"];
  }

  const result = frontmatterSchema.safeParse(content.frontmatter);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const at = issue.path.length > 0 ? issue.path.join(".") : "frontmatter";
      errors.push(`frontmatter ${at}: ${issue.message}`);
    }
  } else if (result.data.iata !== iata) {
    errors.push(`frontmatter iata "${result.data.iata}" does not match filename "${file}"`);
  }

  const summary = getAirportGuideSummary(content);
  for (const { key, label } of REQUIRED_SECTIONS) {
    const section = summary.sections[key];
    if (!section || section.items.length === 0) {
      errors.push(`section "## ${label}" is missing or empty (heading drift?)`);
    }
  }

  return errors;
}

async function main() {
  const files = (await fs.readdir(CONTENT_DIR)).filter((f) => f.endsWith(".md")).sort();

  if (files.length === 0) {
    console.error(`No guides found in ${CONTENT_DIR}`);
    process.exit(1);
  }

  let failed = 0;
  for (const file of files) {
    const errors = await validateFile(file);
    if (errors.length > 0) {
      failed += 1;
      console.error(`✗ content/airports/${file}`);
      for (const error of errors) {
        console.error(`    ${error}`);
      }
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} of ${files.length} guides failed validation.`);
    process.exit(1);
  }

  console.log(`✓ All ${files.length} airport guides are valid.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
