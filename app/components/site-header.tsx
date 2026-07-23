"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound, Menu, Plane, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { AssistantLauncher } from "@/app/components/assistant-launcher";
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

const AirportSearchDialog = dynamic(
  () =>
    import("@/app/components/airport-search-combobox").then((mod) => ({
      default: mod.AirportSearchDialog,
    })),
  { ssr: false },
);

const SCROLL_DELTA = 6;
const TOP_REVEAL_OFFSET = 12;

export function SiteHeader() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const shouldReduceMotion = useReducedMotion();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

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

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    function updateVisibility() {
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastScrollY.current;

      if (currentY <= TOP_REVEAL_OFFSET) {
        setHidden(false);
      } else if (delta > SCROLL_DELTA) {
        setHidden(true);
      } else if (delta < -SCROLL_DELTA) {
        setHidden(false);
      }

      lastScrollY.current = currentY;
      ticking.current = false;
    }

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(updateVisibility);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keep the bar visible while menus/search are open so controls stay reachable.
  useEffect(() => {
    if (searchOpen || menuOpen) {
      setHidden(false);
    }
  }, [searchOpen, menuOpen]);

  return (
    <>
      <motion.header
        className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md"
        data-hidden={hidden ? "" : undefined}
        initial={false}
        animate={{ y: hidden && !shouldReduceMotion ? "-100%" : 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: "tween", duration: 0.3, ease: [0.23, 1, 0.32, 1] }
        }
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Plane className="size-4 -rotate-45" aria-hidden="true" />
            </span>
            <span className="font-heading text-xl font-medium tracking-tight">
              HonestAirport
            </span>
          </Link>

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
                    <p className="truncate text-sm font-medium">
                      {session.user.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {session.user.email}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        asChild
                      >
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

            <AssistantLauncher />

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
        </div>
      </motion.header>

      {searchOpen ? (
        <AirportSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      ) : null}
    </>
  );
}
