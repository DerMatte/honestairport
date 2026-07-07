import Link from "next/link";
import { PlaneTakeoff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-muted">
        <PlaneTakeoff className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-6 font-mono text-sm text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        This gate doesn&apos;t exist
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        We couldn&apos;t find that page. The airport you&apos;re looking for may not have a
        guide yet — try searching from the directory instead.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">Back to the directory</Link>
      </Button>
    </div>
  );
}
