/**
 * Shared headless invocation of the local `pi` CLI (ChatGPT subscription via
 * the openai-codex provider). Counterpart to `grok-headless.ts` for pipelines
 * that run on GPT models instead of Grok Build tokens.
 *
 * Web research comes from the `pi-web-access` extension (installed user-wide;
 * `pi install npm:pi-web-access`), whose `web_search`/`fetch_content` tools
 * work with zero API keys (Exa MCP / Codex auth). Runs in a throwaway
 * scratch cwd so tool use can't touch the repo.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PI_BIN = process.env.PI_BIN ?? "pi";
const PI_PROVIDER = process.env.PI_PROVIDER ?? "openai-codex";
// gpt-5.6-sol is rejected on ChatGPT-account Codex auth; terra is the
// strongest 5.6 variant that works on the subscription.
const PI_MODEL = process.env.PI_MODEL ?? "gpt-5.6-terra";
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

export interface PiHeadlessResult {
  text?: string;
  model?: string;
}

interface PiMessage {
  role?: string;
  content?: Array<{ type?: string; text?: string }>;
  stopReason?: string;
  errorMessage?: string;
  model?: string;
}

function messageText(message: PiMessage): string {
  return (message.content ?? [])
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export async function runPiHeadless(
  prompt: string,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    tools = "web_search,fetch_content",
  }: { timeoutMs?: number; tools?: string } = {},
): Promise<PiHeadlessResult> {
  const scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), "airport-pi-"));

  const args = [
    "-p",
    "--mode",
    "json",
    "--no-session",
    "--no-context-files",
    "--provider",
    PI_PROVIDER,
    "--model",
    PI_MODEL,
    "--tools",
    tools,
    prompt,
  ];

  try {
    return await new Promise<PiHeadlessResult>((resolve, reject) => {
      const child = spawn(PI_BIN, args, {
        cwd: scratchDir,
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
          reject(new Error(`pi timed out or was killed (signal ${signal})`));
          return;
        }
        if (code !== 0) {
          reject(new Error(`pi exited with code ${code}: ${stderr.slice(-2000)}`));
          return;
        }

        // --mode json emits one JSON event per line; the answer is the last
        // assistant message that carries text. Surface the provider's error
        // message when the run ended in an error instead.
        let lastText = "";
        let lastError: string | undefined;
        let model: string | undefined;

        for (const line of stdout.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("{")) continue;

          let event: { type?: string; message?: PiMessage };
          try {
            event = JSON.parse(trimmed);
          } catch {
            continue;
          }

          if (event.type !== "message_end" || event.message?.role !== "assistant") {
            continue;
          }

          model = event.message.model ?? model;
          if (event.message.errorMessage) {
            lastError = event.message.errorMessage;
          }
          const text = messageText(event.message);
          if (text) {
            lastText = text;
          }
        }

        if (!lastText) {
          reject(
            new Error(
              lastError
                ? `pi run failed: ${lastError}`
                : `pi produced no assistant text. stdout tail: ${stdout.slice(-500)}`,
            ),
          );
          return;
        }

        resolve({ text: lastText, model });
      });
    });
  } finally {
    await fs.rm(scratchDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Outermost JSON object in the response text, code fences stripped. */
export function extractJsonFromText(text: string): unknown | undefined {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return undefined;
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return undefined;
  }
}
