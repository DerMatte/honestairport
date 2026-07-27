"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import {
  Filter,
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
import { Card, CardContent } from "@/components/ui/card";
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
  SheetDescription,
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

interface GuideDirectoryEntry {
  summary: AirportSummary;
  normalized: Record<AirportSearchScope, string>;
}

const INITIAL_VISIBLE = 12;
const LOAD_MORE_STEP = 12;

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
    <div className="space-y-7 px-5 pb-8">
      <div className="flex items-center justify-between gap-3 border-b pb-4">
        <span className="flex items-center gap-2 font-heading text-lg font-semibold">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Tune the board
        </span>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <Label>Minimum Airportist Score</Label>
          <span className="skeuo-counter">{filters.minimumScore.toFixed(1)}</span>
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
        <Label className="skeuo-label">Region</Label>
        <div className="grid grid-cols-2 gap-2">
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
        <Label className="skeuo-label">Amenities</Label>
        <div className="grid grid-cols-2 gap-2">
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
        <Label className="skeuo-label">Current disruption</Label>
        <div className="flex flex-wrap gap-2">
          {disruptionStatuses.map((status) => (
            <label key={status} className="flex items-center gap-2 text-sm">
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
    </div>
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
    <div className="flex h-full min-h-80 flex-col items-center justify-center gap-4 bg-[#dbe1e3] px-6 text-center">
      <div className="skeuo-app-icon">
        <MapIcon className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p className="font-heading text-xl font-semibold">
          {count} scored airports ready to map
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The map stays unloaded until you ask for it.
        </p>
      </div>
      <Button onClick={onLoad}>Load airport map</Button>
    </div>
  );
}

export function AirportDirectory({
  scoredAirports,
  allAirports,
}: AirportDirectoryProps) {
  const [filters, setFilters] = useState<AirportFilters>(DEFAULT_FILTERS);
  const deferredFilters = useDeferredValue(filters);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
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
      .filter(
        (entry) =>
          !normalizedQuery || entry.normalized[scope].includes(normalizedQuery),
      )
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
      const aDate =
        a.kind === "scored" ? a.airport.guideLastUpdated : a.summary.lastUpdated;
      const bDate =
        b.kind === "scored" ? b.airport.guideLastUpdated : b.summary.lastUpdated;
      const aName = a.kind === "scored" ? a.airport.name : a.summary.name;
      const bName = b.kind === "scored" ? b.airport.name : b.summary.name;
      return compareGuideRecency(aDate, bDate, aName, bName);
    });
  }, [filteredScored, filteredGuides, deferredFilters.sort]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEntries.length;
  const boardAnimationKey = JSON.stringify({
    amenities: deferredFilters.amenities,
    disruptionStatuses: deferredFilters.disruptionStatuses,
    minimumScore: deferredFilters.minimumScore,
    regions: deferredFilters.regions,
    sort: deferredFilters.sort,
  });
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

  function toggleMap() {
    setMapOpen((current) => !current);
  }

  return (
    <section aria-labelledby="directory-heading" className="pb-16 sm:pb-24">
      <div className="mx-auto max-w-[94rem] px-3 sm:px-6">
        <div className="skeuo-console">
          <div className="skeuo-console__top">
            <div>
              <p className="skeuo-label">HonestAirport master board</p>
              <h2 id="directory-heading">
                {allAirports.length} airports, one honest timetable
              </h2>
            </div>
            <div className="skeuo-status-light">
              <span aria-hidden="true" />
              Board online
            </div>
          </div>

          <div className="skeuo-control-deck">
            <div className="min-w-0 flex-1">
              <AirportDirectorySearch
                filters={filters}
                onFiltersChange={updateFilters}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="skeuo-button">
                    <Filter className="size-4" aria-hidden="true" />
                    Filters
                    {activeFilterCount > 0 ? (
                      <span className="skeuo-button__count">
                        {activeFilterCount}
                      </span>
                    ) : null}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[min(92vw,28rem)] overflow-y-auto border-l-[#8d969a] bg-[#eef1f2] p-0 text-[#202628]"
                >
                  <SheetHeader className="px-5 pt-6 pb-4">
                    <SheetTitle>Board filters</SheetTitle>
                    <SheetDescription>
                      Narrow airports by score, region, amenities, or current
                      disruption.
                    </SheetDescription>
                  </SheetHeader>
                  <FilterPanel
                    filters={filters}
                    onFiltersChange={updateFilters}
                    onReset={resetFilters}
                  />
                </SheetContent>
              </Sheet>

              <Select
                value={filters.sort}
                onValueChange={(value) =>
                  updateFilters({ ...filters, sort: value as AirportSort })
                }
              >
                <SelectTrigger
                  className="skeuo-select w-44"
                  aria-label="Sort airports"
                >
                  <SelectValue placeholder="Sort airports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="highest-score">Highest score</SelectItem>
                  <SelectItem value="most-reviewed">Most reviewed</SelectItem>
                  <SelectItem value="least-disruptions">
                    Least disruptions
                  </SelectItem>
                  <SelectItem value="newest-guides">Newest guides</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant={mapOpen ? "default" : "outline"}
                className="skeuo-button"
                onClick={toggleMap}
                aria-expanded={mapOpen}
              >
                <MapIcon className="size-4" aria-hidden="true" />
                {mapOpen ? "Hide map" : "Map"}
              </Button>
            </div>
          </div>

          <div className="skeuo-console__readout" aria-live="polite">
            <span>
              Showing {filteredEntries.length} airport
              {filteredEntries.length === 1 ? "" : "s"}
            </span>
            <span>
              {activeFilterCount > 0
                ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                : "All systems / all guides"}
            </span>
          </div>

          {mapOpen ? (
            <div className="skeuo-map-well">
              {mapMounted ? (
                <LazyAirportMap airports={filteredScored} />
              ) : (
                <MapPlaceholder
                  count={filteredScored.length}
                  onLoad={() => setMapMounted(true)}
                />
              )}
            </div>
          ) : null}

          <div className="airport-board">
            <div className="airport-board-heading">
              <span>No.</span>
              <span>Code</span>
              <span>Airport</span>
              <span>City / country</span>
              <span>Score</span>
              <span>Status</span>
              <span aria-hidden="true" />
            </div>

            {hasDataFilters && otherAirports.length > 0 ? (
              <p className="airport-board-notice">
                Guide-only airports are hidden while data filters are active.
              </p>
            ) : null}

            {filteredEntries.length === 0 ? (
              <Card className="m-3 border-dashed bg-[#1c201f] text-white">
                <CardContent className="flex flex-col items-center px-6 py-14 text-center">
                  <Search
                    className="size-6 text-board-amber"
                    aria-hidden="true"
                  />
                  <h3 className="mt-4 font-heading text-2xl font-semibold">
                    No matching airport
                  </h3>
                  <p className="mt-2 max-w-md text-sm text-white/60">
                    Try another airport, city, or country, or clear the active
                    filters.
                  </p>
                  <Button className="mt-5" onClick={resetFilters}>
                    Reset board
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div key={boardAnimationKey}>
                {visibleEntries.map((entry, index) =>
                  entry.kind === "scored" ? (
                    <AirportCard
                      key={entry.airport.iata}
                      airport={entry.airport}
                      sequence={index + 1}
                    />
                  ) : (
                    <AirportGuideCard
                      key={entry.summary.iata}
                      airport={entry.summary}
                      sequence={index + 1}
                    />
                  ),
                )}
              </div>
            )}
          </div>

          {hasMore ? (
            <div className="skeuo-console__footer">
              <Button
                variant="outline"
                className="skeuo-button"
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
        </div>
      </div>
    </section>
  );
}
