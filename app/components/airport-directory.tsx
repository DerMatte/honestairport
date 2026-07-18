"use client";

import { useMemo, useState } from "react";
import { Filter, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { AirportDirectorySearch } from "@/app/components/airport-search-combobox";
import { AirportCard, AirportGuideCard } from "@/app/components/airport-card";
import { usePanelRef, type PanelSize } from "react-resizable-panels";
import { AirportMap } from "@/app/components/airport-map";
import { AirportMapSection } from "@/app/components/airport-map-section";
import { LazyAirportMap } from "@/app/components/airport-map-lazy";
import { DisruptionBadge } from "@/app/components/disruption-status";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/use-mobile";
import { Slider } from "@/components/ui/slider";
import {
  amenityCategories,
  amenityLabel,
  disruptionStatuses,
  filterAndSortAirports,
  regions,
} from "@/lib/airport-utils";
import { normalizeSearchValue } from "@/lib/airport-search-utils";
import type { AirportSummary } from "@/lib/airport-content";
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
  scoredAirports: Airport[];
  allAirports: AirportSummary[];
}

type DirectoryEntry =
  | { kind: "scored"; airport: Airport }
  | { kind: "guide"; summary: AirportSummary };

function matchesGuideQuery(
  summary: AirportSummary,
  normalizedQuery: string,
  scope: AirportSearchScope,
): boolean {
  if (!normalizedQuery) return true;

  const fields =
    scope === "city"
      ? [summary.city]
      : scope === "country"
        ? [summary.country]
        : [summary.name, summary.iata, summary.city, summary.country];

  return normalizeSearchValue(fields.join(" ")).includes(normalizedQuery);
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

export function AirportDirectory({ scoredAirports, allAirports }: AirportDirectoryProps) {
  const [filters, setFilters] = useState<AirportFilters>(DEFAULT_FILTERS);
  const [mapOpen, setMapOpen] = useState(false);
  const [desktopMapMounted, setDesktopMapMounted] = useState(false);
  const isDesktop = useIsDesktop();
  const mapPanelRef = usePanelRef();

  function handleMapPanelResize(size: PanelSize) {
    // Latches on first reveal so the map chunk loads once and the map then
    // survives the panel being dragged shut again.
    if (size.asPercentage > 0) setDesktopMapMounted(true);
  }

  function openMapSection() {
    if (isDesktop) {
      mapPanelRef.current?.resize("42%");
      return;
    }
    setMapOpen(true);
    requestAnimationFrame(() => {
      document
        .getElementById("airport-map")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const otherAirports = useMemo(() => {
    const scoredIatas = new Set(scoredAirports.map((airport) => airport.iata));
    return allAirports.filter((summary) => !scoredIatas.has(summary.iata));
  }, [allAirports, scoredAirports]);

  const hasDataFilters =
    filters.minimumScore > 0 ||
    filters.regions.length > 0 ||
    filters.amenities.length > 0 ||
    filters.disruptionStatuses.length > 0;

  const filteredScored = useMemo(
    () => filterAndSortAirports(scoredAirports, filters),
    [scoredAirports, filters],
  );

  // Region, amenity, score, and disruption data only exists for scored airports,
  // so guide-only entries drop out of the results while those filters are active
  // rather than silently pretending to match.
  const filteredGuides = useMemo(() => {
    if (hasDataFilters) return [];
    const normalizedQuery = normalizeSearchValue(filters.query);
    return otherAirports
      .filter((summary) => matchesGuideQuery(summary, normalizedQuery, filters.searchScope))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [otherAirports, filters, hasDataFilters]);

  const filteredEntries: DirectoryEntry[] = useMemo(
    () => [
      ...filteredScored.map((airport) => ({ kind: "scored" as const, airport })),
      ...filteredGuides.map((summary) => ({ kind: "guide" as const, summary })),
    ],
    [filteredScored, filteredGuides],
  );

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
    // overflow-visible overrides (style beats the library's inline defaults)
    // let the desktop map panel's sticky positioning track the page scroll.
    <ResizablePanelGroup
      orientation="horizontal"
      disabled={!isDesktop}
      style={{ overflow: "visible" }}
    >
      <ResizablePanel
        id="directory-content"
        minSize="40"
        style={{ overflow: "visible" }}
      >
        <div className="min-h-screen">
          <section className="relative overflow-hidden border-b border-border/40">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-30%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_55%),radial-gradient(circle_at_92%_8%,color-mix(in_oklab,var(--chart-2)_20%,transparent),transparent_38%),radial-gradient(circle_at_0%_85%,color-mix(in_oklab,var(--muted)_90%,transparent),transparent_40%),linear-gradient(180deg,color-mix(in_oklab,var(--background)_55%,white)_0%,var(--background)_100%)]"
        />
        <div
          aria-hidden="true"
          className="hero-aurora pointer-events-none absolute -left-[18%] top-[-28%] h-[78%] w-[72%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_68%)] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="hero-aurora pointer-events-none absolute -right-[12%] bottom-[-18%] h-[62%] w-[58%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--chart-2)_18%,transparent),transparent_70%)] blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-24 lg:pb-28">
          <div className="flex flex-col justify-center">
            <h1 className="hero-enter max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-balance text-foreground sm:text-5xl lg:text-6xl">
              Honest airport reviews - get through every one with speed
            </h1>
            <p className="hero-enter hero-enter-delay-1 mt-5 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Search major airports, compare disruption risk, and read practical
              Traveler Tips before you get there.
            </p>

            <div className="hero-enter hero-enter-delay-2 mt-9 max-w-xl">
              <AirportDirectorySearch filters={filters} onFiltersChange={updateFilters} />
            </div>
          </div>

          <AirportMap
            airports={scoredAirports}
            variant="hero"
            onExplore={openMapSection}
          />
        </div>
      </section>

      <AirportMapSection
        airports={scoredAirports}
        open={mapOpen}
        onOpenChange={setMapOpen}
      />

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-6">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            Airport directory
          </p>
          <h2 className="mt-1 text-2xl tracking-tight sm:text-3xl">
            All {allAirports.length} airports we cover
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Our {scoredAirports.length} most deeply audited airports carry a full
            Airportist Score — filter those by region, amenities, and live
            disruption risk. Every other guide in our index is listed alongside
            them.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
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
                  {filteredEntries.length} airport
                  {filteredEntries.length === 1 ? "" : "s"} found
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`
                    : `Showing all ${allAirports.length} airports`}
                </p>
                {hasDataFilters && otherAirports.length > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {otherAirports.length} guide-only airports don&apos;t have
                    region, amenity, or disruption data yet, so they&apos;re
                    hidden while these filters are active.
                  </p>
                ) : null}
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

            {filteredEntries.length === 0 ? (
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
                {filteredEntries.map((entry) =>
                  entry.kind === "scored" ? (
                    <AirportCard key={entry.airport.iata} airport={entry.airport} />
                  ) : (
                    <AirportGuideCard key={entry.summary.iata} airport={entry.summary} />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </section>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle className="hidden lg:flex" />
      <ResizablePanel
        id="airport-map-panel"
        collapsible
        defaultSize={0}
        minSize={360}
        maxSize="60"
        panelRef={mapPanelRef}
        onResize={handleMapPanelResize}
        className="h-full"
        style={{ overflow: "visible" }}
      >
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden border-l border-border/60">
          {desktopMapMounted ? <LazyAirportMap airports={scoredAirports} /> : null}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
