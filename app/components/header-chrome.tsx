"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Menu, Search, X } from "lucide-react";
import { AssistantLauncher } from "@/app/components/assistant-launcher";
import { Button } from "@/components/ui/button";

const AirportSearchDialog = dynamic(
  () =>
    import("@/app/components/airport-search-combobox").then((mod) => ({
      default: mod.AirportSearchDialog,
    })),
  { ssr: false },
);

const MobileNav = dynamic(
  () =>
    import("@/app/components/mobile-nav").then((mod) => ({
      default: mod.MobileNav,
    })),
);

const SCROLL_DELTA = 6;
const TOP_REVEAL_OFFSET = 12;

export function HeaderChrome({
  brand,
  desktopNav,
  nearestAirportSidebarSlot,
  membershipSlot,
}: {
  brand: ReactNode;
  desktopNav: ReactNode;
  nearestAirportSidebarSlot: ReactNode;
  membershipSlot?: ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  function openSearch() {
    setHidden(false);
    setSearchOpen(true);
  }

  function toggleMenu() {
    setHidden(false);
    setMenuOpen((current) => {
      const next = !current;
      if (next) {
        setMenuMounted(true);
      }
      return next;
    });
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

  return (
    <>
      <header
        className="site-header sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md"
        data-hidden={hidden ? "" : undefined}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
          {brand}

          <div className="ml-auto flex items-center gap-1">
            <nav className="mr-1 hidden items-center md:flex">{desktopNav}</nav>

            <Button
              variant="ghost"
              size="sm"
              aria-label="Search airports"
              onClick={openSearch}
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
              onClick={openSearch}
              className="sm:hidden"
            >
              <Search />
            </Button>

            <AssistantLauncher />

            <Button
              variant="ghost"
              size="icon-sm"
              className="relative md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={toggleMenu}
            >
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </header>

      {menuMounted ? (
        <MobileNav
          open={menuOpen}
          onOpenChange={setMenuOpen}
          nearestAirportSlot={nearestAirportSidebarSlot}
          membershipSlot={membershipSlot}
        />
      ) : null}

      {searchOpen ? (
        <AirportSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      ) : null}
    </>
  );
}
