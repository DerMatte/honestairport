"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AirportImage } from "@/lib/airport-content";

const BLUR_DATA_URL =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 20'%3E%3Cfilter id='b'%3E%3CfeGaussianBlur stdDeviation='3'/%3E%3C/filter%3E%3Crect width='32' height='20' fill='%23dce3ea'/%3E%3Cpath d='M0 16 9 8l6 5 5-4 12 8v3H0z' fill='%23b8c5d1' filter='url(%23b)'/%3E%3C/svg%3E";

export default function PhotoLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: AirportImage[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const image = images[index];
  const hasMultiple = images.length > 1;

  function showPrevious() {
    setIndex((current) => (current - 1 + images.length) % images.length);
  }

  function showNext() {
    setIndex((current) => (current + 1) % images.length);
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] max-w-6xl gap-3 overflow-hidden bg-popover p-3 [&_[data-slot=dialog-close]]:bg-background/90 [&_[data-slot=dialog-close]]:shadow-sm sm:w-[calc(100%-3rem)] sm:p-4"
        onKeyDown={(event) => {
          if (!hasMultiple) return;
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            showPrevious();
          } else if (event.key === "ArrowRight") {
            event.preventDefault();
            showNext();
          }
        }}
      >
        <DialogTitle className="sr-only">Photo preview</DialogTitle>
        <DialogDescription className="sr-only">
          Photo {index + 1} of {images.length}. Use the arrow keys or controls to move between photos.
        </DialogDescription>

        <div className="relative h-[min(72dvh,760px)] min-h-64 overflow-hidden rounded-lg bg-black/95">
          <Image
            key={image.url}
            src={image.url}
            alt={image.alt}
            fill
            loading="lazy"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            sizes="(max-width: 768px) 100vw, 90vw"
            className="object-contain"
          />
          {hasMultiple ? (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={showPrevious}
                className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-background/90 shadow-lg sm:left-4"
                aria-label="Previous photo"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={showNext}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-background/90 shadow-lg sm:right-4"
                aria-label="Next photo"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </>
          ) : null}
          <span className="absolute right-3 bottom-3 rounded-full bg-black/65 px-2.5 py-1 font-mono text-xs text-white">
            {index + 1} / {images.length}
          </span>
        </div>

        <div className="min-w-0 px-1 pr-10 text-sm">
          {image.caption ? <p className="truncate font-medium">{image.caption}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">Credit: {image.credit}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
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
              View original source
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
