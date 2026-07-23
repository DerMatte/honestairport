"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ChevronsUpDown,
  Compass,
  LogIn,
  LogOut,
  Settings,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
 * Mobile nav content modeled on shadcn sidebar-03 (header + grouped nav),
 * with a NavUser-style account switcher pinned to the footer.
 */
export function SiteSidebar({
  user,
  isPending,
  onNavigate,
  onSignOut,
  nearestAirportSlot,
}: {
  user: SiteSidebarUser | null;
  isPending: boolean;
  onNavigate: () => void;
  onSignOut: () => void;
  nearestAirportSlot: ReactNode;
}) {
  return (
    <Sidebar
      collapsible="none"
      className="relative h-full w-full border-0 bg-transparent text-sidebar-foreground"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_right,oklch(0.42_0.15_259_/_0.16),transparent_60%),linear-gradient(180deg,oklch(0.955_0.012_250),transparent)]"
      />

      <SidebarContent className="relative z-10">
        <SidebarGroup>
          <SidebarGroupLabel>Explore</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                size="lg"
                className="h-auto items-start py-2.5"
              >
                <Link href="/" onClick={onNavigate}>
                  <div className="flex aspect-square size-9 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground">
                    <Compass className="size-4" aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                    <span className="font-medium">Browse airports</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      Scores, tips & traveler intel
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {nearestAirportSlot}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="relative z-10 border-t border-sidebar-border/60 pt-3">
        {isPending ? (
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ) : user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="h-auto py-2 data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  >
                    <Avatar size="lg" className="shrink-0">
                      <AvatarFallback className="bg-sidebar-primary text-sm font-medium tracking-wide text-sidebar-primary-foreground">
                        {userInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-none">
                      <span className="truncate font-medium">
                        {user.name || "Account"}
                      </span>
                      <span className="truncate text-xs text-sidebar-foreground/60">
                        {user.email}
                      </span>
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="end"
                  sideOffset={8}
                  className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
                >
                  <DropdownMenuLabel className="flex items-center gap-2 py-1.5 font-normal">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary text-[10px] font-medium text-primary-foreground">
                        {userInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate text-sm font-medium text-foreground">
                        {user.name || "Account"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" onClick={onNavigate}>
                      <Settings aria-hidden="true" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onSignOut}>
                    <LogOut aria-hidden="true" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <Button className="h-11 w-full justify-center gap-2" asChild>
            <Link href="/login" onClick={onNavigate}>
              <LogIn className="size-4" aria-hidden="true" />
              Sign in
            </Link>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
