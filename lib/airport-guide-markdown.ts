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