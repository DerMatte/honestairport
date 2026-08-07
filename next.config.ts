import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const MARKDOWN_ACCEPT = {
  type: "header" as const,
  key: "accept",
  value: "(.*)text/markdown(.*)",
};

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Multiple lockfiles exist on this machine; pin the workspace root explicitly.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Airport photos uploaded by scripts/sync-airport-images.ts.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    // Prerender workers each open a DB pool; cap them so builds stay under
    // the managed Postgres connection limit.
    cpus: 4,
    optimizePackageImports: ["lucide-react", "radix-ui", "cmdk"],
  },
  async rewrites() {
    return {
      beforeFiles: [
        // Explicit `.md` URLs (no Accept header required).
        { source: "/index.md", destination: "/md" },
        { source: "/sitemap.md", destination: "/md/sitemap" },
        {
          source: "/airports/:slug.md",
          destination: "/md/airports/:slug",
        },
        {
          source: "/airports/:slug/lounge/:loungeSlug.md",
          destination: "/md/airports/:slug/lounge/:loungeSlug",
        },
        // Content negotiation: same HTML URLs return markdown when requested.
        { source: "/", has: [MARKDOWN_ACCEPT], destination: "/md" },
        {
          source: "/airports/:slug",
          has: [MARKDOWN_ACCEPT],
          destination: "/md/airports/:slug",
        },
        {
          source: "/airports/:slug/lounge/:loungeSlug",
          has: [MARKDOWN_ACCEPT],
          destination: "/md/airports/:slug/lounge/:loungeSlug",
        },
      ],
    };
  },
};

export default withBotId(nextConfig);
