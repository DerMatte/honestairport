"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface NearestAirport {
  iata: string;
  slug: string;
  city: string;
  name: string;
}

const STORAGE_KEY = "nearest-airport";

/**
 * Small "Near you: XXX" link resolved from Vercel's IP geolocation headers.
 * Renders nothing until (and unless) a nearby covered airport is found.
 */
export function NearestAirportLink({
  className,
  onNavigate,
  variant = "inline",
}: {
  className?: string;
  onNavigate?: () => void;
  variant?: "inline" | "menu";
}) {
  const [airport, setAirport] = useState<NearestAirport | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveNearest(): Promise<NearestAirport | null> {
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) return JSON.parse(cached);
      } catch {
        // sessionStorage unavailable — fall through to the fetch.
      }

      const response = await fetch("/api/airports/nearest");
      const data: NearestAirport | null = response.ok
        ? await response.json()
        : null;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Best-effort cache only.
      }
      return data;
    }

    resolveNearest()
      .then((data) => {
        if (!cancelled && data) setAirport(data);
      })
      .catch(() => {
        // No geo available (e.g. local dev) — stay hidden.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!airport) return null;

  if (variant === "menu") {
    return (
      <Link
        href={`/airports/${airport.slug}`}
        onClick={onNavigate}
        title={airport.name}
        className={cn(
          "group flex items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-accent/70",
          className,
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <MapPin className="size-4 text-foreground/80" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            Near you · {airport.iata}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {airport.city}
          </span>
        </span>
      </Link>
    );
  }

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
