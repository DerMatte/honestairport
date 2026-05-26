#!/usr/bin/env tsx
/**
 * Review and enrich airport pages using the Cursor SDK (local agent).
 *
 * Usage:
 *   CURSOR_API_KEY=xxx pnpm review:airports
 *   CURSOR_API_KEY=xxx pnpm review:airports LHR
 *
 * Uses Vielfliegertreff-inspired editorial criteria from lib/airport-review-brief.ts
 */

import { Agent, CursorAgentError } from "@cursor/sdk";
import { buildAirportReviewPrompt } from "../lib/airport-review-brief";

async function reviewAirportPages(iata?: string) {
  const apiKey = process.env.CURSOR_API_KEY;
  if (!apiKey?.trim()) {
    console.error("Missing CURSOR_API_KEY. Add it to .env.local or export it in your shell.");
    console.error("Create a key at https://cursor.com/dashboard/integrations");
    process.exit(1);
  }

  const prompt = buildAirportReviewPrompt({ iata, openPr: false });

  console.log(iata ? `Reviewing ${iata.toUpperCase()}…` : "Reviewing all airport pages…");
  console.log("Agent is running locally against this repo. This may take several minutes.\n");

  try {
    const result = await Agent.prompt(prompt, {
      apiKey,
      model: { id: "composer-2.5" },
      name: iata ? `Review ${iata.toUpperCase()} airport page` : "Review airport pages",
      local: {
        cwd: process.cwd(),
        settingSources: [],
      },
    });

    if (result.status === "error") {
      console.error(`Run failed: ${result.id}`);
      process.exit(2);
    }

    console.log(`\nDone (${result.status}).`);
    if (result.result) {
      console.log("\n--- Agent summary ---\n");
      console.log(result.result);
    }
  } catch (error) {
    if (error instanceof CursorAgentError) {
      console.error(`Startup failed: ${error.message} (retryable=${error.isRetryable})`);
      process.exit(1);
    }
    throw error;
  }
}

const iata = process.argv[2];

reviewAirportPages(iata).catch((error) => {
  console.error(error);
  process.exit(1);
});
