#!/usr/bin/env tsx
/**
 * Apply pending Drizzle migrations from ./drizzle in journal order.
 *
 * Replacement for `drizzle-kit migrate`: managed Postgres providers
 * (e.g. PlanetScale) deny CREATE SCHEMA, which drizzle-kit runs
 * unconditionally for its bookkeeping schema. This runner keeps its journal
 * in a plain `public.__drizzle_migrations` table instead and applies each
 * migration file inside a transaction.
 *
 * Usage:
 *   pnpm db:migrate
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { buildPoolConfig } from "../lib/db";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

function resolveDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.CONNECTION_STRING;
}

/** Idempotent fixes for columns that must exist before the app reads guides. */
async function ensureSchemaRepairs(pool: Pool) {
  await pool.query(`
    ALTER TABLE "airport_guides"
    ADD COLUMN IF NOT EXISTS "water_options" jsonb DEFAULT '[]'::jsonb NOT NULL
  `);
}

async function main() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    console.warn(
      "Skipping migrations: DATABASE_URL is not set (put it in .env.local or the Vercel project environment).",
    );
    return;
  }

  const journal = JSON.parse(
    readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8"),
  ) as { entries: JournalEntry[] };

  const pool = new Pool({ ...buildPoolConfig(connectionString), max: 1 });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      "tag" text PRIMARY KEY,
      "applied_at" timestamptz NOT NULL DEFAULT now()
    )
  `);

  await ensureSchemaRepairs(pool);

  const { rows } = await pool.query<{ tag: string }>(
    'SELECT "tag" FROM "__drizzle_migrations"',
  );
  const applied = new Set(rows.map((row) => row.tag));

  let ran = 0;
  for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    if (applied.has(entry.tag)) {
      continue;
    }

    const sql = readFileSync(path.join(MIGRATIONS_DIR, `${entry.tag}.sql`), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const statement of statements) {
        await client.query(statement);
      }
      await client.query('INSERT INTO "__drizzle_migrations" ("tag") VALUES ($1)', [
        entry.tag,
      ]);
      await client.query("COMMIT");
      console.log(`applied ${entry.tag}`);
      ran += 1;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`failed ${entry.tag}:`, error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      client.release();
    }
  }

  // Journal can be ahead of the live schema if a deploy was interrupted; re-check.
  await ensureSchemaRepairs(pool);

  console.log(ran === 0 ? "Nothing to migrate — database is up to date." : `Done (${ran} applied).`);
  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
