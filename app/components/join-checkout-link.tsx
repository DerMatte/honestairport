"use client";

import type { ComponentProps, MouseEvent } from "react";
import {
  appendAttributionToCheckoutUrl,
  attributionForCheckout,
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  parseAttributionCookie,
} from "@/lib/attribution";
import { createMetaEventId, isMetaPixelEnabled } from "@/lib/meta-tracking";
import { fireInitiateCheckout } from "@/app/components/meta-pixel";

function readDocumentCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return decodeURIComponent(trimmed.slice(name.length + 1));
    }
  }
  return null;
}

function checkoutHrefWithAttribution(href: string, eventId: string): string {
  const first = parseAttributionCookie(readDocumentCookie(FIRST_TOUCH_COOKIE));
  const last = parseAttributionCookie(readDocumentCookie(LAST_TOUCH_COOKIE));
  return appendAttributionToCheckoutUrl(href, {
    ...attributionForCheckout(first, last),
    event_id: eventId,
  });
}

/**
 * Join / Subscribe CTA that hops to hosted Whop checkout.
 * Fires Meta InitiateCheckout (when the Pixel env is set) and appends
 * first/last-touch UTM + click ids plus the Pixel event_id.
 */
export function JoinCheckoutLink({
  href,
  children,
  onClick,
  ...props
}: ComponentProps<"a"> & { href: string }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const eventId = createMetaEventId("ic");
    if (isMetaPixelEnabled()) {
      fireInitiateCheckout(eventId);
    }
    const next = checkoutHrefWithAttribution(href, eventId);
    event.preventDefault();
    window.location.assign(next);
  }

  return (
    <a {...props} href={href} rel={props.rel ?? "noopener noreferrer"} onClick={handleClick}>
      {children}
    </a>
  );
}
