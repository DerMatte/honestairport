"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { reviewImageToPhoto } from "@/lib/photo";
import type { ReviewImage } from "@/lib/review-schema";

const PhotoLightbox = dynamic(() => import("./photo-lightbox"), {
  loading: () => null,
});

/**
 * Photos attached to a review: small squares inline in the review card, rather
 * than the wide snap-scroll strip used for an airport's own gallery. The
 * lightbox is shared with that gallery and loads on first open.
 */
export function ReviewPhotoThumbs({ images }: { images: ReviewImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        {images.map((image, index) => (
          <button
            key={image.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="relative size-20 cursor-zoom-in overflow-hidden rounded-xl bg-muted ring-1 ring-black/5 transition-transform duration-[var(--duration-press)] ease-[var(--ease-out)] active:scale-[0.97] pointer-fine:hover:scale-[1.03] motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:pointer-fine:hover:scale-100 focus-visible:outline-2 focus-visible:outline-ring sm:size-24"
            aria-label={`Open photo ${index + 1} of ${images.length}: ${image.alt}`}
          >
            <Image
              src={image.url}
              alt={image.alt}
              width={96}
              height={96}
              loading="lazy"
              sizes="96px"
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>

      {activeIndex !== null ? (
        <PhotoLightbox
          images={images.map(reviewImageToPhoto)}
          initialIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
        />
      ) : null}
    </>
  );
}
