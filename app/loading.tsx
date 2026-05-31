import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <Skeleton className="h-6 w-48 rounded-full" />
      <Skeleton className="mt-6 h-20 max-w-3xl" />
      <Skeleton className="mt-4 h-6 max-w-xl" />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {["one", "two", "three"].map((item) => (
          <Skeleton key={item} className="h-72 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
