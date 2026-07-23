"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  Filter,
  List,
  Map as MapIcon,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { AirportDirectorySearch } from "@/app/components/airport-search-combobox";
import { AirportCard, AirportGuideCard } from "@/app/components/airport-card";
import { LazyAirportMap } from "@/app/components/airport-map-lazy";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  amenityCategories,
  amenityLabel,
  compareGuideRecency,
  disruptionStatuses,
  filterAndSortAirports,
  regions,
} from "@/lib/airport-utils";
import { normalizeSearchValue } from "@/lib/airport-search-utils";
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

/** Guide-only airport with its search haystacks pre-normalized per scope. */
interface GuideDirectoryEntry {
  summary: AirportSummary;
  normalized: Record<AirportSearchScope, string>;
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
    <Card className="border-border/70 bg-card/95 shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filters
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Tune the board for your trip.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </Button>
      </CardHeader>
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
  const [filters, setFilters] = useState<AirportFilters>(DEFAULT_FILTERS);
  const deferredFilters = useDeferredValue(filters);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [mobileMapMounted, setMobileMapMounted] = useState(false);
  const [desktopMapMounted, setDesktopMapMounted] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [, startTransition] = useTransition();

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

  const hasDataFilters =
    deferredFilters.minimumScore > 0 ||
    deferredFilters.regions.length > 0 ||
    deferredFilters.amenities.length > 0 ||
    deferredFilters.disruptionStatuses.length > 0;

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
  const hasMore = visibleCount < filteredEntries.length;

  const activeFilterCount =
    filters.regions.length +
    filters.amenities.length +
    filters.disruptionStatuses.length +
    (filters.minimumScore > 0 ? 1 : 0) +
    (filters.query.trim() ? 1 : 0);

  function resetFilters() {
    startTransition(() => {
      setFilters({ ...DEFAULT_FILTERS });
      setVisibleCount(INITIAL_VISIBLE);
    });
  }

  function updateFilters(next: AirportFilters) {
    startTransition(() => {
      setFilters(next);
      setVisibleCount(INITIAL_VISIBLE);
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
      <div className="mx-auto max-w-7xl px-5 pb-2 sm:px-6">
        <div className="-mt-6 max-w-2xl sm:-mt-8">
          <AirportDirectorySearch filters={filters} onFiltersChange={updateFilters} />
        </div>
      </div>

      <section
        aria-labelledby="directory-heading"
        className={cn(
          "lg:grid lg:grid-cols-[minmax(0,58%)_minmax(400px,42%)] lg:items-start",
          mobileView === "map" && "max-lg:hidden",
        )}
      >
        <div className="min-w-0 px-4 pt-8 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          <div className="mb-6 flex items-end justify-between gap-4 border-b pb-5">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                Airport directory
              </p>
              <h2 id="directory-heading" className="mt-1 text-2xl tracking-tight sm:text-3xl">
                {allAirports.length} airports, side by side
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Scored airports appear on the live map. Guide-only airports remain in the
                list until location and audit data are complete.
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground sm:block">
              {filteredScored.length} mapped
            </span>
          </div>

          <div className="grid gap-6 xl:grid-cols-[230px_minmax(0,1fr)]">
            <aside className="hidden xl:block">
              <div className="sticky top-20">
                <FilterPanel
                  filters={filters}
                  onFiltersChange={updateFilters}
                  onReset={resetFilters}
                />
              </div>
            </aside>

            <div className="min-w-0 space-y-4">
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

              {hasDataFilters && otherAirports.length > 0 ? (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Guide-only airports are hidden while score, amenity, region, or disruption
                  filters are active.
                </p>
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
                  <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                    {visibleEntries.map((entry) =>
                      entry.kind === "scored" ? (
                        <div
                          key={entry.airport.iata}
                          className="[content-visibility:auto] [contain-intrinsic-size:auto_22rem]"
                        >
                          <AirportCard airport={entry.airport} />
                        </div>
                      ) : (
                        <div
                          key={entry.summary.iata}
                          className="[content-visibility:auto] [contain-intrinsic-size:auto_14rem]"
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
                        Show more airports
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
              Live result set
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
