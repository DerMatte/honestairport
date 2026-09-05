import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

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
    optimizePackageImports: ["lucide-react", "radix-ui", "cmdk", "motion"],
  },
  async redirects() {
    return [
      {
        source: "/compare/:a",
        destination: "/compare?a=:a",
        permanent: false,
      },
      {
        source: "/compare/:a/:b",
        destination: "/compare?a=:a&b=:b",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        // Internal markdown handler — canonical public URLs end in `.md`.
        source: "/md/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/mcp",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Mcp-Session, Last-Event-ID, PAYMENT-SIGNATURE, PAYMENT-REQUIRED",
          },
          {
            key: "Access-Control-Expose-Headers",
            value: "WWW-Authenticate, PAYMENT-REQUIRED, Mcp-Session-Id",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default withBotId(nextConfig);