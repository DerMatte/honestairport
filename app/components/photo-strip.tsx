import { Camera } from "lucide-react";
import { PhotoStripGallery } from "@/app/components/photo-strip-gallery";
import type { AirportImage } from "@/lib/airport-content";

/**
 * Server wrapper for the rights-cleared airport photo gallery. The interactive
 * thumbnails and on-demand lightbox stay behind a small client boundary.
 */
export function PhotoStrip({
  images,
  ariaLabel,
}: {
  images: AirportImage[];
  ariaLabel: string;
}) {
  if (images.length === 0) return null;

  return (
    <section aria-label={ariaLabel}>
      <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
        <Camera className="size-4" aria-hidden="true" />
        <span>
          {images.length} photo{images.length === 1 ? "" : "s"}
        </span>
      </div>
      <PhotoStripGallery images={images} />
    </section>
  );
}
