import { ImageResponse } from "next/og";
import { getAirportContent, getAirportImages } from "@/lib/airport-content";
import { getOgFonts } from "@/lib/og-fonts";
import { fetchOgPhotoDataUrl } from "@/lib/og-photo";
import {
  BrandLockup,
  EditorialBadge,
  MapPinIcon,
  OG_ACCENT_BLUE,
  OG_BG_GRADIENT,
  ScoreBadge,
} from "@/lib/og-icons";
import { getAirportBySlug } from "@/lib/airport-utils";

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
  const [fonts, images] = await Promise.all([
    getOgFonts(),
    airport ? getAirportImages(airport.iata) : Promise.resolve([]),
  ]);
  const photoDataUrl = images[0]?.url
    ? await fetchOgPhotoDataUrl(images[0].url, size.width, size.height)
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: photoDataUrl ? "#0a0a0a" : OG_BG_GRADIENT,
          color: "#fafafa",
          fontFamily: "Geist",
          position: "relative",
        }}
      >
        {photoDataUrl ? (
          <div style={{ display: "flex", position: "absolute", inset: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoDataUrl}
              alt=""
              width={size.width}
              height={size.height}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                display: "flex",
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(105deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.72) 42%, rgba(10,10,10,0.35) 100%)",
              }}
            />
            <div
              style={{
                display: "flex",
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to top, rgba(10,10,10,0.85) 0%, transparent 55%)",
              }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          <BrandLockup scale={0.9} />
          {airport?.score !== undefined ? (
            <ScoreBadge score={airport.score} scale={0.85} />
          ) : (
            <EditorialBadge scale={0.85} />
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            position: "relative",
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontSize: 88,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              fontFamily: "Geist Mono",
              color: OG_ACCENT_BLUE,
            }}
          >
            {airport?.iata ?? "???"}
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
            }}
          >
            {airport?.name ?? "Airport guide"}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 28,
              color: "#d4d4d8",
            }}
          >
            <MapPinIcon size={26} color={OG_ACCENT_BLUE} />
            <span>{airport?.location ?? "Traveler tips, lounges, and transport"}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}