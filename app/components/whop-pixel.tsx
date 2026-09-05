"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import {
  WHOP_BIZ_ID_ENV,
  WHOP_PIXEL_INIT_ID,
  WHOP_PIXEL_SCRIPT_ID,
  WHOP_PIXEL_SCRIPT_URL,
  getWhopPixelBizId,
  shouldTrackWhopSpaPage,
  trackWhopPageView,
  whopPixelInitScript,
} from "@/lib/whop-pixel";

function readPublicWhopBizId(): string | null {
  return getWhopPixelBizId({
    [WHOP_BIZ_ID_ENV]: process.env.NEXT_PUBLIC_WHOP_BIZ_ID,
  });
}

function WhopPixelScripts({ bizId }: { bizId: string }) {
  return (
    <>
      <Script
        id={WHOP_PIXEL_SCRIPT_ID}
        src={WHOP_PIXEL_SCRIPT_URL}
        strategy="afterInteractive"
      />
      <Script id={WHOP_PIXEL_INIT_ID} strategy="afterInteractive">
        {whopPixelInitScript(bizId)}
      </Script>
    </>
  );
}

export function WhopPixel() {
  const bizId = readPublicWhopBizId();
  const pathname = usePathname();
  const lastPageView = useRef<string | null>(null);

  useEffect(() => {
    if (!bizId) {
      return;
    }
    if (shouldTrackWhopSpaPage(lastPageView.current, pathname)) {
      trackWhopPageView();
    }
    lastPageView.current = pathname;
  }, [pathname, bizId]);

  if (!bizId) {
    return null;
  }

  return <WhopPixelScripts bizId={bizId} />;
}
