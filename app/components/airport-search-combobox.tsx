"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe2, MapPin, Plane, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  filterAirportsByQuery,
  filterOptionsByQuery,
  locationOptions,
  mergeAirportsWithPriority,
  searchExamples,
  searchScopeConfig,
  splitCityMatchesByAirportCount,
  type SearchableLocation,
} from "@/lib/airport-search-utils";
import { cn } from "@/lib/utils";
import type { AirportFilters } from "@/lib/types";

function keepFocusOnTouch(event: React.PointerEvent) {
  event.preventDefault();
}

interface ActiveFilterTagProps {
  label: string;
  onClear: () => void;
}

function ActiveFilterTag({ label, onClear }: ActiveFilterTagProps) {
  return (
    <Badge
      variant="secondary"
      className="h-7 shrink-0 gap-1 rounded-full border border-primary/15 bg-primary/8 px-2.5 py-0 text-xs text-foreground"
    >
      <MapPin className="size-3 text-primary" aria-hidden="true" />
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
        aria-label={`Clear ${label} filter`}
      >
        <X className="size-3" />
      </button>
    </Badge>
  );
}

interface InlineSearchBarProps {
  query: string;
  locationFilter: { field: "city" | "country"; value: string } | null;
  onQueryChange: (query: string) => void;
  onClearLocationFilter: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onFocus?: () => void;
  onBlur?: () => void;
  showShortcut?: boolean;
  showSearchIcon?: boolean;
}

function InlineSearchBar({
  query,
  locationFilter,
  onQueryChange,
  onClearLocationFilter,
  inputRef,
  onFocus,
  onBlur,
  showShortcut = false,
  showSearchIcon = false,
}: InlineSearchBarProps) {
  const config = searchScopeConfig("all");

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && query === "" && locationFilter) {
      event.preventDefault();
      onClearLocationFilter();
    }
  }

  return (
    <div className="relative flex min-h-14 flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2 sm:px-4">
      {locationFilter ? (
        <ActiveFilterTag label={locationFilter.value} onClear={onClearLocationFilter} />
      ) : null}
      <div className="flex min-w-[10rem] flex-1 items-center gap-2">
        {showSearchIcon ? (
          <Search className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
        ) : null}
        <CommandInput
          ref={inputRef}
          inline
          value={query}
          onValueChange={onQueryChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder={config.placeholder}
        />
      </div>
      {showShortcut ? (
        <CommandShortcut className="pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 sm:inline-flex">
          ESC
        </CommandShortcut>
      ) : null}
    </div>
  );
}

interface SearchResultsProps {
  query: string;
  airports: SearchableLocation[];
  locationFilter: { field: "city" | "country"; value: string } | null;
  onSelectAirport: (airport: SearchableLocation) => void;
  onSelectLocation: (field: "city" | "country", value: string) => void;
  onPreviewAirport?: (airport: SearchableLocation) => void;
  listClassName?: string;
}

