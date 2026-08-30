"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Filter,
  List,
  Map as MapIcon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AirportDirectorySearch } from "@/app/components/airport-search-combobox";
import { AirportCard, AirportGuideCard } from "@/app/components/airport-card";
import { LazyAirportMap } from "@/app/components/airport-map-lazy";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  amenityCategories,
  amenityLabel,
  compareGuideRecency,
  disruptionLabel,
  disruptionStatuses,
  filterAndSortAirports,
  regions,
} from "@/lib/airport-utils";
import { normalizeSearchValue } from "@/lib/airport-search-utils";
import {
  DEFAULT_DIRECTORY_FILTERS,
  clearDirectoryDataFilters,
  directoryFiltersEqual,
  directorySearchHref,
  hasDirectoryChipFilters,
  hasDirectoryDataFilters,
  parseDirectorySearchParams,
} from "@/lib/directory-search-params";
import { cn } from "@/lib/utils";
import type { AirportSummary } from "@/lib/airport-content";
import type {
  AirportDirectoryAirport,
  AirportFilters,
  AirportSearchScope,
  AirportSort,
  AmenityCategory,
  DisruptionStatus,
  Region,
} from "@/lib/types";

interface AirportDirectoryProps {
  scoredAirports: AirportDirectoryAirport[];
  allAirports: AirportSummary[];
}

type DirectoryEntry =
  | { kind: "scored"; airport: AirportDirectoryAirport }
  | { kind: "guide"; summary: AirportSummary };

const INITIAL_VISIBLE = 12;
const LOAD_MORE_STEP = 12;
const FILTER_PANEL_WIDTH = 230;

/** Guide-only airport with its search haystacks pre-normalized per scope. */
interface GuideDirectoryEntry {
  summary: AirportSummary;
  normalized: Record<AirportSearchScope, string>;
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function FilterPanel({
  filters,
  onFiltersChange,
  onReset,
  onClose,
}: {
  filters: AirportFilters;
  onFiltersChange: (filters: AirportFilters) => void;
  onReset: () => void;
  /** Shown as a small close affordance on the box itself; omitted in the mobile sheet. */
  onClose?: () => void;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
        </CardTitle>
        {onClose ? (
          <CardAction>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={onClose}
                    aria-label="Hide filters"
                  >
                    <PanelLeftClose className="size-4" aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Hide filters</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardAction>
        ) : null}
      </CardHeader>
      <div className="flex items-start justify-between gap-3 px-4 pb-1">
        <p className="text-xs text-muted-foreground">Tune the board for your trip.</p>
        <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0">
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </Button>
      </div>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <Label>Minimum Airportist Score</Label>
            <span className="font-mono">{filters.minimumScore.toFixed(1)}</span>
          </div>
          <Slider
            aria-label="Minimum Airportist Score"
            min={0}
            max={10}
            step={0.5}
            value={[filters.minimumScore]}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, minimumScore: value[0] ?? 0 })
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
                      amenities: toggleValue<AmenityCategory>(filters.amenities, category),
                    })
                  }
                />
                {amenityLabel(category)}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Current disruption</Label>
          <div className="space-y-2">
            {disruptionStatuses.map((status) => (
              <label key={status} className="flex items-center gap-2.5 text-sm">
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
                <DisruptionBadge status={status} className="pointer-events-none" />
              </label>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function queryChipLabel(filters: AirportFilters): string {
  const query = filters.query.trim();
  switch (filters.searchScope) {
    case "city":
      return `City · ${query}`;
    case "country":
      return `Country · ${query}`;
    case "all":
      return query;
    default: {
      const exhaustiveCheck: never = filters.searchScope;
      return exhaustiveCheck;
    }
  }
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex h-7 items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 text-xs text-foreground transition-colors hover:bg-muted"
      aria-label={`Remove ${label} filter`}
    >
      <span>{label}</span>
      <X className="size-3 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function MapPlaceholder({
  count,
  onLoad,
}: {
  count: number;
  onLoad: () => void;
}) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_70%)] px-6 text-center">
      <div className="rounded-2xl border bg-background/90 p-4 shadow-sm">
        <MapIcon className="size-6 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{count} scored airports ready to map</p>
        <p className="max-w-xs text-xs leading-5 text-muted-foreground">
          Open it when you&apos;re ready — we leave it unloaded so the page stays fast.
        </p>
      </div>
      <Button onClick={onLoad}>Show map</Button>
    </div>
  );
}

