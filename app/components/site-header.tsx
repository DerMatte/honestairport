"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleUserRound,
  LogOut,
  Menu,
  Search,
  Settings,
  X,
} from "lucide-react";
import { AirportSearchDialog } from "@/app/components/airport-search-combobox";
import { NearestAirportLink } from "@/app/components/nearest-airport-link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";

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
            showCloseButton={false}
            className="w-full gap-0 border-l-0 p-0 sm:max-w-sm"
          >
            <div className="relative flex h-full flex-col overflow-hidden bg-background">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_right,oklch(0.42_0.15_259_/_0.14),transparent_60%),linear-gradient(180deg,oklch(0.955_0.012_250),transparent)]"
              />

              <SheetHeader className="relative z-10 gap-0 border-b border-border/50 px-5 pt-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <SheetTitle className="font-heading text-2xl font-medium tracking-tight">
                      Menu
                    </SheetTitle>
                    <SheetDescription className="text-sm">
                      Find airports and manage your account.
                    </SheetDescription>
                  </div>
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 rounded-full bg-background/70 shadow-sm ring-1 ring-border/60"
                      aria-label="Close menu"
                    >
                      <X className="size-4" />
                    </Button>
                  </SheetClose>
                </div>
              </SheetHeader>

              <div className="relative z-10 flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
                {isPending ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-card/80 p-3 ring-1 ring-foreground/8">
                    <Skeleton className="size-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ) : session ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-card/90 p-3.5 shadow-sm ring-1 ring-foreground/8">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium tracking-wide text-primary-foreground">
                      {userInitials(session.user.name, session.user.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {session.user.name || "Account"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-card/90 p-4 shadow-sm ring-1 ring-foreground/8">
                    <p className="font-heading text-lg font-medium tracking-tight">
                      Welcome aboard
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sign in to save preferences and leave reviews.
                    </p>
                    <SheetClose asChild>
                      <Button className="mt-4 w-full" asChild>
                        <Link href="/login">Sign in</Link>
                      </Button>
                    </SheetClose>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSearchOpen(true);
                  }}
                  className="group flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-left text-primary-foreground shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.99]"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
                    <Search className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      Search airports
                    </span>
                    <span className="block text-xs text-primary-foreground/75">
                      Scores, tips, and terminal intel
                    </span>
                  </span>
                </button>

                <NearestAirportLink
                  variant="menu"
                  onNavigate={() => setMenuOpen(false)}
                />

                {session ? (
                  <nav className="flex flex-col gap-1.5">
                    <p className="px-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                      Account
                    </p>
                    <SheetClose asChild>
                      <Link
                        href="/settings"
                        className="group flex items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-accent/70"
                      >
                        <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                          <Settings
                            className="size-4 text-foreground/80"
                            aria-hidden="true"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            Settings
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Profile and password
                          </span>
                        </span>
                      </Link>
                    </SheetClose>
                  </nav>
                ) : null}
              </div>

              {session ? (
                <div className="relative z-10 border-t border-border/60 bg-card/40 px-5 py-4">
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                    onClick={handleSignOut}
                  >
                    <LogOut className="size-4" aria-hidden="true" />
                    Sign out
                  </Button>
                </div>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <AirportSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
