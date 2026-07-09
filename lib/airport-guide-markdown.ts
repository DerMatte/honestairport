/** Pure markdown helpers safe for client and server components. */

export function stripOfficialSourcesSection(content: string): string {
  return content.replace(/\n##\s+Official Sources[\s\S]*$/i, "").trim();
}

/** Strip YAML frontmatter from a partial or complete streamed guide. */
export function extractStreamableGuideBody(markdown: string): string {
  const closedFrontmatter = markdown.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  if (closedFrontmatter) {
    return closedFrontmatter[1] ?? "";
  }

  if (markdown.startsWith("---")) {
    return "";
  }

  return markdown;
}

/**
 * The generate endpoint appends one of these markers after the last real
 * chunk of streamed markdown, once it knows whether the guide actually made
 * it into the database. Without this, the client has no way to tell a
 * genuine success from a save that silently failed after the visible text
 * had already finished streaming.
 */
export type GuideSaveOutcome = { status: "ok" } | { status: "error"; message: string };

const GUIDE_SAVE_MARKER_PATTERN = /\n?<!--HONESTAIRPORT_GUIDE_SAVE:(ok|error)(?::([^>]*))?-->\s*$/;

export function buildGuideSaveMarker(outcome: GuideSaveOutcome): string {
  return outcome.status === "ok"
    ? "\n<!--HONESTAIRPORT_GUIDE_SAVE:ok-->"
    : `\n<!--HONESTAIRPORT_GUIDE_SAVE:error:${encodeURIComponent(outcome.message)}-->`;
}

/** Strips a trailing save-outcome marker (if present) and reports what it said. */
export function extractGuideSaveMarker(markdown: string): {
  body: string;
  outcome: GuideSaveOutcome | null;
} {
  const match = markdown.match(GUIDE_SAVE_MARKER_PATTERN);
  if (!match) {
    return { body: markdown, outcome: null };
  }

  const body = markdown.slice(0, match.index).trimEnd();
  if (match[1] === "ok") {
    return { body, outcome: { status: "ok" } };
  }

  return {
    body,
    outcome: {
      status: "error",
      message: match[2] ? decodeURIComponent(match[2]) : "Guide failed validation.",
    },
  };
}