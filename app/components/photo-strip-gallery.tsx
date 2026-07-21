"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Expand } from "lucide-react";
import type { AirportImage } from "@/lib/airport-content";

const BLUR_DATA_URL =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 20'%3E%3Cfilter id='b'%3E%3CfeGaussianBlur stdDeviation='3'/%3E%3C/filter%3E%3Crect width='32' height='20' fill='%23dce3ea'/%3E%3Cpath d='M0 16 9 8l6 5 5-4 12 8v3H0z' fill='%23b8c5d1' filter='url(%23b)'/%3E%3C/svg%3E";

const PhotoLightbox = dynamic(() => import("./photo-lightbox"), {
  loading: () => null,
});

export function PhotoStripGallery({ images }: { images: AirportImage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <>
      <div className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
        {images.map((image, index) => (
          <figure
            key={image.url}
            className="w-[82vw] max-w-[440px] shrink-0 snap-start overflow-hidden rounded-2xl border bg-card shadow-sm sm:w-[420px]"
          >
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group relative block w-full cursor-zoom-in overflow-hidden bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              style={{ aspectRatio: `${image.width} / ${image.height}` }}
              aria-label={`Open larger preview: ${image.alt}`}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                loading="lazy"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                sizes="(max-width: 640px) 82vw, 420px"
                className="object-cover transition-transform duration-300 ease-[var(--ease-out)] pointer-fine:group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:pointer-fine:group-hover:scale-100"
              />
              <span className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/65 text-white opacity-90 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                <Expand className="size-4" aria-hidden="true" />
              </span>
            </button>
            <figcaption className="space-y-1 border-t px-3 py-2.5 text-xs leading-5">
              {image.caption ? (
                <span className="line-clamp-2 block text-foreground">{image.caption}</span>
              ) : null}
              <span className="block text-muted-foreground">Credit: {image.credit}</span>
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {image.licenseUrl ? (
                  <a
                    href={image.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {image.license}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{image.license}</span>
                )}
                <a
                  href={image.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  View source
                </a>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      {activeIndex !== null ? (
        <PhotoLightbox
          images={images}
          initialIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
        />
      ) : null}
    </>
  );
}
