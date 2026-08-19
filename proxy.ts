import { NextResponse, type NextRequest } from "next/server";
import {
  isBlockedMarkdownPath,
  markdownRewritePath,
  prefersMarkdown,
  publicMarkdownPath,
} from "@/lib/markdown-negotiate";

function withVaryAccept(response: NextResponse): NextResponse {
  response.headers.append("Vary", "Accept");
  return response;
}

function rewriteToMarkdown(request: NextRequest, mdPath: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = mdPath;
  return withVaryAccept(NextResponse.rewrite(url));
}

function redirectToPublicMarkdown(
  request: NextRequest,
  mdPath: string,
): NextResponse {
  const publicPath = publicMarkdownPath(mdPath);
  if (!publicPath) {
    return withVaryAccept(
      new NextResponse("Not found\n", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  }
  const url = request.nextUrl.clone();
  url.pathname = publicPath;
  // 307 keeps the method; agents follow to the canonical `.md` URL so HTML and
  // markdown never share a CDN cache key (Next overwrites Vary on RSC HTML).
  return withVaryAccept(NextResponse.redirect(url, 307));
}

/**
 * Agent markdown negotiation:
 * - Explicit `*.md` (and `/.md`) → internal `/md/...` rewrite
 * - `Accept` preferring text/markdown → 307 to the canonical `*.md` URL
 * - Direct `/md/...` hits redirect to the public `*.md` URL
 * - Unknown `*.md` paths (login/settings/…) → plain 404
 *
 * x402 charging for airport/lounge markdown lives on the `/md` route handler
 * (`withX402`), not here — HTML and free markdown must keep passing through.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/md" || pathname.startsWith("/md/")) {
    const normalized = pathname.replace(/\/$/, "") || "/md";
    const publicPath = publicMarkdownPath(normalized);
    if (publicPath) {
      const url = request.nextUrl.clone();
      url.pathname = publicPath;
      return withVaryAccept(NextResponse.redirect(url, 308));
    }
    return withVaryAccept(
      new NextResponse("Not found\n", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  }

  if (isBlockedMarkdownPath(pathname)) {
    return withVaryAccept(
      new NextResponse("Not found\n", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      }),
    );
  }

  const mdTarget = markdownRewritePath(pathname);
  if (!mdTarget) {
    return NextResponse.next();
  }

  const explicitMarkdown = pathname.endsWith(".md") || pathname === "/.md";
  if (explicitMarkdown) {
    return rewriteToMarkdown(request, mdTarget);
  }

  if (prefersMarkdown(request.headers.get("accept"))) {
    return redirectToPublicMarkdown(request, mdTarget);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/md",
    "/md/:path*",
    "/airports/:slug",
    "/airports/:slug/lounge/:loungeSlug",
    // Any explicit `.md` URL (public pages + blocked private ones).
    "/((?!_next/static|_next/image|api/).*)\\.md",
    "/.md",
  ],
};
