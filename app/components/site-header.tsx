"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound, Menu, Search } from "lucide-react";
import { AirportSearchDialog } from "@/app/components/airport-search-combobox";
import { LazyNearestAirportLink } from "@/app/components/nearest-airport-lazy";
import { SiteSidebar } from "@/app/components/site-sidebar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";

export function SiteHeader() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
    router.refresh();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className="ml-auto flex items-center gap-1">
        <nav className="mr-1 hidden items-center md:flex">
          <LazyNearestAirportLink className="mr-2" />
          {isPending ? (
            <Skeleton className="h-8 w-[72px]" />
          ) : session ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <CircleUserRound className="size-4" aria-hidden="true" />
                  Account
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <p className="truncate text-sm font-medium">{session.user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {session.user.email}
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href="/settings">Settings</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={handleSignOut}
                  >
                    Sign out
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </nav>

        <Button
          variant="ghost"
          size="sm"
          aria-label="Search airports"
          onClick={() => setSearchOpen(true)}
          className="hidden gap-2 text-muted-foreground sm:inline-flex"
        >
          <Search className="size-4" aria-hidden="true" />
          Search
          <kbd className="pointer-events-none hidden rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
            ⌘K
          </kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Search airports"
          onClick={() => setSearchOpen(true)}
          className="sm:hidden"
        >
          <Search />
        </Button>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open menu"
            >
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            showCloseButton={true}
            className="w-(--sidebar-width) border-l-0 bg-sidebar p-0 text-sidebar-foreground [&>button]:z-20"
            style={
              {
                "--sidebar-width": "18rem",
              } as CSSProperties
            }
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
              <SheetDescription>
                Find airports and manage your account.
              </SheetDescription>
            </SheetHeader>
            <SidebarProvider className="h-full w-full !min-h-0">
              <SiteSidebar
                user={
                  session
                    ? {
                        name: session.user.name,
                        email: session.user.email,
                      }
                    : null
                }
                isPending={isPending}
                onNavigate={() => setMenuOpen(false)}
                onSignOut={handleSignOut}
              />
            </SidebarProvider>
          </SheetContent>
        </Sheet>
      </div>

      <AirportSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
