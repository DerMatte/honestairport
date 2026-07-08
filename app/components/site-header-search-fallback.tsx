import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function SiteHeaderSearchFallback() {
  return (
    <div className="ml-auto flex items-center gap-1">
      <nav className="mr-1 hidden items-center md:flex">
        <Button variant="ghost" size="sm" disabled>
          Directory
        </Button>
      </nav>

      <Button
        variant="ghost"
        size="sm"
        disabled
        aria-hidden="true"
        className="hidden gap-2 text-muted-foreground sm:inline-flex"
      >
        <Search className="size-4" />
        Search
        <Skeleton className="hidden h-5 w-8 rounded-md md:inline-block" />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        disabled
        aria-hidden="true"
        className="sm:hidden"
      >
        <Search />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        disabled
        aria-hidden="true"
        className="md:hidden"
      >
        <Menu />
      </Button>
    </div>
  );
}
