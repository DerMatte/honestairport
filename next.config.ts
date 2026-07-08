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
    instantNavigationDevToolsToggle: true,
    // Prerender workers each open a DB pool; cap them so builds stay under
    // the managed Postgres connection limit.
    cpus: 4,
  },
};

export default withBotId(nextConfig);
