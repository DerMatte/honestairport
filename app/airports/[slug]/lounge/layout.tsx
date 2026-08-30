import type { ReactNode } from "react";

/**
 * Lounge HTML stays gated on `[loungeSlug]/layout.tsx` so the teaser can
 * resolve the lounge name. This segment only groups the route.
 */
export default function LoungeSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
