/**
 * Shared headless invocation of the local `grok` CLI (Grok Build free
 * tokens). Used by the guide generator and the image sync pipeline.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const GROK_BIN = process.env.GROK_BIN ?? "grok";
const GROK_MODEL = process.env.GROK_MODEL; // optional, defaults to CLI default
const DEFAULT_TIMEOUT_MS = 40 * 60 * 1000;

export interface GrokHeadlessResult {
  text?: string;
  structuredOutput?: unknown;
  stopReason?: string;
}

export async function runGrokHeadless(
  prompt: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<GrokHeadlessResult> {
  const scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), "airport-grok-"));

  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--max-turns",
    "100",
    "--cwd",
    scratchDir,
  ];
  if (GROK_MODEL) {
    args.push("--model", GROK_MODEL);
  }

  try {
    return await new Promise<GrokHeadlessResult>((resolve, reject) => {
      const child = spawn(GROK_BIN, args, {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs,
      });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

      child.on("error", reject);
      child.on("close", (code, signal) => {
        if (signal) {
          reject(new Error(`grok timed out or was killed (signal ${signal})`));
          return;
        }
        if (code !== 0) {
          reject(new Error(`grok exited with code ${code}: ${stderr.slice(-2000)}`));
          return;
        }

        // stdout is a single pretty-printed JSON envelope; grab it defensively
        // in case warnings leak onto stdout.
        const start = stdout.indexOf("{");
        const end = stdout.lastIndexOf("}");
        if (start === -1 || end <= start) {
          reject(new Error(`grok produced no JSON envelope. stdout tail: ${stdout.slice(-500)}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout.slice(start, end + 1)) as GrokHeadlessResult);
        } catch (error) {
          reject(new Error(`failed to parse grok envelope: ${error}`));
        }
      });
    });
  } finally {
    await fs.rm(scratchDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Pull a JSON payload out of a grok result: prefers structuredOutput, falls
 * back to the outermost JSON object in the text (code fences stripped).
 */
export function extractJsonCandidates(result: GrokHeadlessResult): unknown[] {
  const candidates: unknown[] = [];

  if (result.structuredOutput != null) {
    candidates.push(result.structuredOutput);
  }

  if (typeof result.text === "string") {
    const cleaned = result.text.replace(/```(?:json)?/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        candidates.push(JSON.parse(cleaned.slice(start, end + 1)));
      } catch {
        // caller reports the schema error
      }
    }
  }

  return candidates;
}
