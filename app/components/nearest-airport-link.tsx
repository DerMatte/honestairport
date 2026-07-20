"use client";

import { Suspense, use } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import {
  NearestAirportLinkSkeleton,
  NearestAirportSidebarSkeleton,
} from "@/app/components/nearest-airport-skeletons";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export interface NearestAirport {
  iata: string;
  slug: string;
  city: string;
  name: string;
}

const STORAGE_KEY = "nearest-airport";

let nearestPromise: Promise<NearestAirport | null> | null = null;

function readSessionCache(): NearestAirport | null | undefined {
  try {
    const cached = sessionStorage.getItem(STORAGE_KEY);
    if (cached !== null) return JSON.parse(cached) as NearestAirport | null;
  } catch {
    // unavailable
  }
  return undefined;
}

function writeSessionCache(data: NearestAirport | null) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // best-effort
  }
}

async function fetchNearestAirport(): Promise<NearestAirport | null> {
  const response = await fetch("/api/airports/nearest");
  if (!response.ok) return null;
  return (await response.json()) as NearestAirport | null;
}

export function getNearestAirport(): Promise<NearestAirport | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (!nearestPromise) {
    const cached = readSessionCache();
    nearestPromise =
      cached !== undefined
        ? Promise.resolve(cached)
        : fetchNearestAirport()
            .then((data) => {
              writeSessionCache(data);
              return data;
            })
            .catch(() => null);
  }
  return nearestPromise;
}

function NearestAirportLinkInner({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const airport = use(getNearestAirport());
  if (!airport) return null;

  return (
    <Link
      href={`/airports/${airport.slug}`}
      onClick={onNavigate}
      title={airport.name}
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <MapPin className="size-3" aria-hidden="true" />
      <span>
        Near you:{" "}
        <span className="font-medium text-foreground">{airport.iata}</span>
      </span>
    </Link>
  );
}

/**
 * Small "Near you: XXX" link resolved from Vercel's IP geolocation headers.
 * Renders nothing until (and unless) a nearby covered airport is found.
 */
export function NearestAirportLink(props: {
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <Suspense
      fallback={<NearestAirportLinkSkeleton className={props.className} />}
    >
      <NearestAirportLinkInner {...props} />
    </Suspense>
  );
}

function NearestAirportSidebarItemInner({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  const airport = use(getNearestAirport());
  if (!airport) return null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild size="lg" className="h-auto items-start py-2.5">
        <Link
          href={`/airports/${airport.slug}`}
          onClick={onNavigate}
          title={airport.name}
        >
          <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground">
            <MapPin className="size-4" aria-hidden="true" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 leading-none">
            <span className="font-medium">Near you · {airport.iata}</span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {airport.city}
            </span>
          </div>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NearestAirportSidebarItem({
  onNavigate,
}: {
  onNavigate: () => void;
}) {
  return (
    <Suspense fallback={<NearestAirportSidebarSkeleton />}>
      <NearestAirportSidebarItemInner onNavigate={onNavigate} />
    </Suspense>
  );
}
