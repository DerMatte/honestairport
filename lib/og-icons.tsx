/**
 * Shared visual building blocks for `next/og` ImageResponse routes.
 * Icon paths are copied from lucide-react (plane, star, map-pin) since
 * ImageResponse/Satori needs plain SVG elements, not the icon components.
 */
import { SITE_NAME } from "@/lib/site";

export const OG_BG_GRADIENT = "linear-gradient(135deg, #0a0a0a 0%, #2d2d3a 100%)";
/** Matches the site header's `bg-primary` logo square (light-mode --primary). */
export const OG_BRAND_BLUE = "#0d489d";
/** Matches dark-mode --primary; used for accent text/icons on dark OG canvases. */
export const OG_ACCENT_BLUE = "#76afee";

export function PlaneIcon({
  size = 24,
  color = "#fafafa",
  rotate = 0,
}: {
  size?: number;
  color?: string;
  rotate?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "flex", transform: `rotate(${rotate}deg)` }}
    >
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );
}

export function StarIcon({ size = 24, color = "#fafafa" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" style={{ display: "flex" }}>
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  );
}

export function MapPinIcon({ size = 24, color = "#fafafa" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "flex" }}
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** The header's logo lockup (blue square + plane mark + wordmark), reused for OG canvases. */
export function BrandLockup({ scale = 1 }: { scale?: number }) {
  const boxSize = 56 * scale;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 * scale }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: boxSize,
          height: boxSize,
          borderRadius: 16 * scale,
          background: OG_BRAND_BLUE,
        }}
      >
        <PlaneIcon size={28 * scale} color="#fafafa" rotate={-45} />
      </div>
      <span
        style={{
          fontSize: 34 * scale,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "#fafafa",
          fontFamily: "Geist",
        }}
      >
        {SITE_NAME}
      </span>
    </div>
  );
}

export function ScoreBadge({ score, scale = 1 }: { score: number; scale?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16 * scale,
        padding: `${14 * scale}px ${22 * scale}px`,
        borderRadius: 20 * scale,
        background: "rgba(250, 250, 250, 0.12)",
        border: "1px solid rgba(250, 250, 250, 0.18)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 52 * scale,
          height: 52 * scale,
          borderRadius: 16 * scale,
          background: OG_BRAND_BLUE,
        }}
      >
        <StarIcon size={24 * scale} color="#fafafa" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 * scale }}>
        <span
          style={{
            fontSize: 14 * scale,
            color: "#a1a1aa",
            fontFamily: "Geist",
            fontWeight: 600,
          }}
        >
          Airportist Score
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 * scale }}>
          <span
            style={{
              fontSize: 40 * scale,
              fontWeight: 700,
              color: "#fafafa",
              fontFamily: "Geist Mono",
            }}
          >
            {score.toFixed(1)}
          </span>
          <span style={{ fontSize: 20 * scale, color: "#a1a1aa", fontFamily: "Geist" }}>/ 10</span>
        </div>
      </div>
    </div>
  );
}

export function EditorialBadge({ scale = 1 }: { scale?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10 * scale,
        padding: `${12 * scale}px ${20 * scale}px`,
        borderRadius: 999,
        border: "2px solid rgba(250, 250, 250, 0.25)",
        fontSize: 22 * scale,
        color: "#d4d4d8",
        fontFamily: "Geist",
        fontWeight: 600,
      }}
    >
      <BookIcon size={20 * scale} color={OG_ACCENT_BLUE} />
      Editorial guide
    </div>
  );
}

function BookIcon({ size = 24, color = "#fafafa" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "flex" }}
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}