export function AirportDirectory({ scoredAirports, allAirports }: AirportDirectoryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [filters, setFilters] = useState<AirportFilters>(() =>
    parseDirectorySearchParams(searchParams),
  );
  const deferredFilters = useDeferredValue(filters);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [mobileMapMounted, setMobileMapMounted] = useState(false);
  const [desktopMapMounted, setDesktopMapMounted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const next = parseDirectorySearchParams(new URLSearchParams(searchKey));
    setFilters((prev) => (directoryFiltersEqual(prev, next) ? prev : next));
  }, [searchKey]);

  const filterIdentity = [
    filters.query,
    filters.searchScope,
    filters.minimumScore,
    filters.regions.join(","),
    filters.amenities.join(","),
    filters.disruptionStatuses.join(","),
    filters.sort,
  ].join("|");

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [filterIdentity]);

  const otherAirports = useMemo<GuideDirectoryEntry[]>(() => {
    const scoredIatas = new Set(scoredAirports.map((airport) => airport.iata));
    return allAirports
      .filter((summary) => !scoredIatas.has(summary.iata))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((summary) => ({
        summary,
        normalized: {
          all: normalizeSearchValue(
            [summary.name, summary.iata, summary.city, summary.country].join(" "),
          ),
          city: normalizeSearchValue(summary.city),
          country: normalizeSearchValue(summary.country),
        },
      }));
  }, [allAirports, scoredAirports]);

  const hasDataFilters = hasDirectoryDataFilters(deferredFilters);
  const showFilterChips = hasDirectoryChipFilters(filters);
  const showGuideOnlyHidden =
    hasDirectoryDataFilters(filters) && otherAirports.length > 0;

  const filteredScored = useMemo(
    () => filterAndSortAirports(scoredAirports, deferredFilters),
    [scoredAirports, deferredFilters],
  );

  const filteredGuides = useMemo(() => {
    if (hasDataFilters) return [];
    const normalizedQuery = normalizeSearchValue(deferredFilters.query);
    const scope = deferredFilters.searchScope;
    const guides = otherAirports
      .filter((entry) => !normalizedQuery || entry.normalized[scope].includes(normalizedQuery))
      .map((entry) => entry.summary);

    if (deferredFilters.sort === "newest-guides") {
      return [...guides].sort((a, b) =>
        compareGuideRecency(a.lastUpdated, b.lastUpdated, a.name, b.name),
      );
    }

    return guides;
  }, [otherAirports, deferredFilters, hasDataFilters]);

  const filteredEntries: DirectoryEntry[] = useMemo(() => {
    const scoredEntries = filteredScored.map((airport) => ({
      kind: "scored" as const,
      airport,
    }));
    const guideEntries = filteredGuides.map((summary) => ({
      kind: "guide" as const,
      summary,
    }));

    if (deferredFilters.sort !== "newest-guides") {
      return [...scoredEntries, ...guideEntries];
    }

    return [...scoredEntries, ...guideEntries].sort((a, b) => {
      const aDate = a.kind === "scored" ? a.airport.guideLastUpdated : a.summary.lastUpdated;
      const bDate = b.kind === "scored" ? b.airport.guideLastUpdated : b.summary.lastUpdated;
      const aName = a.kind === "scored" ? a.airport.name : a.summary.name;
      const bName = b.kind === "scored" ? b.airport.name : b.summary.name;
      return compareGuideRecency(aDate, bDate, aName, bName);
    });
  }, [filteredScored, filteredGuides, deferredFilters.sort]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const remainingCount = filteredEntries.length - visibleCount;
  const hasMore = remainingCount > 0;

  const activeFilterCount =
    filters.regions.length +
    filters.amenities.length +
    filters.disruptionStatuses.length +
    (filters.minimumScore > 0 ? 1 : 0) +
    (filters.query.trim() ? 1 : 0);

  function writeFilters(next: AirportFilters) {
    const href = directorySearchHref(next, searchParams);
    const nextKey = href.startsWith("/?") ? href.slice(2) : "";
    if (nextKey !== searchKey) {
      router.replace(href, { scroll: false });
    }
  }

  function resetFilters() {
    startTransition(() => {
      setFilters({ ...DEFAULT_DIRECTORY_FILTERS });
      setVisibleCount(INITIAL_VISIBLE);
      writeFilters(DEFAULT_DIRECTORY_FILTERS);
    });
  }

  function updateFilters(next: AirportFilters) {
    startTransition(() => {
      setFilters(next);
      setVisibleCount(INITIAL_VISIBLE);
      writeFilters(next);
    });
  }

  function showMobileMap() {
    setMobileMapMounted(true);
    setMobileView("map");
  }

  const filterSheet = (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="xl:hidden">
          <Filter className="size-4" aria-hidden="true" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filter airports</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-4">
          <FilterPanel filters={filters} onFiltersChange={updateFilters} onReset={resetFilters} />
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="min-w-0 overflow-x-clip">
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <AirportDirectorySearch filters={filters} onFiltersChange={updateFilters} />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="mt-6 border-b border-border/50 pb-8 sm:mt-8 sm:pb-12 lg:mt-10"
      />

      <section
        aria-labelledby="directory-heading"
        className={cn(
          "pt-14 lg:grid lg:grid-cols-[minmax(0,58%)_minmax(400px,42%)] lg:items-start lg:pt-16",
          mobileView === "map" && "max-lg:hidden",
        )}
      >
        <div className="min-w-0 pr-5 pb-24 pl-5 sm:pr-6 sm:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))] lg:pb-8">
          <div className="mb-6 flex items-end justify-between gap-4 border-b pb-5">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                Airport directory
              </p>
              <h2 id="directory-heading" className="mt-1 text-2xl tracking-tight sm:text-3xl">
                {allAirports.length} airports, side by side
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Every airport in the directory has an Airportist Score. The map
                plots the same set.
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground sm:block">
              {filteredScored.length} mapped
            </span>
          </div>

          <div className="flex flex-col xl:flex-row xl:items-start">
            <aside
              aria-hidden={!filtersOpen}
              inert={!filtersOpen}
              className="hidden shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none xl:block"
              style={{
                width: filtersOpen ? FILTER_PANEL_WIDTH : 0,
                marginRight: filtersOpen ? 24 : 0,
              }}
            >
              <div style={{ width: FILTER_PANEL_WIDTH }}>
                <div
                  className={cn(
                    "sticky top-20 origin-left transition-[opacity,transform] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none",
                    filtersOpen
                      ? "translate-x-0 opacity-100"
                      : "pointer-events-none -translate-x-3 opacity-0",
                  )}
                >
                  <FilterPanel
                    filters={filters}
                    onFiltersChange={updateFilters}
                    onReset={resetFilters}
                    onClose={() => setFiltersOpen(false)}
                  />
                </div>
              </div>
            </aside>

            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card/90 p-3 shadow-sm">
                <div aria-live="polite">
                  <div className="text-sm font-medium">
                    {filteredEntries.length} airport{filteredEntries.length === 1 ? "" : "s"} found
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeFilterCount > 0
                      ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
                      : "All guides shown"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {filterSheet}
                  {!filtersOpen ? (
                    <Button
                      variant="outline"
                      className="hidden xl:inline-flex"
                      onClick={() => setFiltersOpen(true)}
                      aria-expanded={filtersOpen}
                    >
                      <PanelLeftOpen className="size-4" aria-hidden="true" />
                      Show filters
                      {activeFilterCount > 0 ? (
                        <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">
                          {activeFilterCount}
                        </span>
                      ) : null}
                    </Button>
                  ) : null}
                  <Select
                    value={filters.sort}
                    onValueChange={(value) =>
                      updateFilters({ ...filters, sort: value as AirportSort })
                    }
                  >
                    <SelectTrigger className="w-44 sm:w-48" aria-label="Sort airports">
                      <SelectValue placeholder="Sort airports" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="highest-score">Highest score</SelectItem>
                      <SelectItem value="most-reviewed">Most reviewed</SelectItem>
                      <SelectItem value="least-disruptions">Least disruptions</SelectItem>
                      <SelectItem value="newest-guides">Newest guides</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {showFilterChips || showGuideOnlyHidden ? (
                <div className="flex flex-wrap items-center gap-2">
                  {showGuideOnlyHidden ? (
                    <button
                      type="button"
                      onClick={() => updateFilters(clearDirectoryDataFilters(filters))}
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-border/70 bg-muted/70 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Clear score, region, amenity, and disruption filters"
                    >
                      <span>Guide-only hidden</span>
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  ) : null}
                  {filters.query.trim() ? (
                    <FilterChip
                      label={queryChipLabel(filters)}
                      onRemove={() =>
                        updateFilters({ ...filters, query: "", searchScope: "all" })
                      }
                    />
                  ) : null}
                  {filters.minimumScore > 0 ? (
                    <FilterChip
                      label={`Score ≥ ${filters.minimumScore.toFixed(1)}`}
                      onRemove={() => updateFilters({ ...filters, minimumScore: 0 })}
                    />
                  ) : null}
                  {filters.regions.map((region) => (
                    <FilterChip
                      key={`region-${region}`}
                      label={region}
                      onRemove={() =>
                        updateFilters({
                          ...filters,
                          regions: filters.regions.filter((item) => item !== region),
                        })
                      }
                    />
                  ))}
                  {filters.amenities.map((category) => (
                    <FilterChip
                      key={`amenity-${category}`}
                      label={amenityLabel(category)}
                      onRemove={() =>
                        updateFilters({
                          ...filters,
                          amenities: filters.amenities.filter((item) => item !== category),
                        })
                      }
                    />
                  ))}
                  {filters.disruptionStatuses.map((status) => (
                    <FilterChip
                      key={`disruption-${status}`}
                      label={disruptionLabel(status)}
                      onRemove={() =>
                        updateFilters({
                          ...filters,
                          disruptionStatuses: filters.disruptionStatuses.filter(
                            (item) => item !== status,
                          ),
                        })
                      }
                    />
                  ))}
                </div>
              ) : null}

              {filteredEntries.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center px-6 py-14 text-center">
                    <div className="rounded-full bg-muted p-4">
                      <Search className="size-6 text-muted-foreground" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 text-xl font-semibold">No matching airports yet</h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Try another airport, city, or country, or remove an active filter.
                    </p>
                    <Button className="mt-5" variant="outline" onClick={resetFilters}>
                      Reset filters
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div
                    className={cn(
                      "grid grid-cols-1 gap-4 2xl:grid-cols-2",
                      !filtersOpen && "xl:grid-cols-2",
                    )}
                  >
                    {visibleEntries.map((entry) =>
                      entry.kind === "scored" ? (
                        <div
                          key={entry.airport.iata}
                          className="-mt-px pt-px [content-visibility:auto] [contain-intrinsic-size:auto_22rem]"
                        >
                          <AirportCard airport={entry.airport} />
                        </div>
                      ) : (
                        <div
                          key={entry.summary.iata}
                          className="-mt-px pt-px [content-visibility:auto] [contain-intrinsic-size:auto_14rem]"
                        >
                          <AirportGuideCard airport={entry.summary} />
                        </div>
                      ),
                    )}
                  </div>
                  {hasMore ? (
                    <div className="flex justify-center pt-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          startTransition(() =>
                            setVisibleCount((count) => count + LOAD_MORE_STEP),
                          )
                        }
                      >
                        Show more airports ({remainingCount} remaining)
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        <aside
          aria-label="Map of filtered scored airports"
          className="relative hidden border-l border-border/60 bg-muted/30 lg:sticky lg:top-14 lg:block lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden"
        >
          <div className="absolute top-3 left-3 z-10 rounded-lg border bg-background/90 px-3 py-2 shadow-sm backdrop-blur-sm">
            <p className="font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Scored airports on the map
            </p>
            <p className="mt-0.5 text-sm font-medium">{filteredScored.length} scored airports</p>
          </div>
          {desktopMapMounted ? (
            <LazyAirportMap airports={filteredScored} />
          ) : (
            <MapPlaceholder
              count={filteredScored.length}
              onLoad={() => setDesktopMapMounted(true)}
            />
          )}
        </aside>
      </section>

      {/* Keep shell mounted so aria-controls always resolves. */}
      <div
        id="mobile-airport-map"
        aria-hidden={mobileView !== "map"}
        className={cn(
          "fixed inset-x-0 top-14 bottom-0 z-30 bg-muted lg:hidden",
          mobileView !== "map" && "invisible pointer-events-none",
        )}
      >
        {mobileMapMounted ? <LazyAirportMap airports={filteredScored} /> : null}
      </div>

      <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 lg:hidden">
        <Button
          size="lg"
          className="min-w-28 rounded-full shadow-xl ring-1 ring-background/80"
          aria-controls="mobile-airport-map"
          aria-expanded={mobileView === "map"}
          aria-pressed={mobileView === "map"}
          onClick={mobileView === "map" ? () => setMobileView("list") : showMobileMap}
        >
          {mobileView === "map" ? (
            <List className="size-4" aria-hidden="true" />
          ) : (
            <MapIcon className="size-4" aria-hidden="true" />
          )}
          {mobileView === "map" ? "List" : "Map"}
        </Button>
      </div>
    </div>
  );
}
