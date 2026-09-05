"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ChevronsUpDown, Plane, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAirportSearch } from "@/app/components/use-airport-search";
import { compareSearchHref } from "@/lib/compare-search-params";
import { cn } from "@/lib/utils";
import type { AirportSearchEntry } from "@/lib/airport-search";

export type ComparePickerValue = {
  iata: string | null;
  name?: string | null;
};

function CompareAirportCombobox({
  id,
  label,
  value,
  excludeIata,
  onSelect,
}: {
  id: string;
  label: string;
  value: ComparePickerValue;
  excludeIata?: string | null;
  onSelect: (airport: AirportSearchEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, pending } = useAirportSearch(query, null);
  const airports = results.airports.filter(
    (airport) => airport.iata !== excludeIata,
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const selectedLabel = value.iata
    ? value.name || value.iata
    : `Pick ${label}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={label}
          className="h-auto min-h-14 w-full justify-between gap-3 rounded-2xl border-border/70 bg-card px-3 py-2.5 text-left shadow-sm"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Plane className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {label}
              </span>
              <span className="mt-0.5 flex min-w-0 items-center gap-2">
                {value.iata ? (
                  <Badge variant="outline" className="font-mono">
                    {value.iata}
                  </Badge>
                ) : null}
                <span
                  className={cn(
                    "truncate text-sm font-medium",
                    value.iata ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {selectedLabel}
                </span>
              </span>
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-72 overflow-hidden p-0"
      >
        <Command shouldFilter={false} label={`Search ${label}`}>
          <div className="flex items-center gap-2 border-b border-border/70 px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <CommandInput
              ref={inputRef}
              inline
              value={query}
              onValueChange={setQuery}
              placeholder="Search code, name, or city"
              className="h-11"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <CommandList className="max-h-72">
            {!pending && airports.length === 0 ? (
              <CommandEmpty>No airports match that search.</CommandEmpty>
            ) : null}
            {airports.length > 0 ? (
              <CommandGroup heading="Airports">
                {airports.map((airport) => (
                  <CommandItem
                    key={airport.iata}
                    value={`${airport.iata}-${airport.slug}`}
                    onSelect={() => {
                      onSelect(airport);
                      setOpen(false);
                    }}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {airport.iata}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {airport.shortName ?? airport.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {airport.city}, {airport.country}
                        {airport.score !== undefined
                          ? ` · Score ${airport.score.toFixed(1)}`
                          : null}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center",
        isPending && "opacity-80",
      )}
    >
      <CompareAirportCombobox
        id="compare-airport-a"
        label="Airport A"
        value={a}
        excludeIata={b.iata}
        onSelect={(airport) => replacePair(airport.iata, b.iata)}
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
      <CompareAirportCombobox
        id="compare-airport-b"
        label="Airport B"
        value={b}
        excludeIata={a.iata}
        onSelect={(airport) => replacePair(a.iata, airport.iata)}
      />
    </div>
  );
}
