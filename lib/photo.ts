/**
 * The view type the shared photo strip and lightbox render.
 *
 * Two very different sources feed those components: rights-cleared photos from
 * Wikimedia Commons / press rooms (`AirportImage`, where credit + license +
 * source are mandatory) and photos travelers attach to their own reviews
 * (`ReviewImage`, which have nothing to attribute). Rather than loosening
 * `AirportImage` — its non-optional attribution fields are the only thing
 * forcing every CC-sourced row to carry credit — attribution lives here as an
 * optional sub-object, and each source gets a mapper. `attribution: undefined`
 * is then only reachable for photos that genuinely have none.
 */
import type { AirportImage } from "./airport-images";
import type { ReviewImage } from "./review-schema";

export interface PhotoAttribution {
  credit: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
}

export interface Photo {
  url: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
  /** Present only for third-party photos whose licence requires credit. */
  attribution?: PhotoAttribution;
}

export function airportImageToPhoto(image: AirportImage): Photo {
  return {
    url: image.url,
    alt: image.alt,
    caption: image.caption,
    width: image.width,
    height: image.height,
    attribution: {
      credit: image.credit,
      license: image.license,
      licenseUrl: image.licenseUrl,
      sourceUrl: image.sourceUrl,
    },
  };
}

export function reviewImageToPhoto(image: ReviewImage): Photo {
  return {
    url: image.url,
    alt: image.alt,
    caption: image.caption,
    width: image.width,
    height: image.height,
  };
}
