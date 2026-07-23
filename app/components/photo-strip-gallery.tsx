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
      <div className="mt-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-0.5 pb-3 [scrollbar-width:thin]">
        {images.map((image, index) => (
          <figure key={image.url} className="w-[78vw] max-w-[380px] shrink-0 snap-start sm:w-[340px]">
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              className="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-3xl bg-muted shadow-sm ring-1 ring-black/5 transition-shadow duration-300 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label={`Open larger preview: ${image.alt}`}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                loading="lazy"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                sizes="(max-width: 640px) 78vw, 340px"
                className="object-cover transition-transform duration-500 ease-[var(--ease-out)] pointer-fine:group-hover:scale-105 motion-reduce:transition-none motion-reduce:pointer-fine:group-hover:scale-100"
              />
              <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              {image.caption ? (
                <span className="absolute inset-x-3 bottom-3 line-clamp-2 text-left text-sm leading-snug font-medium text-white drop-shadow-sm">
                  {image.caption}
                </span>
              ) : null}
              <span className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/45 text-white opacity-90 backdrop-blur-sm transition-all duration-200 group-hover:scale-105 group-hover:bg-black/65 group-hover:opacity-100">
                <Expand className="size-3.5" aria-hidden="true" />
              </span>
            </button>
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
