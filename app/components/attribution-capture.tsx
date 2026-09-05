"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  attributionCookieHeader,
  FIRST_TOUCH_COOKIE,
  LAST_TOUCH_COOKIE,
  nextAttributionTouches,
  parseAttributionCookie,
  parseAttributionFromSearchParams,
} from "@/lib/attribution";

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

/**
 * Persist first-touch (immutable) and last-touch UTM / click ids.
 * Always on — does not require the Meta Pixel env.
 */
export function AttributionCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const incoming = parseAttributionFromSearchParams(searchParams);
    const writes = nextAttributionTouches(
      incoming,
      parseAttributionCookie(readDocumentCookie(FIRST_TOUCH_COOKIE)),
      parseAttributionCookie(readDocumentCookie(LAST_TOUCH_COOKIE)),
    );
    for (const write of writes) {
      document.cookie = attributionCookieHeader(
        write.name,
        write.value,
        write.maxAgeSec,
      );
    }
  }, [searchParams]);

  return null;
}
