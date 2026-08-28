"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { AirportUserReview } from "@/lib/review-schema";

const AirportReviews = dynamic(
  () => import("./airport-reviews").then((mod) => ({ default: mod.AirportReviews })),
  {
    loading: () => <AirportReviewsFallback />,
  },
);

function AirportReviewsFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading traveler reviews">
      {[0, 1].map((item) => (
        <div key={item} className="rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-48" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Keep react-hook-form / review-form JS off the airport page until the Reviews
 * tab is actually opened. Radix leaves inactive panels mounted but hidden;
 * we wait for `data-state="active"` before pulling the chunk.
 */
export function AirportReviewsLazy({
  iata,
  seedReviews,
  showHeading,
  className,
}: {
  iata: string;
  seedReviews?: AirportUserReview[];
  showHeading?: boolean;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const panel = host?.closest<HTMLElement>("[data-slot='tabs-content']");
    if (!panel) {
      setActive(true);
      return;
    }

    const sync = () => {
      if (panel.getAttribute("data-state") === "active") {
        setActive(true);
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(panel, { attributes: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef}>
      {active ? (
        <AirportReviews
          iata={iata}
          seedReviews={seedReviews}
          showHeading={showHeading}
          className={className}
        />
      ) : null}
    </div>
  );
}
