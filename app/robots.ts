import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/llms.txt", "/index.md", "/sitemap.md"],
      disallow: ["/api/", "/login", "/reset-password", "/settings", "/md", "/md/", "/mcp"],
    },
    host: SITE_URL,
    // XML for classic crawlers; markdown sitemap for agents.
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/sitemap.md`],
  };
}
