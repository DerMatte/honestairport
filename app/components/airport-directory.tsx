"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { AirportCard } from "@/app/components/airport-card";
import { AirportMap } from "@/app/components/airport-map";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import {
  amenityCategories,
  amenityLabel,
  disruptionStatuses,
  filterAndSortAirports,
  regions,
} from "@/lib/airport-utils";
import { cn } from "@/lib/utils";
import type {
  Airport,
  AirportFilters,
  AirportSearchScope,
  AirportSort,
  AmenityCategory,
  DisruptionStatus,
  Region,
} from "@/lib/types";

interface AirportDirectoryProps {
  airports: Airport[];
}

const DEFAULT_FILTERS: AirportFilters = {
  query: "",
  searchScope: "all",
  minimumScore: 0,
  regions: [],
  amenities: [],
  disruptionStatuses: [],
  sort: "highest-score",
};

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

const searchScopes: {
  value: AirportSearchScope;
  label: string;
  placeholder: string;
  empty: string;
  heading: string;
}[] = [
  {
    value: "all",
    label: "All",
    placeholder: "Search by airport, code, city, or country",
    empty: "No matching airports found.",
    heading: "Airports",
  },
  {
    value: "city",
    label: "City",
    placeholder: "Filter by city",
    empty: "No matching cities found.",
    heading: "Cities",
  },
  {
    value: "country",
    label: "Country",
    placeholder: "Filter by country",
    empty: "No matching countries found.",
    heading: "Countries",
  },
];

interface SearchOption {
  value: string;
  label: string;
  description: string;
  searchValue: string;
}

