"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, LogIn, MapPin, Plane, RotateCw, Sparkles } from "lucide-react";
import { AirportGuideArticle } from "@/app/components/airport-guide-article";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { extractGuideSaveMarker, extractStreamableGuideBody } from "@/lib/airport-guide-markdown";
import type { AirportRecord } from "@/lib/airports";

interface AirportGeneratingViewProps {
  record: AirportRecord;
}

type GenerationStatus =
  | "checking-auth"
  | "needs-signin"
  | "starting"
  | "streaming"
  | "saving"
  | "done"
  | "error";

export function AirportGeneratingView({ record }: AirportGeneratingViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending: sessionPending } = useSession();
  const [status, setStatus] = useState<GenerationStatus>("checking-auth");
  const [streamedMarkdown, setStreamedMarkdown] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const startedAttemptRef = useRef(-1);

  useEffect(() => {
    if (sessionPending) {
      setStatus("checking-auth");
      return;
    }

    if (!session) {
      setStatus("needs-signin");
      startedAttemptRef.current = -1;
      return;
    }

    if (startedAttemptRef.current === attempt) {
      return;
    }
    startedAttemptRef.current = attempt;

    const controller = new AbortController();

    async function generateGuide() {
      setStatus("starting");
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/airports/${record.iata_code}/generate`, {
          method: "POST",
          signal: controller.signal,
        });

        if (response.status === 409) {
          router.refresh();
          return;
        }

        if (response.status === 401) {
          setStatus("needs-signin");
          return;
        }

        if (!response.ok) {
          let message = "Guide generation failed. Please try again.";
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload.error) {
              message = payload.error;
            }
          } catch {
            // Response body may not be JSON.
          }
          setErrorMessage(message);
          setStatus("error");
          return;
        }

        if (!response.body) {
          setErrorMessage("Guide generation returned an empty response.");
          setStatus("error");
          return;
        }

        setStatus("streaming");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          accumulated += decoder.decode(value, { stream: true });
          setStreamedMarkdown(accumulated);
        }

        accumulated += decoder.decode();
        setStreamedMarkdown(accumulated);

        // The route appends a trailing marker once it knows whether the
        // guide actually made it into the database — the visible text can
        // finish streaming well before that save (or its failure) happens.
        const { outcome } = extractGuideSaveMarker(accumulated);

        if (outcome?.status === "ok") {
          setStatus("saving");
          window.setTimeout(() => {
            setStatus("done");
            router.refresh();
          }, 1200);
          return;
        }

        setErrorMessage(
          outcome?.status === "error"
            ? outcome.message
            : "Guide generation finished, but we couldn't confirm it was saved.",
        );
        setStatus("error");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Guide generation failed. Please try again.",
        );
        setStatus("error");
      }
    }

    void generateGuide();

    return () => {
      controller.abort();
    };
  }, [attempt, record.iata_code, router, session, sessionPending]);

  function retry() {
    setStreamedMarkdown("");
    setErrorMessage(null);
    setStatus("starting");
    setAttempt((value) => value + 1);
  }

  const displayBody = extractStreamableGuideBody(extractGuideSaveMarker(streamedMarkdown).body);
  const isWaitingForContent =
    status === "checking-auth" ||
    status === "starting" ||
    (status === "streaming" && !displayBody.trim());
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All airports
        </Link>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {record.iata_code}
              </Badge>
              {record.icao_code ? (
                <Badge variant="outline" className="font-mono">
                  {record.icao_code}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="rounded-full">
                <Sparkles className="mr-1 size-3" aria-hidden="true" />
                {status === "needs-signin" ? "Guide available on request" : "Generating guide"}
              </Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-5xl leading-[1.06] tracking-tight text-balance sm:text-6xl">
              {record.name}
            </h1>
            <p className="mt-4 flex items-center gap-2 text-lg text-muted-foreground">
              <MapPin className="size-5" aria-hidden="true" />
              {record.city_name}, {record.iata_country_code}
            </p>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-muted-foreground">
              {status === "needs-signin"
                ? "This airport does not have a guide yet. Sign in to request on-demand research and writing — it streams in live and is saved for everyone."
                : "We are researching and writing a practical guide for this airport right now. The content streams in live and is saved for future visits."}
            </p>
          </div>

          <Card className="border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
            <CardContent className="p-6">
              {status === "needs-signin" ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="mt-1 text-sm font-medium">Sign in required</div>
                    </div>
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-3xl bg-primary text-primary-foreground">
                      <LogIn className="size-6" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    On-demand guide generation is limited to signed-in accounts to prevent abuse.
                  </p>
                  <Button asChild className="gap-2">
                    <Link href={loginHref}>
                      <LogIn className="size-3.5" aria-hidden="true" />
                      Sign in to generate
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Status</div>
                      <div className="mt-1 text-sm font-medium">
                        {status === "checking-auth" && "Checking account…"}
                        {status === "starting" && "Starting research…"}
                        {status === "streaming" && "Writing guide…"}
                        {status === "saving" && "Saving to database…"}
                        {status === "done" && "Guide ready — refreshing page…"}
                        {status === "error" && "Generation failed"}
                      </div>
                    </div>
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-3xl bg-primary text-primary-foreground">
                      {status === "error" ? (
                        <Plane className="size-6" aria-hidden="true" />
                      ) : (
                        <span
                          className="flex size-6 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        >
                          <Loader2 className="size-full" />
                        </span>
                      )}
                    </div>
                  </div>

                  {errorMessage ? (
                    <div className="mt-5 space-y-3">
                      <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        {errorMessage}
                      </p>
                      <Button variant="outline" size="sm" onClick={retry} className="gap-2">
                        <RotateCw className="size-3.5" aria-hidden="true" />
                        Try again
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-5 text-sm leading-6 text-muted-foreground">
                      First visit triggers on-demand generation. Once complete, this airport guide is
                      cached in our database.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {status !== "needs-signin" ? (
          <section className="mt-10">
            <Card className="border-border/70 bg-card/80">
              <CardContent className="p-6 sm:p-8">
                {isWaitingForContent ? (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span
                      className="flex size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    >
                      <Loader2 className="size-full" />
                    </span>
                    Gathering airport facts and traveler tips…
                  </div>
                ) : (
                  <AirportGuideArticle content={displayBody} />
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>
    </div>
  );
}
