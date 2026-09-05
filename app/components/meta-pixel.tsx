"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import {
  createMetaEventId,
  getPublicMetaPixelId,
  isMetaPixelEnabled,
  memberCustomData,
  MEMBERS_EVENT_SOURCE_PATH,
} from "@/lib/meta-tracking";

const VIEW_CONTENT_STORAGE_KEY = "ha_meta_vc_event_id";

type FbqFn = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

function trackMeta(
  eventName: "PageView" | "ViewContent" | "InitiateCheckout" | "Subscribe",
  customData?: Record<string, string | number>,
  eventId?: string,
) {
  const fbq = window.fbq;
  if (typeof fbq !== "function") {
    return;
  }
  if (eventId) {
    fbq("track", eventName, customData ?? {}, { eventID: eventId });
    return;
  }
  fbq("track", eventName, customData ?? {});
}

function readSessionEventId(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionEventId(key: string, eventId: string): void {
  try {
    sessionStorage.setItem(key, eventId);
  } catch {
    // private mode / quota
  }
}

export function persistInitiateCheckoutEventId(eventId: string): void {
  writeSessionEventId("ha_meta_ic_event_id", eventId);
}

export function readInitiateCheckoutEventId(): string | null {
  return readSessionEventId("ha_meta_ic_event_id");
}

export function fireInitiateCheckout(eventId: string): void {
  if (!isMetaPixelEnabled()) {
    return;
  }
  persistInitiateCheckoutEventId(eventId);
  trackMeta("InitiateCheckout", memberCustomData(), eventId);
}

export function MetaPixel() {
  const pixelId = getPublicMetaPixelId();
  const pathname = usePathname();
  const lastPageView = useRef<string | null>(null);

  useEffect(() => {
    if (!pixelId) {
      return;
    }
    if (lastPageView.current === pathname) {
      return;
    }
    lastPageView.current = pathname;
    trackMeta("PageView");

    if (pathname !== MEMBERS_EVENT_SOURCE_PATH) {
      return;
    }
    const existing = readSessionEventId(VIEW_CONTENT_STORAGE_KEY);
    const eventId = existing ?? createMetaEventId("vc");
    if (!existing) {
      writeSessionEventId(VIEW_CONTENT_STORAGE_KEY, eventId);
    }
    trackMeta("ViewContent", memberCustomData(), eventId);
  }, [pathname, pixelId]);

  if (!pixelId) {
    return null;
  }

  return (
    <Script
      id="meta-pixel"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');
`,
      }}
    />
  );
}
