import { ImageResponse } from "next/og";
import { getOgFonts } from "@/lib/og-fonts";
import { BrandLockup, OG_ACCENT_BLUE, OG_BG_GRADIENT, OG_BRAND_BLUE, PlaneIcon } from "@/lib/og-icons";

export const alt = "HonestAirport - Airportist Scores and Traveler Tips";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const HIGHLIGHTS = ["Airportist Scores", "Lounges", "Disruption signals"];

export default async function Image() {
  const fonts = await getOgFonts();

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
          background: OG_BG_GRADIENT,
          color: "#fafafa",
          fontFamily: "Geist",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -80,
            right: -40,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${OG_BRAND_BLUE}55 0%, transparent 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 80,
            opacity: 0.07,
            display: "flex",
          }}
        >
          <PlaneIcon size={280} color="#fafafa" rotate={-35} />
        </div>

        <BrandLockup />

        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 920 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Honest airport guides
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: 32,
              color: "#a1a1aa",
              lineHeight: 1.45,
              maxWidth: 820,
            }}
          >
            <span>Practical tips, security tactics, and </span>
            <span style={{ color: OG_ACCENT_BLUE }}>Airportist Scores </span>
            <span>for 100+ major airports worldwide.</span>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {HIGHLIGHTS.map((label) => (
              <div
                key={label}
                style={{
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: "rgba(250, 250, 250, 0.08)",
                  border: "1px solid rgba(250, 250, 250, 0.14)",
                  fontSize: 22,
                  fontWeight: 600,
                  color: "#e4e4e7",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}