import { PhotoStrip } from "@/app/components/photo-strip";
import { getAirportImages } from "@/lib/airport-content";

/**
 * Photo strip for an airport, fed by the image sync pipeline (Wikimedia
 * Commons → Vercel Blob). Renders nothing while an airport has no photos
 * yet — the pipeline backfills airports one by one via cron.
 */
export async function AirportPhotoGallery({ iata }: { iata: string }) {
  const images = await getAirportImages(iata);
  return <PhotoStrip images={images} ariaLabel={`${iata} photos`} />;
}
