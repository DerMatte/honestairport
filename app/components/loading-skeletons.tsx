import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function HeroSkeleton() {
  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <Skeleton className="mt-5 h-24 max-w-4xl rounded-lg" />
        <Skeleton className="mt-4 h-6 max-w-xl" />
        <Skeleton className="mt-6 h-20 max-w-3xl" />
      </div>

      <div className="rounded-xl bg-card p-6 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-16 w-36" />
          </div>
          <Skeleton className="size-14 rounded-3xl" />
        </div>
        <Skeleton className="mt-5 h-10 w-full rounded-2xl" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    </section>
  );
}

export function GoogleRatingSkeleton() {
  return <Skeleton className="mt-4 h-10 w-full rounded-2xl" />;
}

export function PhotoGallerySkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-56" />
      <div className="mt-4 flex gap-4 overflow-hidden">
        <Skeleton className="h-56 w-[72vw] shrink-0 rounded-2xl sm:h-64 sm:w-[460px]" />
        <Skeleton className="h-56 w-[72vw] shrink-0 rounded-2xl sm:h-64 sm:w-[420px]" />
        <Skeleton className="hidden h-64 w-[420px] shrink-0 rounded-2xl lg:block" />
      </div>
    </div>
  );
}

export function TipBentoSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Skeleton className="h-44 rounded-2xl md:col-span-2" />
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl md:col-span-2" />
    </div>
  );
}

export function DetailTabsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-3 overflow-hidden">
        {["overview", "getting", "lounges", "reviews"].map((item) => (
          <Skeleton key={item} className="h-9 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

export function AirportPageSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Skeleton className="h-5 w-28" />
        <HeroSkeleton />
        <div className="mt-10">
          <PhotoGallerySkeleton />
        </div>
        <div className="mt-10">
          <TipBentoSkeleton />
        </div>
        <div className="mt-10">
          <DetailTabsSkeleton />
        </div>
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent),radial-gradient(circle_at_top_left,var(--muted),transparent_34%)]">
      <section className="mx-auto grid max-w-7xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div>
          <Skeleton className="mb-6 h-7 w-72 rounded-full" />
          <Skeleton className="h-36 max-w-4xl rounded-lg" />
          <Skeleton className="mt-6 h-20 max-w-2xl" />
          <Skeleton className="mt-8 h-14 max-w-2xl rounded-2xl" />
        </div>
        <Skeleton className="min-h-[28rem] rounded-2xl" />
      </section>
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <Skeleton className="mb-6 h-16 max-w-2xl" />
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Skeleton className="hidden h-96 rounded-2xl lg:block" />
          <div className="space-y-5">
            <Skeleton className="h-20 rounded-2xl" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }, (_, index) => (
                <Skeleton key={index} className="h-56 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
