import Image from "next/image";
import { Camera } from "lucide-react";
import type { AirportImage } from "@/lib/airport-content";

/**
 * Horizontal photo strip fed by the Commons → Vercel Blob image pipelines.
 * Renders nothing without images. Credit + license are shown per image
 * (CC attribution requirement).
 */
export function PhotoStrip({
  images,
  ariaLabel,
}: {
  images: AirportImage[];
  ariaLabel: string;
}) {
  if (images.length === 0) {
    return null;
  }

  return (
    <section aria-label={ariaLabel}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Camera className="size-4" aria-hidden="true" />
        <span>
          {images.length} photo{images.length === 1 ? "" : "s"} · Wikimedia Commons
        </span>
      </div>

      <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-2">
        {images.map((image) => (
          <figure
            key={image.url}
            className="group relative h-56 shrink-0 snap-start overflow-hidden rounded-2xl border bg-muted/30 sm:h-64"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            <Image
              src={image.url}
              alt={image.alt}
              fill
              sizes="(max-width: 640px) 85vw, 460px"
              className="object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-xs text-white">
              {image.caption ? <span className="block">{image.caption}</span> : null}
              <a
                href={image.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 underline-offset-2 hover:underline"
              >
                {image.credit} · {image.license}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
