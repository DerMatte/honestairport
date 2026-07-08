/**
 * Google Fonts loader for `next/og` ImageResponse routes.
 * Satori needs raw font binaries; next/font CSS variables don't apply here.
 */

// Older UA makes Google Fonts return TrueType URLs that Satori can parse.
const GOOGLE_FONTS_USER_AGENT =
  "Mozilla/5.0 (BB10; Touch) AppleWebKit/537.10+ (KHTML, like Gecko) Version/10.0.9.2372 Mobile Safari/537.10+";

async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const familyParam = family.replace(/ /g, "+");
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}`,
    { headers: { "User-Agent": GOOGLE_FONTS_USER_AGENT } },
  ).then((res) => res.text());

  // Satori only accepts TrueType/OpenType binaries — not woff2.
  const match =
    css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/) ??
    css.match(/src: url\((.+?)\) format\('woff2'\)/);
  if (!match) {
    throw new Error(`Failed to load font: ${family} ${weight}`);
  }

  return fetch(match[1]).then((res) => res.arrayBuffer());
}

export async function getOgFonts() {
  const [geistSemiBold, geistBold, geistMonoBold] = await Promise.all([
    loadGoogleFont("Geist", 600),
    loadGoogleFont("Geist", 700),
    loadGoogleFont("Geist Mono", 700),
  ]);

  return [
    { name: "Geist", data: geistSemiBold, weight: 600 as const, style: "normal" as const },
    { name: "Geist", data: geistBold, weight: 700 as const, style: "normal" as const },
    { name: "Geist Mono", data: geistMonoBold, weight: 700 as const, style: "normal" as const },
  ];
}