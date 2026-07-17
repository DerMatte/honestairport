"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronDown, Map as MapIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Airport } from "@/lib/types";

const AirportInteractiveMap = dynamic(
  () => import("./airport-interactive-map"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-none" />,
  },
);

interface AirportMapSectionProps {
  airports: Airport[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AirportMapSection({
  airports,
  open,
  onOpenChange,
}: AirportMapSectionProps) {
  // Latches on first expand (whether via the trigger or the hero map): the map
  // chunk only loads once opened, then stays mounted through collapse/expand
  // so the map isn't re-initialized.
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) setHasOpened(true);

  return (
    <section id="airport-map" className="mx-auto max-w-7xl px-6 py-14">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm">
          <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between gap-6 p-6 text-left sm:p-8">
            <div>
              <p className="text-sm font-medium tracking-wide text-primary uppercase">
                Explore the map
              </p>
              <h2 className="mt-1 text-2xl tracking-tight sm:text-3xl">
                All scored airports on an interactive map
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Pan and zoom the world map — pins are colored by live disruption
                status and open each airport&apos;s full review.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-muted-foreground">
              <MapIcon aria-hidden="true" className="hidden size-5 sm:block" />
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-5 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent forceMount hidden={!open}>
            <div className="h-[420px] w-full border-t border-border/60 sm:h-[520px]">
              {hasOpened ? <AirportInteractiveMap airports={airports} /> : null}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </section>
  );
}
