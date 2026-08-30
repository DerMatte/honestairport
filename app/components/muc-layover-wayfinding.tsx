"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ExternalLink, Info, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isMucLayoversPreviewEnabled,
  isMucZoneId,
  lookupMucLayover,
  mucLayoverMinutesLabel,
  MUC_CONNECTING_FLIGHTS_URL,
  MUC_ZONE_GROUPS,
  type MucPathType,
  type MucZoneId,
  type MucLayoverResult,
} from "@/lib/muc-layovers";

export const MUC_LAYOVERS_ANCHOR = "muc-layovers";

const DEFAULT_FROM: MucZoneId = "t2";
const DEFAULT_TO: MucZoneId = "t2-sat";

function pathTypeBadgeClass(pathType: MucPathType): string {
  switch (pathType) {
    case "same_zone":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
    case "reclear":
      return "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "different_terminal":
      return "border-blue-500/20 bg-blue-500/10 text-blue-800 dark:text-blue-300";
    default: {
      const exhaustiveCheck: never = pathType;
      return exhaustiveCheck;
    }
  }
}

export function MucLayoverResultPanel({
  result,
}: {
  result: MucLayoverResult;
}) {
  const unpublished = result.minutes === null;

  return (
    <div
      className="space-y-3 rounded-xl border bg-muted/30 p-3"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={`rounded-full ${pathTypeBadgeClass(result.pathType)}`}
        >
          {result.pathLabel}
        </Badge>
        <span
          className={
            unpublished
              ? "text-sm text-muted-foreground"
              : "font-mono text-sm font-medium"
          }
        >
          {mucLayoverMinutesLabel(result.minutes)}
        </span>
      </div>
      <p className="flex gap-2 text-sm leading-6">
        <Info
          className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
          aria-hidden="true"
        />
        <span>{result.trap}</span>
      </p>
      {result.pinsNote ? (
        <p className="text-xs leading-5 text-muted-foreground">{result.pinsNote}</p>
      ) : null}
    </div>
  );
}

function MucZoneSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: MucZoneId;
  onChange: (zone: MucZoneId) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (isMucZoneId(next)) {
            onChange(next);
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MUC_ZONE_GROUPS.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.zones.map((zone) => (
                <SelectItem key={zone.id} value={zone.id}>
                  {zone.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function MucLayoverWayfindingCard() {
  const [from, setFrom] = useState<MucZoneId>(DEFAULT_FROM);
  const [to, setTo] = useState<MucZoneId>(DEFAULT_TO);
  const result = lookupMucLayover(from, to);

  return (
    <Card id={MUC_LAYOVERS_ANCHOR} className="scroll-mt-[var(--site-header-offset)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">Layovers</p>
            <CardTitle className="mt-1">I am at / I need</CardTitle>
            <CardDescription>
              Published Munich Airport times only. No MCT, walk minutes, or
              security waits unless the airport published them.
            </CardDescription>
          </div>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Route className="size-5" aria-hidden="true" />
          </div>
        </div>
        <Badge variant="outline" className="w-fit rounded-full">
          MUC preview
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <MucZoneSelect
            id="muc-layover-from"
            label="I am at"
            value={from}
            onChange={setFrom}
          />
          <ArrowRight
            className="mx-auto hidden size-4 text-muted-foreground sm:mb-2.5 sm:block"
            aria-hidden="true"
          />
          <MucZoneSelect
            id="muc-layover-to"
            label="I need"
            value={to}
            onChange={setTo}
          />
        </div>

        <MucLayoverResultPanel result={result} />

        <a
          href={MUC_CONNECTING_FLIGHTS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary transition hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          munich-airport.com connecting flights
        </a>
      </CardContent>
    </Card>
  );
}

/**
 * Client preview shell. `useSearchParams` stays in this component so the
 * airport page can keep prerendering under Cache Components (wrap in
 * Suspense at the callsite).
 */
export function MucLayoverWayfinding({ iata }: { iata: string }) {
  const searchParams = useSearchParams();
  const enabled = isMucLayoversPreviewEnabled(iata, searchParams.get("layovers"));

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (searchParams.get("layovers") !== "1") {
      return;
    }
    document.getElementById(MUC_LAYOVERS_ANCHOR)?.scrollIntoView({
      block: "start",
    });
  }, [enabled, searchParams]);

  if (!enabled) {
    return null;
  }

  return <MucLayoverWayfindingCard />;
}
