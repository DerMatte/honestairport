/**
 * HTTP Accept negotiation helpers for agent markdown responses.
 * Prefer text/markdown only when its q-value beats text/html (and peers).
 */

export type NegotiatedMediaType = "text/markdown" | "text/html" | null;

function parseAcceptParts(header: string): Array<{ type: string; q: number }> {
  return header
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [rawType, ...params] = part.split(";").map((s) => s.trim());
      const type = rawType.toLowerCase();
      let q = 1;
      for (const param of params) {
        const match = /^q\s*=\s*([0-9.]+)$/i.exec(param);
        if (match) {
          const parsed = Number(match[1]);
          q = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0;
        }
      }
      return { type, q };
    })
    .filter((part) => part.q > 0);
}

function typeMatches(accepted: string, candidate: string): boolean {
  if (accepted === "*/*" || accepted === candidate) return true;
  const [aMain, aSub] = accepted.split("/");
  const [cMain, cSub] = candidate.split("/");
  return aMain === cMain && (aSub === "*" || aSub === cSub);
}

/**
 * Returns the preferred concrete type among markdown/html, or null when the
 * client did not express a preference between them (missing/empty Accept, or
 * only a wildcard media range).
 */
export function preferredPageType(acceptHeader: string | null): NegotiatedMediaType {
  if (!acceptHeader?.trim()) {
    return null;
  }

  const parts = parseAcceptParts(acceptHeader);
  if (parts.length === 0) {
    return null;
  }

  let bestMarkdown = -1;
  let bestHtml = -1;
  let sawConcrete = false;

  for (const { type, q } of parts) {
    if (type === "*/*") continue;
    if (typeMatches(type, "text/markdown")) {
      bestMarkdown = Math.max(bestMarkdown, q);
      sawConcrete = true;
    }
    if (typeMatches(type, "text/html") || typeMatches(type, "application/xhtml+xml")) {
      bestHtml = Math.max(bestHtml, q);
      sawConcrete = true;
    }
  }

  if (!sawConcrete) {
    return null;
  }

  if (bestMarkdown < 0 && bestHtml < 0) {
    return null;
  }
  if (bestMarkdown > bestHtml) {
    return "text/markdown";
  }
  if (bestHtml > bestMarkdown) {
    return "text/html";
  }
  // Equal q: prefer HTML for browsers that list both without ranking.
  if (bestHtml >= 0) {
    return "text/html";
  }
  return bestMarkdown >= 0 ? "text/markdown" : null;
}

export function prefersMarkdown(acceptHeader: string | null): boolean {
  return preferredPageType(acceptHeader) === "text/markdown";
}

/** Public pages that have a markdown representation. */
export function markdownRewritePath(pathname: string): string | null {
  if (pathname === "/" || pathname === "") {
    return "/md";
  }
  if (pathname === "/index" || pathname === "/index.md" || pathname === "/.md") {
    return "/md";
  }
  if (pathname === "/sitemap" || pathname === "/sitemap.md") {
    return "/md/sitemap";
  }

  const airport = /^\/airports\/([^/]+?)(?:\.md)?$/.exec(pathname);
  if (airport) {
    return `/md/airports/${airport[1].toLowerCase()}`;
  }

  const lounge = /^\/airports\/([^/]+)\/lounge\/([^/]+?)(?:\.md)?$/.exec(pathname);
  if (lounge) {
    return `/md/airports/${lounge[1].toLowerCase()}/lounge/${lounge[2]}`;
  }

  return null;
}

/** `.md` URLs that should 404 instead of falling through to HTML not-found. */
export function isBlockedMarkdownPath(pathname: string): boolean {
  if (!pathname.endsWith(".md") && pathname !== "/.md") {
    return false;
  }
  return markdownRewritePath(pathname) === null;
}

/** Canonical public markdown path for an internal `/md/...` path. */
export function publicMarkdownPath(mdPath: string): string | null {
  if (mdPath === "/md" || mdPath === "/md/") {
    return "/index.md";
  }
  if (mdPath === "/md/sitemap") {
    return "/sitemap.md";
  }
  const airport = /^\/md\/airports\/([^/]+)$/.exec(mdPath);
  if (airport) {
    return `/airports/${airport[1]}.md`;
  }
  const lounge = /^\/md\/airports\/([^/]+)\/lounge\/([^/]+)$/.exec(mdPath);
  if (lounge) {
    return `/airports/${lounge[1]}/lounge/${lounge[2]}.md`;
  }
  return null;
}