function searchScopeConfig(scope: AirportSearchScope) {
  return searchScopes.find((item) => item.value === scope) ?? searchScopes[0];
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function locationOptions(
  airports: Airport[],
  field: "city" | "country",
): SearchOption[] {
  const counts = new Map<string, number>();

  for (const airport of airports) {
    const value = airport[field];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({
      value,
      label: value,
      description: `${count} airport${count === 1 ? "" : "s"}`,
      searchValue: normalizeSearchValue(value),
    }));
}

function searchOptions(airports: Airport[], scope: AirportSearchScope): SearchOption[] {
  if (scope === "city" || scope === "country") {
    return locationOptions(airports, scope);
  }

  return airports.map((airport) => ({
    value: airport.iata,
    label: airport.shortName,
    description: `${airport.iata} · ${airport.city}, ${airport.country}`,
    searchValue: normalizeSearchValue(
      [
        airport.name,
        airport.shortName,
        airport.iata,
        airport.icao,
        airport.city,
        airport.country,
        airport.region,
      ].join(" "),
    ),
  }));
}

function AirportSearchCombobox({
  airports,
  filters,
  onFiltersChange,
}: {
  airports: Airport[];
  filters: AirportFilters;
  onFiltersChange: (filters: AirportFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const config = searchScopeConfig(filters.searchScope);
  const query = filters.query.trim();
  const options = useMemo(
    () => searchOptions(airports, filters.searchScope),
    [airports, filters.searchScope],
  );
  const selectedOption = options.find((option) => option.value === query);
  const visibleOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(filters.query);
    const matches = normalizedQuery
      ? options.filter((option) => option.searchValue.includes(normalizedQuery))
      : options;

    return matches.slice(0, 12);
  }, [filters.query, options]);

  function updateQuery(nextQuery: string) {
    onFiltersChange({ ...filters, query: nextQuery });
  }

  function updateSearchScope(searchScope: AirportSearchScope) {
    onFiltersChange({ ...filters, searchScope, query: "" });
    setOpen(true);
  }

  function selectOption(option: SearchOption) {
    onFiltersChange({ ...filters, query: option.value });
    setOpen(false);
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-2 shadow-xl shadow-primary/5 ring-1 ring-primary/5">
      <div className="grid gap-2 sm:grid-cols-[150px_1fr]">
        <Select
          value={filters.searchScope}
          onValueChange={(value) => updateSearchScope(value as AirportSearchScope)}
        >
          <SelectTrigger className="h-12 w-full rounded-xl border-0 bg-muted/60 px-3 text-base shadow-none focus-visible:ring-0">
            <SelectValue placeholder="Search by" />
          </SelectTrigger>
          <SelectContent>
            {searchScopes.map((scope) => (
              <SelectItem key={scope.value} value={scope.value}>
                {scope.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              role="combobox"
              aria-expanded={open}
              className="h-12 w-full min-w-0 justify-between rounded-xl px-3 text-left text-base font-normal hover:bg-muted/60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span
                  className={cn(
                    "truncate",
                    !query && "text-muted-foreground",
                  )}
                >
                  {selectedOption?.label ?? (query || config.placeholder)}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                value={filters.query}
                onValueChange={updateQuery}
                placeholder={config.placeholder}
              />
              <CommandList>
                <CommandEmpty>{config.empty}</CommandEmpty>
                <CommandGroup heading={config.heading}>
                  {visibleOptions.map((option) => (
                    <CommandItem
                      key={`${filters.searchScope}-${option.value}`}
                      value={option.value}
                      onSelect={() => selectOption(option)}
                    >
                      <Check
                        className={cn(
                          "size-4",
                          query === option.value ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{option.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {query ? (
        <div className="px-2 pb-1 pt-3 text-xs text-muted-foreground">
          Filtering {config.label.toLowerCase()} results for{" "}
          <span className="font-medium text-foreground">{selectedOption?.label ?? query}</span>
        </div>
      ) : null}
    </div>
  );
}

function FilterPanel({
  filters,
  onFiltersChange,
  onReset,
}: {
  filters: AirportFilters;
  onFiltersChange: (filters: AirportFilters) => void;
  onReset: () => void;
}) {
  return (
    <Card className="border-border/70 bg-card/95">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filters
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Tune the directory for your travel style.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <Label>Minimum Airportist Score</Label>
            <span className="font-mono">{filters.minimumScore.toFixed(1)}</span>
          </div>
          <Slider
            min={0}
            max={10}
            step={0.5}
            value={[filters.minimumScore]}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                minimumScore: value[0] ?? 0,
              })
            }
          />
        </div>

        <div className="space-y-3">
          <Label>Region</Label>
          <div className="space-y-2">
            {regions.map((region) => (
              <label key={region} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={filters.regions.includes(region)}
                  onCheckedChange={() =>
                    onFiltersChange({
                      ...filters,
                      regions: toggleValue<Region>(filters.regions, region),
                    })
                  }
                />
                {region}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Amenities</Label>
          <div className="space-y-2">
            {amenityCategories.map((category) => (
              <label key={category} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={filters.amenities.includes(category)}
                  onCheckedChange={() =>
                    onFiltersChange({
                      ...filters,
                      amenities: toggleValue<AmenityCategory>(
                        filters.amenities,
                        category,
                      ),
                    })
                  }
                />
                {amenityLabel(category)}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Current Disruption Level</Label>
          <div className="grid grid-cols-2 gap-2">
            {disruptionStatuses.map((status) => (
              <label
                key={status}
                className="flex items-center gap-2 rounded-xl border bg-background/60 p-2 text-sm"
              >
                <Checkbox
                  checked={filters.disruptionStatuses.includes(status)}
                  onCheckedChange={() =>
                    onFiltersChange({
                      ...filters,
                      disruptionStatuses: toggleValue<DisruptionStatus>(
                        filters.disruptionStatuses,
                        status,
                      ),
                    })
                  }
                />
                <DisruptionBadge status={status} />
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AirportDirectory({ airports }: AirportDirectoryProps) {
  const [filters, setFilters] = useState<AirportFilters>(DEFAULT_FILTERS);

  const filteredAirports = useMemo(
    () => filterAndSortAirports(airports, filters),
    [airports, filters],
  );

  const topAirport = airports[0];
  const activeFilterCount =
    filters.regions.length +
    filters.amenities.length +
    filters.disruptionStatuses.length +
    (filters.minimumScore > 0 ? 1 : 0) +
    (filters.query.trim() ? 1 : 0);

  function updateFilters(nextFilters: AirportFilters) {
    setFilters(nextFilters);
  }

  function resetFilters() {
    setFilters({ ...DEFAULT_FILTERS, regions: [], amenities: [], disruptionStatuses: [] });
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent),radial-gradient(circle_at_top_left,var(--muted),transparent_34%)]">
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="flex flex-col justify-center">
          <Badge
            variant="outline"
            className="mb-6 w-fit rounded-full border-primary/25 bg-primary/5 px-3 py-1 text-primary"
          >
            HonestAirport beta · Airportist Score inside
          </Badge>
          <h1 className="max-w-4xl text-5xl leading-[1.06] tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Airport intel that feels like a calm frequent flyer in your pocket.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
            Search major airports, compare disruption risk, spot the amenities
            that matter, and read practical Traveler Tips before you get there.
          </p>

          <div className="mt-8 max-w-2xl">
            <AirportSearchCombobox
              airports={airports}
              filters={filters}
              onFiltersChange={updateFilters}
            />
          </div>

          <div className="mt-7 flex flex-wrap gap-2.5 text-sm text-muted-foreground">
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {airports.length} curated airports
            </Badge>
            {topAirport ? (
              <Badge variant="secondary" className="rounded-full px-3 py-1">
                Top score: {topAirport.iata} {topAirport.airportistScore.toFixed(1)}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              Flighty-style disruption signals
            </Badge>
          </div>
        </div>

        <AirportMap airports={airports} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 pb-16 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <FilterPanel
            filters={filters}
            onFiltersChange={updateFilters}
            onReset={resetFilters}
          />
        </aside>

        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border bg-card/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">
                {filteredAirports.length} airport
                {filteredAirports.length === 1 ? "" : "s"} found
              </div>
              <p className="text-xs text-muted-foreground">
                {activeFilterCount > 0
                  ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
                  : "Showing the full HonestAirport starter set"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="lg:hidden">
                    <Filter className="size-4" aria-hidden="true" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filter airports</SheetTitle>
                  </SheetHeader>
                  <div className="px-4 pb-4">
                    <FilterPanel
                      filters={filters}
                      onFiltersChange={updateFilters}
                      onReset={resetFilters}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <Select
                value={filters.sort}
                onValueChange={(value) =>
                  updateFilters({
                    ...filters,
                    sort: value as AirportSort,
                  })
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Sort airports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="highest-score">Highest Score</SelectItem>
                  <SelectItem value="most-reviewed">Most Reviewed</SelectItem>
                  <SelectItem value="least-disruptions">Least Disruptions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredAirports.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center px-6 py-14 text-center">
                <div className="rounded-full bg-muted p-4">
                  <Search className="size-6 text-muted-foreground" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">No matching airports yet</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Try another airport, city, or country, or remove one of the
                  active filters.
                </p>
                <Button className="mt-5" variant="outline" onClick={resetFilters}>
                  Reset filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAirports.map((airport) => (
                <AirportCard key={airport.iata} airport={airport} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
