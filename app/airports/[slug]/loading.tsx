import { Skeleton } from "@/components/ui/skeleton";

export default function AirportLoading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <Skeleton className="h-5 w-28" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="mt-5 h-24 max-w-4xl" />
          <Skeleton className="mt-4 h-6 max-w-xl" />
          <Skeleton className="mt-6 h-20 max-w-3xl" />
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    </div>
  );
}
