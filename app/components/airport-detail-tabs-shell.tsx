"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AirportLiveStatusProvider,
} from "@/app/components/airport-live-status-loader";
import { Tabs } from "@/components/ui/tabs";

interface AirportDetailTabsShellProps {
  iata: string;
  children: ReactNode;
}

interface ReviewsFetchContextValue {
  enabled: boolean;
}

const ReviewsFetchContext = createContext<ReviewsFetchContextValue>({
  enabled: false,
});

export function useReviewsFetchEnabled(): boolean {
  return useContext(ReviewsFetchContext).enabled;
}

export function AirportDetailTabsShell({
  iata,
  children,
}: AirportDetailTabsShellProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const liveEnabled = activeTab === "overview" || activeTab === "disruptions";
  const reviewsEnabled = activeTab === "reviews";
  const reviewsContext = useMemo(
    () => ({ enabled: reviewsEnabled }),
    [reviewsEnabled],
  );

  return (
    <AirportLiveStatusProvider iata={iata} enabled={liveEnabled}>
      <ReviewsFetchContext.Provider value={reviewsContext}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
          {children}
        </Tabs>
      </ReviewsFetchContext.Provider>
    </AirportLiveStatusProvider>
  );
}
