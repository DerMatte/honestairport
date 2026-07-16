"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound, Menu, Search } from "lucide-react";
import { AirportSearchDialog } from "@/app/components/airport-search-combobox";
import { NearestAirportLink } from "@/app/components/nearest-airport-link";
import { Button } from "@/components/ui/button";
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
          <NearestAirportLink className="mr-2" />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Directory</Link>
          </Button>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={handleSignOut}
                >
                  Sign out
                </Button>
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
              <NearestAirportLink
                className="px-4 py-1.5"
                onNavigate={() => setMenuOpen(false)}
              />
              {isPending ? null : session ? (
                <>
                  <p className="truncate px-4 py-1.5 text-sm text-muted-foreground">
                    Signed in as {session.user.email}
                  </p>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={handleSignOut}
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <SheetClose asChild>
                  <Button variant="ghost" className="justify-start" asChild>
                    <Link href="/login">Sign in</Link>
                  </Button>
                </SheetClose>
              )}
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

      <AirportSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
