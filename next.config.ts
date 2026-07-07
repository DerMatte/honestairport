import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  // Multiple lockfiles exist on this machine; pin the workspace root explicitly.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Prerender workers each open a DB pool; cap them so builds stay under
    // the managed Postgres connection limit.
    cpus: 4,
  },
};

export default withBotId(nextConfig);
