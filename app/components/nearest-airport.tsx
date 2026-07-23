import Link from "next/link";
import { MapPin } from "lucide-react";
import { getNearestAirportFromRequest } from "@/lib/nearest-airport";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

/**
 * Small "Near you: XXX" link resolved from Vercel's IP geolocation headers.
 * A React Server Component so the lookup runs during SSR and streams in
 * behind a `<Suspense>` boundary instead of a client-side fetch. Renders
 * nothing until (and unless) a nearby covered airport is found.
 */
export async function NearestAirportHeaderLink({
  className,
}: {
  className?: string;
}) {
  const airport = await getNearestAirportFromRequest();
  if (!airport) return null;

  return (
    <Link
      href={`/airports/${airport.slug}`}
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

export async function NearestAirportSidebarItem() {
  const airport = await getNearestAirportFromRequest();
  if (!airport) return null;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild size="lg" className="h-auto items-start py-2.5">
        <Link href={`/airports/${airport.slug}`} title={airport.name}>
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
