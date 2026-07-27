"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCw } from "lucide-react";
import { UtilityPageShell } from "@/app/components/utility-page-shell";
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
    <UtilityPageShell
      code="ERROR"
      eyebrow="System interruption"
      title="Turbulence encountered"
      description="This page didn’t finish loading, but the rest of the directory is still available."
      note="Retry once to re-run the page check. If it fails again, return to the board and choose another route."
      status="Attention required"
      statusTone="error"
    >
      <div className="utility-action-card">
        <p className="utility-action-card__label">Recovery options</p>
        <h2>Run the page check again</h2>
        <p>
          Your place has not been changed. Retrying reloads only the failed
          route.
        </p>
        <div className="utility-action-card__actions">
          <Button onClick={reset}>
            <RotateCw aria-hidden="true" />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Back to the directory
            </Link>
          </Button>
        </div>
      </div>
    </UtilityPageShell>
  );
}
