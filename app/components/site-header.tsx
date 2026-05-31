"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { AirportSearchPanel } from "@/app/components/airport-search-panel";
import { Button } from "@/components/ui/button";
import type { Airport } from "@/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface SiteHeaderProps {
  airports: Airport[];
}

export function SiteHeader({ airports }: SiteHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="ml-auto flex items-center gap-1">
      <nav className="mr-1 hidden items-center md:flex">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Directory</Link>
        </Button>
      </nav>

      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Search airports">
            <Search />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-80 p-0 sm:w-96">
          <AirportSearchPanel
            airports={airports}
            autoFocus
            onSelect={() => setSearchOpen(false)}
          />
        </PopoverContent>
      </Popover>

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

          <div className="px-2 pb-4">
            <p className="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Search
            </p>
            <AirportSearchPanel
              airports={airports}
              onSelect={() => setMenuOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
