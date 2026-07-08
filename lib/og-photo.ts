import sharp from "sharp";

/** Decode remote airport photos (stored as WebP on Vercel Blob) for Satori. */
export async function fetchOgPhotoDataUrl(
  url: string,
  width = 1200,
  height = 630,
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const input = Buffer.from(await response.arrayBuffer());
    const png = await sharp(input)
      .resize(width, height, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();

    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}