#!/usr/bin/env tsx
/**
 * CLI for reading and writing airport guides in Postgres. This is the
 * interface content agents use now that guides live in the database instead
 * of content/airports/*.md.
 *
 * Usage:
 *   pnpm guide list                    # IATA, name, lastUpdated for all guides
 *   pnpm guide show LHR                # print guide markdown (frontmatter + body)
 *   pnpm guide show LHR /tmp/lhr.md    # export guide markdown to a file
 *   pnpm guide save /tmp/lhr.md        # validate + upsert + revalidate site
 *
 * Every save validates against the guide schema and snapshots the previous
 * version into airport_guide_revisions.
 */
import fs from "node:fs/promises";
import matter from "gray-matter";
import {
  fetchAirportGuideRow,
  fetchAllAirportGuideRows,
  parseAirportGuideMarkdown,
  rowToAirportContent,
  upsertAirportGuide,
} from "../lib/airport-guides";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

function guideToMarkdown(row: Awaited<ReturnType<typeof fetchAirportGuideRow>>): string {
  if (!row) throw new Error("row is null");
  const { frontmatter, content } = rowToAirportContent(row);
  // YAML serializers reject undefined values; only emit populated fields.
  const data = Object.fromEntries(
    Object.entries(frontmatter).filter(([, value]) => value !== undefined),
  );
  return matter.stringify(content + "\n", data);
}

async function list() {
  const rows = await fetchAllAirportGuideRows();
  for (const row of rows.sort((a, b) => a.iata.localeCompare(b.iata))) {
    console.log(`${row.iata}\t${row.lastUpdated}\t${row.name} (${row.city}, ${row.country})`);
  }
  console.log(`\n${rows.length} guides.`);
}

async function show(iata: string, outFile?: string) {
  const row = await fetchAirportGuideRow(iata);
  if (!row) {
    console.error(`No guide found for ${iata.toUpperCase()}.`);
    process.exit(1);
  }

  const markdown = guideToMarkdown(row);
  if (outFile) {
    await fs.writeFile(outFile, markdown);
    console.log(`Wrote ${row.iata} to ${outFile}`);
  } else {
    process.stdout.write(markdown);
  }
}

async function save(filePath: string) {
  const markdown = await fs.readFile(filePath, "utf8");
  const row = await upsertAirportGuide(parseAirportGuideMarkdown(markdown));
  console.log(`✓ Saved ${row.iata} (${row.name}) to Postgres.`);
  await requestSiteRevalidation();
}

async function main() {
  const [command, arg, extra] = process.argv.slice(2);

  switch (command) {
    case "list":
      return list();
    case "show":
      if (!arg) break;
      return show(arg, extra);
    case "save":
      if (!arg) break;
      return save(arg);
  }

  console.error("Usage: pnpm guide <list | show IATA [out.md] | save file.md>");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
