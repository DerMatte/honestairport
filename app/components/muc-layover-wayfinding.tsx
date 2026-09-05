"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, ExternalLink, Info } from "lucide-react";
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
  isMucLayoversEnabled,
  isMucZoneId,
  lookupMucLayover,
  mucLayoverHoursLabel,
  mucLayoverMinutesLabel,
  parseMucZoneId,
  MUC_COMMON_CONNECTIONS,
  MUC_DEFAULT_FROM,
  MUC_DEFAULT_TO,
  MUC_GATE_LETTER_HINT,
  MUC_ZONE_GROUPS,
  type MucPathType,
  type MucZoneId,
  type MucLayoverResult,
} from "@/lib/muc-layovers";

export const MUC_LAYOVERS_ANCHOR = "muc-layovers";

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
  return (
    <div
      className="space-y-3 rounded-xl border bg-muted/30 p-4"
      aria-live="polite"
    >
      <p
        className={
          result.minutes
            ? "text-2xl font-semibold tracking-tight"
            : "text-sm text-muted-foreground"
        }
      >
        {mucLayoverMinutesLabel(result.minutes)}
      </p>
      <p className="flex gap-2 text-sm leading-6">
        <Info
          className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
          aria-hidden="true"
        />
        <span>{result.trap}</span>
      </p>
      {result.hours.length > 0 ? (
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {result.hours.map((entry) => (
            <li key={entry.label}>{mucLayoverHoursLabel(entry)}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
        <Badge
          variant="outline"
          className={`rounded-full ${pathTypeBadgeClass(result.pathType)}`}
        >
          {result.pathLabel}
        </Badge>
        <a
          href={result.sourceHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          munich-airport.com connecting flights
        </a>
      </div>
      {result.pinsNote ? (
        <p className="text-xs leading-5 text-muted-foreground">{result.pinsNote}</p>
      ) : null}
    </div>
  );
}

function MucZoneSelect({
  id,
  name,
  label,
  value,
  onChange,
}: {
  id: string;
  name: "from" | "to";
  label: string;
  value: MucZoneId;
  onChange: (zone: MucZoneId) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => {
          if (isMucZoneId(event.target.value)) {
            onChange(event.target.value);
          }
        }}
        className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {MUC_ZONE_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function MucLayoverControls({
  from,
  to,
  onPairChange,
  showSubmit,
}: {
  from: MucZoneId;
  to: MucZoneId;
  onPairChange: (nextFrom: MucZoneId, nextTo: MucZoneId) => void;
  showSubmit: boolean;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <MucZoneSelect
          id="muc-layover-from"
          name="from"
          label="I am at"
          value={from}
          onChange={(next) => onPairChange(next, to)}
        />
        <button
          type="button"
          aria-label="Swap I am at and I need"
          onClick={() => onPairChange(to, from)}
          className="mx-auto flex size-10 items-center justify-center rounded-lg border border-input text-muted-foreground outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:mb-0"
        >
          <ArrowLeftRight className="size-4" aria-hidden="true" />
        </button>
        <MucZoneSelect
          id="muc-layover-to"
          name="to"
          label="I need"
          value={to}
          onChange={(next) => onPairChange(from, next)}
        />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{MUC_GATE_LETTER_HINT}</p>
      <div className="flex flex-wrap gap-2">
        {MUC_COMMON_CONNECTIONS.map((chip) => {
          const active = from === chip.from && to === chip.to;
          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={active}
              onClick={() => onPairChange(chip.from, chip.to)}
              className={
                active
                  ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-sm font-medium"
                  : "rounded-full border border-input px-3 py-1 text-sm font-medium text-muted-foreground hover:bg-muted/50"
              }
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <button
        type="submit"
        className={
          showSubmit
            ? "block text-xs font-medium text-primary underline-offset-2 hover:underline"
            : "hidden"
        }
      >
        Show path
      </button>
    </>
  );
}

/**
 * Client shell. `useSearchParams` stays here so the airport page can keep
 * prerendering (wrap in Suspense at the callsite). Origin/destination are
 * URL-driven so the published result is in the HTML even without hydration.
 */
export function MucLayoverWayfinding({ iata }: { iata: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const enabled = isMucLayoversEnabled(iata);
  const from = parseMucZoneId(searchParams.get("from"), MUC_DEFAULT_FROM);
  const to = parseMucZoneId(searchParams.get("to"), MUC_DEFAULT_TO);
  const result = lookupMucLayover(from, to);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!enabled || searchParams.get("layovers") !== "1") {
      return;
    }
    document.getElementById(MUC_LAYOVERS_ANCHOR)?.scrollIntoView({
      block: "start",
    });
  }, [enabled, searchParams]);

  if (!enabled) {
    return null;
  }

  function replacePair(nextFrom: MucZoneId, nextTo: MucZoneId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <Card id={MUC_LAYOVERS_ANCHOR} className="scroll-mt-[var(--site-header-offset)]">
      <CardHeader>
        <p className="text-sm font-medium text-primary">Connecting at MUC</p>
        <CardTitle className="mt-1">I am at / I need</CardTitle>
        <CardDescription>
          Two picks. Published Munich Airport times only — no invented MCT,
          walk minutes, or security waits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form method="get" className="space-y-4">
          <input type="hidden" name="layovers" value="1" />
          <MucLayoverControls
            from={from}
            to={to}
            onPairChange={replacePair}
            showSubmit={!hydrated}
          />
          <MucLayoverResultPanel result={result} />
        </form>
      </CardContent>
    </Card>
  );
}
