import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

/**
 * libpq accepts `sslrootcert=system` ("use the OS trust store"), but
 * node-postgres would try to read a file literally named "system". Map that
 * combination to Node's default CA verification instead.
 */
export function buildPoolConfig(connectionString: string): PoolConfig {
  try {
    const url = new URL(connectionString);

    if (url.searchParams.get("sslrootcert") === "system") {
      url.searchParams.delete("sslrootcert");
      url.searchParams.delete("sslmode");
      return { connectionString: url.toString(), ssl: { rejectUnauthorized: true } };
    }
  } catch {
    // Not URL-shaped (e.g. key=value form) — hand it to pg untouched.
  }

  return { connectionString };
}

// Cached on globalThis so dev-server hot reloads reuse the pool instead of
// leaking connections.
const globalForDb = globalThis as unknown as {
  reviewsDb?: NodePgDatabase<typeof schema>;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL ?? process.env.CONNECTION_STRING);
}

export function getDb(): NodePgDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL ?? process.env.CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // Keep the pool small: build prerender workers each create their own pool,
  // and managed Postgres has a hard cap on connection slots. Queries here are
  // tiny single-row lookups, so 2 connections per process is plenty.
  globalForDb.reviewsDb ??= drizzle(
    new Pool({
      ...buildPoolConfig(connectionString),
      max: 2,
      idleTimeoutMillis: 5_000,
    }),
    { schema },
  );

  return globalForDb.reviewsDb;
}
