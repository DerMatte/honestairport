"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { AirportSearchDialog } from "@/app/components/airport-search-combobox";
import { useAirportSearchList } from "@/app/components/airport-search-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function SiteHeader() {
  const airports = useAirportSearchList();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Directory</Link>
          </Button>
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
          <SheetContent side="right" className="w-full sm:max-w-sm">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>

            <nav className="flex flex-col gap-1 px-4">
              <SheetClose asChild>
                <Button variant="ghost" className="justify-start" asChild>
                  <Link href="/">Airport directory</Link>
                </Button>
              </SheetClose>
            </nav>

            <Separator className="my-2" />

            <div className="px-4 pb-4">
              <Button
                variant="outline"
                className="h-11 w-full justify-start gap-2 text-muted-foreground"
                onClick={() => {
                  setMenuOpen(false);
                  setSearchOpen(true);
                }}
              >
                <Search className="size-4" aria-hidden="true" />
                Search airports…
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <AirportSearchDialog
        airports={airports}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </>
  );
}
