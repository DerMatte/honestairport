import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "HonestAirport - Airportist Scores and Traveler Tips";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 28,
          padding: 96,
          background: "linear-gradient(135deg, #0a0a0a 0%, #1c1c24 100%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 38, color: "#a1a1aa", maxWidth: 900, lineHeight: 1.4 }}>
          Honest airport guides: Airportist Scores, security tactics, lounges, and
          disruption signals for 100+ major airports.
        </div>
      </div>
    ),
    size,
  );
}
