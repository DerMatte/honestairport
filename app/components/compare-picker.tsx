"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Plane, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAirportSearch } from "@/app/components/use-airport-search";
import { compareSearchHref } from "@/lib/compare-search-params";
import { cn } from "@/lib/utils";
import type { AirportSearchEntry } from "@/lib/airport-search";

export type ComparePickerValue = {
  iata: string | null;
  name?: string | null;
};

function AirportField({
  name,
  label,
  iata,
  airportName,
  excludeIata,
  onPicked,
}: {
  name: "a" | "b";
  label: string;
  iata: string | null;
  airportName?: string | null;
  excludeIata?: string | null;
  onPicked: (iata: string) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef(0);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { results, pending } = useAirportSearch(query, null);
  const airports = results.airports.filter(
    (airport) => airport.iata !== excludeIata,
  );

  useEffect(() => {
    return () => window.clearTimeout(blurTimeoutRef.current);
  }, []);

  function pick(airport: AirportSearchEntry) {
    setQuery("");
    setOpen(false);
    onPicked(airport.iata);
  }

  return (
    <div className="relative">
      <label htmlFor={`compare-airport-${name}`} className="sr-only">
        {label}
      </label>
      <div className="rounded-2xl border border-border/70 bg-card px-3 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Plane className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {label}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              {iata ? (
                <Badge variant="outline" className="font-mono">
                  {iata}
                </Badge>
              ) : null}
              {airportName && !open ? (
                <span className="truncate text-sm font-medium">{airportName}</span>
              ) : null}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <Input
                ref={inputRef}
                key={`${name}-${iata ?? "empty"}`}
                id={`compare-airport-${name}`}
                name={name}
                defaultValue={iata ?? ""}
                autoComplete="off"
                spellCheck={false}
                placeholder={iata ? "Change airport" : "IATA, name, or city"}
                aria-controls={listId}
                aria-expanded={open}
                role="combobox"
                className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpen(true);
                }}
                onFocus={() => {
                  window.clearTimeout(blurTimeoutRef.current);
                  setOpen(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = window.setTimeout(() => {
                    const active = document.activeElement;
                    if (
                      inputRef.current === active ||
                      panelRef.current?.contains(active)
                    ) {
                      return;
                    }
                    setOpen(false);
                  }, 150);
                }}
              />
              {query ? (
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Clear ${label}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setQuery("");
                    if (inputRef.current) {
                      inputRef.current.value = "";
                      inputRef.current.focus();
                    }
                  }}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {open ? (
        <div
          ref={panelRef}
          id={listId}
          className="absolute top-[calc(100%+0.5rem)] z-50 w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl shadow-primary/10 ring-1 ring-primary/5"
        >
          <ul className="max-h-72 overflow-auto p-1">
            {!pending && airports.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {query.trim()
                  ? "No airports match that search."
                  : "Type a code, city, or airport name."}
              </li>
            ) : null}
            {airports.map((airport) => (
              <li key={airport.iata}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-muted"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (inputRef.current) {
                      inputRef.current.value = airport.iata;
                    }
                    pick(airport);
                  }}
                >
                  <span className="font-mono text-xs text-muted-foreground">
                    {airport.iata}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {airport.shortName ?? airport.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {airport.city}, {airport.country}
                      {airport.score !== undefined
                        ? ` · Score ${airport.score.toFixed(1)}`
                        : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ComparePicker({
  a,
  b,
}: {
  a: ComparePickerValue;
  b: ComparePickerValue;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function replacePair(nextA: string | null, nextB: string | null) {
    startTransition(() => {
      router.replace(compareSearchHref(nextA, nextB), { scroll: false });
    });
  }

  return (
    <form
      action="/compare"
      method="get"
      className={cn("space-y-3", isPending && "opacity-80")}
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <AirportField
          name="a"
          label="Airport A"
          iata={a.iata}
          airportName={a.name}
          excludeIata={b.iata}
          onPicked={(iata) => replacePair(iata, b.iata)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="mx-auto size-11 rounded-2xl"
          aria-label="Swap airports"
          disabled={!a.iata && !b.iata}
          onClick={() => replacePair(b.iata, a.iata)}
        >
          <ArrowLeftRight className="size-4" aria-hidden="true" />
        </Button>
        <AirportField
          name="b"
          label="Airport B"
          iata={b.iata}
          airportName={b.name}
          excludeIata={a.iata}
          onPicked={(iata) => replacePair(a.iata, iata)}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit">Compare</Button>
      </div>
    </form>
  );
}
