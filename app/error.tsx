"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-muted">
        <CloudOff className="size-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Turbulence encountered
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Something went wrong while loading this page. You can try again, or head back
        to the directory.
      </p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to the directory</Link>
        </Button>
      </div>
    </div>
  );
}
