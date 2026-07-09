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
  // Vercel's output file tracing has been missing sharp's native libvips .so
  // (dlopen'd, not require()'d, so static tracing can miss it) on airport
  // routes, causing ERR_DLOPEN_FAILED at runtime. Force it in explicitly.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
  experimental: {
    instantNavigationDevToolsToggle: true,
    // Prerender workers each open a DB pool; cap them so builds stay under
    // the managed Postgres connection limit.
    cpus: 4,
  },
};

export default withBotId(nextConfig);
