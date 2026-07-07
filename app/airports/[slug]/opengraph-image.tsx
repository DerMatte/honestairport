import { ImageResponse } from "next/og";
import { getAirportContent } from "@/lib/airport-content";
import { getAirportBySlug } from "@/lib/airport-utils";
import { SITE_NAME } from "@/lib/site";

export const alt = "Airport guide on HonestAirport";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

interface OgImageProps {
  params: Promise<{ slug: string }>;
}

interface OgAirport {
  iata: string;
  name: string;
  location: string;
  score?: number;
}

async function getOgAirport(slug: string): Promise<OgAirport | null> {
  const airport = getAirportBySlug(slug);

  if (airport) {
    return {
      iata: airport.iata,
      name: airport.name,
      location: `${airport.city}, ${airport.country}`,
      score: airport.airportistScore,
    };
  }

  const guide = await getAirportContent(slug);

  if (!guide) {
    return null;
  }

  const { iata, name, city, country } = guide.frontmatter;
  return {
    iata,
    name,
    location: `${city}, ${country}`,
  };
}

export default async function Image({ params }: OgImageProps) {
  const { slug } = await params;
  const airport = await getOgAirport(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0a0a0a 0%, #1c1c24 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 36, fontWeight: 600 }}>{SITE_NAME}</div>
          {airport?.score !== undefined ? (
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                padding: "16px 28px",
                borderRadius: 24,
                background: "rgba(250, 250, 250, 0.1)",
              }}
            >
              <span style={{ fontSize: 56, fontWeight: 700 }}>
                {airport.score.toFixed(1)}
              </span>
              <span style={{ fontSize: 28, color: "#a1a1aa" }}>/ 10</span>
            </div>
          ) : (
            <div
              style={{
                padding: "12px 24px",
                borderRadius: 999,
                border: "2px solid rgba(250, 250, 250, 0.25)",
                fontSize: 24,
                color: "#d4d4d8",
              }}
            >
              Editorial guide
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              fontFamily: "monospace",
            }}
          >
            {airport?.iata ?? "???"}
          </div>
          <div style={{ fontSize: 52, fontWeight: 600, lineHeight: 1.15, maxWidth: 1000 }}>
            {airport?.name ?? "Airport guide"}
          </div>
          <div style={{ fontSize: 32, color: "#a1a1aa" }}>
            {airport?.location ?? "Traveler tips, lounges, and transport"}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
