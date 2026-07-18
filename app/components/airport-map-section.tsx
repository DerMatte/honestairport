"use client";

import { useState } from "react";
import { ChevronDown, Map as MapIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Airport } from "@/lib/types";
import { LazyAirportMap } from "./airport-map-lazy";

interface AirportMapSectionProps {
  airports: Airport[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Mobile-only: a slim full-width toggle bar revealing an edge-to-edge map.
// On lg+ screens the map lives in the resizable side panel instead.
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
    <section id="airport-map" className="scroll-mt-14 lg:hidden">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border/60 px-6 py-3 text-sm font-medium">
          <span className="flex items-center gap-2">
            <MapIcon aria-hidden="true" className="size-4 text-muted-foreground" />
            Map
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent forceMount hidden={!open}>
          <div className="h-[65vh] w-full border-b border-border/60">
            {hasOpened ? <LazyAirportMap airports={airports} /> : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
