"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AirportLiveStatus } from "@/app/components/airport-live-status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AirportLiveData } from "@/lib/airport-live-data";

interface AirportLiveStatusLoaderProps {
  iata: string;
  className?: string;
}

interface AirportLiveStatusProviderProps {
  iata: string;
  children: ReactNode;
}

type LiveStatusState =
  | { status: "loading"; data?: never; error?: never }
  | { status: "ready"; data: AirportLiveData; error?: never }
  | { status: "error"; data?: never; error: string };

interface LiveStatusController {
  state: LiveStatusState;
  reload: () => void;
}

const AirportLiveStatusContext = createContext<LiveStatusController | null>(null);

function AirportLiveStatusSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mb-8 grid gap-4 md:grid-cols-2", className)}>
      {[0, 1].map((item) => (
        <div key={item} className="rounded-2xl border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function useAirportLiveStatus(iata: string): LiveStatusController {
  const [state, setState] = useState<LiveStatusState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLiveStatus() {
      setState({ status: "loading" });

      try {
        const response = await fetch(`/api/airports/${encodeURIComponent(iata)}/live`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Live status request failed (${response.status})`);
        }

        const data = (await response.json()) as AirportLiveData;
        setState({ status: "ready", data });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load live airport status.",
        });
      }
    }

    loadLiveStatus();

    return () => {
      controller.abort();
    };
  }, [iata, reloadKey]);

  return {
    state,
    reload: () => setReloadKey((key) => key + 1),
  };
}

function AirportLiveStatusRenderer({
  className,
  controller,
}: {
  className?: string;
  controller: LiveStatusController;
}) {
  const { state, reload } = controller;

  if (state.status === "loading") {
    return <AirportLiveStatusSkeleton className={className} />;
  }

  if (state.status === "error") {
    return (
      <div className={cn("mb-8 rounded-2xl border bg-card p-5", className)}>
        <div className="flex items-center gap-2 font-semibold text-sm tracking-wide">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Live airport status unavailable
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{state.error}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={reload}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }

  return <AirportLiveStatus data={state.data} className={className} />;
}

export function AirportLiveStatusProvider({
  iata,
  children,
}: AirportLiveStatusProviderProps) {
  const controller = useAirportLiveStatus(iata);

  return (
    <AirportLiveStatusContext.Provider value={controller}>
      {children}
    </AirportLiveStatusContext.Provider>
  );
}

export function AirportLiveStatusPanel({
  className,
}: Pick<AirportLiveStatusLoaderProps, "className">) {
  const controller = useContext(AirportLiveStatusContext);

  if (!controller) {
    throw new Error("AirportLiveStatusPanel must be used inside AirportLiveStatusProvider.");
  }

  return <AirportLiveStatusRenderer className={className} controller={controller} />;
}

export function AirportLiveStatusLoader({
  iata,
  className,
}: AirportLiveStatusLoaderProps) {
  const controller = useAirportLiveStatus(iata);

  return <AirportLiveStatusRenderer className={className} controller={controller} />;
}
