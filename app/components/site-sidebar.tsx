"use client";

import Link from "next/link";
import {
  LogOut,
  MapPin,
  Plane,
  Search,
  Settings,
} from "lucide-react";
import { useNearestAirport } from "@/app/components/nearest-airport-link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

interface SiteSidebarUser {
  name: string;
  email: string;
}

function userInitials(name: string | null | undefined, email: string) {
  const fromName = name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  if (fromName) return fromName;
  return email.slice(0, 2).toUpperCase();
}

/**
 * Mobile nav content modeled on shadcn sidebar-03 (header + grouped submenus),
 * with HonestAirport destinations and account actions.
 */
export function SiteSidebar({
  user,
  isPending,
  onSearch,
  onNavigate,
  onSignOut,
}: {
  user: SiteSidebarUser | null;
  isPending: boolean;
  onSearch: () => void;
  onNavigate: () => void;
  onSignOut: () => void;
}) {
  const nearest = useNearestAirport();

  return (
    <Sidebar
      collapsible="none"
      className="relative h-full w-full border-0 bg-transparent text-sidebar-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_right,oklch(0.42_0.15_259_/_0.16),transparent_60%),linear-gradient(180deg,oklch(0.955_0.012_250),transparent)]"
      />

      <SidebarHeader className="relative z-10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" onClick={onNavigate}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Plane className="size-4 -rotate-45" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-heading text-base font-medium tracking-tight">
                    HonestAirport
                  </span>
                  <span className="text-xs text-sidebar-foreground/70">
                    Scores & traveler tips
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="relative z-10">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="font-medium">
                Explore
              </SidebarMenuButton>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild size="md">
                    <button type="button" onClick={onSearch}>
                      <Search aria-hidden="true" />
                      <span>Search airports</span>
                    </button>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {nearest ? (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild size="md">
                      <Link
                        href={`/airports/${nearest.slug}`}
                        onClick={onNavigate}
                        title={nearest.name}
                      >
                        <MapPin aria-hidden="true" />
                        <span>Near you · {nearest.iata}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ) : null}
              </SidebarMenuSub>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton className="font-medium">
                Account
              </SidebarMenuButton>
              <SidebarMenuSub>
                {isPending ? (
                  <SidebarMenuSubItem>
                    <div className="flex h-7 items-center px-2">
                      <Skeleton className="h-4 w-28" />
                    </div>
                  </SidebarMenuSubItem>
                ) : user ? (
                  <>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild size="md">
                        <Link href="/settings" onClick={onNavigate}>
                          <Settings aria-hidden="true" />
                          <span>Settings</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild size="md">
                        <button type="button" onClick={onSignOut}>
                          <LogOut aria-hidden="true" />
                          <span>Sign out</span>
                        </button>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </>
                ) : (
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild size="md" isActive>
                      <Link href="/login" onClick={onNavigate}>
                        <span>Sign in</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {user ? (
        <SidebarFooter className="relative z-10">
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className="h-auto items-start py-2.5"
                asChild
              >
                <Link href="/settings" onClick={onNavigate}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-medium tracking-wide text-sidebar-primary-foreground">
                    {userInitials(user.name, user.email)}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                    <span className="truncate font-medium">
                      {user.name || "Account"}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/70">
                      {user.email}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      ) : null}
    </Sidebar>
  );
}
