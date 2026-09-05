"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import {
  getPublicGa4MeasurementId,
  isGa4BrowserEnabled,
  MEMBER_CONTENT_NAME,
  MEMBER_PLAN_ID,
  MEMBER_SUBSCRIBE_CURRENCY,
  MEMBER_SUBSCRIBE_VALUE,
  MEMBERS_EVENT_SOURCE_PATH,
} from "@/lib/meta-tracking";

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

const VIEW_ITEM_STORAGE_KEY = "ha_ga4_view_item";

function gtag(...args: unknown[]) {
  if (typeof window.gtag !== "function") {
    return;
  }
  window.gtag(...args);
}

export function fireGa4BeginCheckout(): void {
  if (!isGa4BrowserEnabled()) {
    return;
  }
  gtag("event", "begin_checkout", {
    currency: MEMBER_SUBSCRIBE_CURRENCY,
    value: MEMBER_SUBSCRIBE_VALUE,
    items: [
      {
        item_id: MEMBER_PLAN_ID,
        item_name: MEMBER_CONTENT_NAME,
        price: MEMBER_SUBSCRIBE_VALUE,
        quantity: 1,
      },
    ],
  });
}

export function Ga4() {
  const measurementId = getPublicGa4MeasurementId();
  const pathname = usePathname();
  const lastPageView = useRef<string | null>(null);

  useEffect(() => {
    if (!measurementId) {
      return;
    }
    if (lastPageView.current === pathname) {
      return;
    }
    lastPageView.current = pathname;
    gtag("event", "page_view", { page_path: pathname });

    if (pathname !== MEMBERS_EVENT_SOURCE_PATH) {
      return;
    }
    try {
      if (sessionStorage.getItem(VIEW_ITEM_STORAGE_KEY)) {
        return;
      }
      sessionStorage.setItem(VIEW_ITEM_STORAGE_KEY, "1");
    } catch {
      // private mode — still fire once this mount
    }
    gtag("event", "view_item", {
      currency: MEMBER_SUBSCRIBE_CURRENCY,
      value: MEMBER_SUBSCRIBE_VALUE,
      items: [
        {
          item_id: MEMBER_PLAN_ID,
          item_name: MEMBER_CONTENT_NAME,
          price: MEMBER_SUBSCRIBE_VALUE,
          quantity: 1,
        },
      ],
    });
  }, [pathname, measurementId]);

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}', { send_page_view: false });
`}
      </Script>
    </>
  );
}