function SearchResults({
  query,
  airports,
  locationFilter,
  onSelectAirport,
  onSelectLocation,
  onPreviewAirport,
  listClassName,
}: SearchResultsProps) {
  const config = searchScopeConfig("all");
  const normalizedQuery = query.trim();
  const examples = useMemo(() => searchExamples(airports), [airports]);

  const scopedAirports = useMemo(() => {
    if (!locationFilter) return airports;
    return airports.filter((airport) => airport[locationFilter.field] === locationFilter.value);
  }, [airports, locationFilter]);

  const { cityMatches, singleCityAirports } = useMemo(() => {
    const matches = filterOptionsByQuery(locationOptions(airports, "city"), query).slice(0, 5);
    const { cities, singleAirportCities } = splitCityMatchesByAirportCount(airports, matches);
    return { cityMatches: cities, singleCityAirports: singleAirportCities };
  }, [airports, query]);

  const countryMatches = useMemo(
    () => filterOptionsByQuery(locationOptions(airports, "country"), query).slice(0, 5),
    [airports, query],
  );

  const airportResults = useMemo(() => {
    const filtered = filterAirportsByQuery(scopedAirports, query, "all");
    const merged =
      normalizedQuery && !locationFilter
        ? mergeAirportsWithPriority(singleCityAirports, filtered)
        : filtered;

    if (locationFilter) return merged;
    if (normalizedQuery) return merged.slice(0, 8);
    return merged;
  }, [locationFilter, normalizedQuery, query, scopedAirports, singleCityAirports]);

  const showExamples = !normalizedQuery && !locationFilter && examples !== null;
  const showUnifiedLocations = Boolean(normalizedQuery);
  const showAirportGroup = !showExamples && airportResults.length > 0;

  const hasResults =
    showExamples ||
    (showUnifiedLocations && (cityMatches.length > 0 || countryMatches.length > 0)) ||
    airportResults.length > 0;

  useEffect(() => {
    if (!onPreviewAirport) return;

    if (showExamples && examples) {
      onPreviewAirport(examples.airport);
      return;
    }

    for (const airport of airportResults.slice(0, 6)) {
      onPreviewAirport(airport);
    }
  }, [airportResults, examples, onPreviewAirport, showExamples]);

  return (
    <CommandList className={cn("max-h-[min(24rem,50vh)]", listClassName)}>
      {!hasResults ? <CommandEmpty>{config.empty}</CommandEmpty> : null}

      {showExamples ? (
        <CommandGroup heading="Try searching">
          <CommandItem
            value={`example-airport-${examples.airport.iata}`}
            onSelect={() => onSelectAirport(examples.airport)}
            onPointerDown={keepFocusOnTouch}
            onFocus={() => onPreviewAirport?.(examples.airport)}
            onMouseEnter={() => onPreviewAirport?.(examples.airport)}
          >
            <Plane className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {examples.airport.shortName ?? examples.airport.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Airport · {examples.airport.iata} · {examples.airport.city}, {examples.airport.country}
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value={`example-city-${examples.city.value}`}
            onSelect={() => onSelectLocation("city", examples.city.value)}
            onPointerDown={keepFocusOnTouch}
          >
            <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{examples.city.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                City · {examples.city.description}
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value={`example-country-${examples.country.value}`}
            onSelect={() => onSelectLocation("country", examples.country.value)}
            onPointerDown={keepFocusOnTouch}
          >
            <Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{examples.country.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                Country · {examples.country.description}
              </span>
            </span>
          </CommandItem>
        </CommandGroup>
      ) : null}

      {showAirportGroup && airportResults.length > 0 ? (
        <CommandGroup heading={locationFilter ? `Airports in ${locationFilter.value}` : "Airports"}>
          {airportResults.map((airport) => (
            <CommandItem
              key={airport.iata}
              value={`${airport.iata}-${airport.slug}`}
              onSelect={() => onSelectAirport(airport)}
              onPointerDown={keepFocusOnTouch}
              onFocus={() => onPreviewAirport?.(airport)}
              onMouseEnter={() => onPreviewAirport?.(airport)}
            >
              <span className="font-mono text-xs text-muted-foreground">{airport.iata}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{airport.shortName ?? airport.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {airport.city}, {airport.country}
                  {airport.score !== undefined ? ` · Score ${airport.score.toFixed(1)}` : null}
                </span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {showUnifiedLocations && cityMatches.length > 0 ? (
        <CommandGroup heading="Cities">
          {cityMatches.map((option) => (
            <CommandItem
              key={`city-${option.value}`}
              value={`city-${option.value}`}
              onSelect={() => onSelectLocation("city", option.value)}
              onPointerDown={keepFocusOnTouch}
            >
              <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{option.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}

      {showUnifiedLocations && countryMatches.length > 0 ? (
        <CommandGroup heading="Countries">
          {countryMatches.map((option) => (
            <CommandItem
              key={`country-${option.value}`}
              value={`country-${option.value}`}
              onSelect={() => onSelectLocation("country", option.value)}
              onPointerDown={keepFocusOnTouch}
            >
              <Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{option.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
    </CommandList>
  );
}

interface AirportSearchSurfaceProps {
  airports: SearchableLocation[];
  query: string;
  locationFilter: { field: "city" | "country"; value: string } | null;
  onQueryChange: (query: string) => void;
  onClearLocationFilter: () => void;
  onSelectAirport: (airport: SearchableLocation) => void;
  onSelectLocation: (field: "city" | "country", value: string) => void;
  onPreviewAirport?: (airport: SearchableLocation) => void;
  className?: string;
  listClassName?: string;
  showShortcut?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function AirportSearchSurface({
  airports,
  query,
  locationFilter,
  onQueryChange,
  onClearLocationFilter,
  onSelectAirport,
  onSelectLocation,
  onPreviewAirport,
  className,
  listClassName,
  showShortcut = false,
  inputRef,
}: AirportSearchSurfaceProps) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <Command shouldFilter={false} className="rounded-none bg-transparent">
        <InlineSearchBar
          query={query}
          locationFilter={locationFilter}
          onQueryChange={onQueryChange}
          onClearLocationFilter={onClearLocationFilter}
          inputRef={inputRef}
          showShortcut={showShortcut}
        />
        <SearchResults
          query={query}
          airports={airports}
          locationFilter={locationFilter}
          onSelectAirport={onSelectAirport}
          onSelectLocation={onSelectLocation}
          onPreviewAirport={onPreviewAirport}
          listClassName={listClassName}
        />
      </Command>
    </div>
  );
}

interface AirportSearchDialogProps {
  airports: SearchableLocation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AirportSearchDialog({
  airports,
  open,
  onOpenChange,
}: AirportSearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<{
    field: "city" | "country";
    value: string;
  } | null>(null);

  const prefetchAirport = useCallback(
    (airport: SearchableLocation) => {
      router.prefetch(`/airports/${airport.slug}`);
    },
    [router],
  );

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setLocationFilter(null);
    }
    onOpenChange(next);
  }

  function focusSearchInput(event: Event) {
    event.preventDefault();
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleSelectLocation(field: "city" | "country", value: string) {
    setLocationFilter({ field, value });
    setQuery("");
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function handleSelectAirport(airport: SearchableLocation) {
    handleOpenChange(false);
    router.push(`/airports/${airport.slug}`);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search airports"
      description="Search airports by code, name, city, or country."
      showCloseButton={false}
      className="max-w-2xl overflow-hidden rounded-2xl border-border/70 p-0 shadow-2xl shadow-primary/10 sm:max-w-3xl"
      onOpenAutoFocus={focusSearchInput}
    >
      <AirportSearchSurface
        airports={airports}
        query={query}
        locationFilter={locationFilter}
        onQueryChange={setQuery}
        onClearLocationFilter={() => setLocationFilter(null)}
        onSelectAirport={handleSelectAirport}
        onSelectLocation={handleSelectLocation}
        onPreviewAirport={prefetchAirport}
        showShortcut
        inputRef={inputRef}
      />
    </CommandDialog>
  );
}

interface AirportDirectorySearchProps {
  airports: SearchableLocation[];
  filters: AirportFilters;
  onFiltersChange: (filters: AirportFilters) => void;
}

export function AirportDirectorySearch({
  airports,
  filters,
  onFiltersChange,
}: AirportDirectorySearchProps) {
  const router = useRouter();
  const resultsPanelRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const query = filters.query;
  const scope = filters.searchScope;

  const locationFilter = useMemo(() => {
    if (scope === "city" && query.trim()) return { field: "city" as const, value: query };
    if (scope === "country" && query.trim()) return { field: "country" as const, value: query };
    return null;
  }, [query, scope]);

  const inputQuery = locationFilter ? "" : query;

  function updateQuery(nextQuery: string) {
    onFiltersChange({ ...filters, query: nextQuery, searchScope: "all" });
    setFocused(true);
  }

  function handleSelectLocation(field: "city" | "country", value: string) {
    onFiltersChange({
      ...filters,
      searchScope: field,
      query: value,
    });
    setFocused(false);
  }

  function handleSelectAirport(airport: SearchableLocation) {
    setFocused(false);
    router.push(`/airports/${airport.slug}`);
  }

  function clearLocationFilter() {
    onFiltersChange({ ...filters, query: "", searchScope: "all" });
  }

  const showPanel = focused || Boolean(query.trim()) || locationFilter !== null;

  return (
    <div className="relative">
      <Command shouldFilter={false} className="rounded-none bg-transparent">
        <div className="rounded-2xl border border-border/70 bg-card shadow-xl shadow-primary/5 ring-1 ring-primary/5">
          <InlineSearchBar
            query={inputQuery}
            locationFilter={locationFilter}
            onQueryChange={updateQuery}
            onClearLocationFilter={clearLocationFilter}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              window.setTimeout(() => {
                if (resultsPanelRef.current?.contains(document.activeElement)) {
                  return;
                }
                setFocused(false);
              }, 150);
            }}
            showSearchIcon
          />
        </div>

        {showPanel ? (
          <div
            ref={resultsPanelRef}
            className="absolute top-[calc(100%+0.5rem)] z-50 w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl shadow-primary/10 ring-1 ring-primary/5"
          >
            <SearchResults
              query={inputQuery}
              airports={airports}
              locationFilter={locationFilter}
              onSelectAirport={handleSelectAirport}
              onSelectLocation={handleSelectLocation}
              listClassName="max-h-72"
            />
          </div>
        ) : null}
      </Command>
    </div>
  );
}
