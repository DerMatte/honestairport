import type { ReactNode } from "react";

interface AirportLayoutProps {
  children: ReactNode;
}

/** Airport pages stay public. Paid tabs gate inside `AirportDetailTabs`. */
export default function AirportLayout({ children }: AirportLayoutProps) {
  return children;
}
