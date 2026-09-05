import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Columns2 } from "lucide-react";
import { ComparePicker, type ComparePickerValue } from "@/app/components/compare-picker";
import { CompareResults } from "@/app/components/compare-results";
import { Skeleton } from "@/components/ui/skeleton";
import {
  compareSideIdentity,
  type CompareSideView,
} from "@/lib/compare-airports";
import { loadCompareSide } from "@/lib/compare-load";
import {
  compareParamIata,
  compareSearchHref,
  firstSearchParam,
  parseCompareIata,
} from "@/lib/compare-search-params";
import { getHtmlAccess } from "@/lib/whop-access";
import { isWhopGateEnabled } from "@/lib/whop-gate";

interface ComparePageProps {
  searchParams: Promise<{
    a?: string | string[];
    b?: string | string[];
  }>;
}

function pickerValue(side: CompareSideView): ComparePickerValue {
  const identity = compareSideIdentity(side);
  if (identity) {
    return { iata: identity.iata, name: identity.name };
  }
  if (side.status === "unknown") {
    return { iata: side.iata };
  }
  return { iata: null };
}

export async function generateMetadata({
  searchParams,
}: ComparePageProps): Promise<Metadata> {
  const params = await searchParams;
  const a = parseCompareIata(firstSearchParam(params.a));
  const b = parseCompareIata(firstSearchParam(params.b));
  const aCode = compareParamIata(a);
  const bCode = compareParamIata(b);
  const canonical = compareSearchHref(aCode, bCode);

  if (aCode && bCode) {
    return {
      title: `Compare ${aCode} vs ${bCode}`,
      description: `Side-by-side Airportist Scores for ${aCode} and ${bCode} — comfort, transport, disruption resilience, and lounge highlights.`,
      alternates: { canonical },
      openGraph: {
        title: `Compare ${aCode} vs ${bCode}`,
        description: `Free Airportist Score comparison for ${aCode} and ${bCode}.`,
        type: "website",
        url: canonical,
      },
      twitter: { card: "summary_large_image" },
    };
  }

  return {
    title: "Compare airports",
    description:
      "Compare two airports side by side: Airportist Scores, comfort, transport, disruption resilience, and lounge highlights. Scores stay free.",
    alternates: { canonical: "/compare" },
    openGraph: {
      title: "Compare airports",
      description:
        "Pick two airports and compare Airportist Scores, key factors, and lounge highlights.",
      type: "website",
      url: "/compare",
    },
    twitter: { card: "summary_large_image" },
  };
}

function ComparePageFallback() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 sm:py-8 lg:py-10">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-8 h-12 w-72 max-w-full" />
        <Skeleton className="mt-4 h-6 w-full max-w-xl" />
        <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="mx-auto size-11 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function ComparePage({ searchParams }: ComparePageProps) {
  return (
    <Suspense fallback={<ComparePageFallback />}>
      <ComparePageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ComparePageContent({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const aParam = parseCompareIata(firstSearchParam(params.a));
  const bParam = parseCompareIata(firstSearchParam(params.b));
  const gateOn = isWhopGateEnabled();

  const [a, b, membershipAccess] = await Promise.all([
    loadCompareSide(aParam),
    loadCompareSide(bParam),
    gateOn ? getHtmlAccess() : Promise.resolve("open" as const),
  ]);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 sm:py-8 lg:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All airports
        </Link>

        <header className="mt-8 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase shadow-sm backdrop-blur">
              <Columns2 className="size-3.5" aria-hidden="true" />
              Airport compare
            </span>
          </div>
          <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl">
            Compare two airports
          </h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            Scores, comfort, transport, disruption resilience, and lounge
            highlights stay free. Share the URL once both airports are set.
          </p>
        </header>

        <section className="mt-8 sm:mt-10">
          <ComparePicker a={pickerValue(a)} b={pickerValue(b)} />
        </section>

        <section className="mt-8 sm:mt-10">
          <CompareResults a={a} b={b} membershipAccess={membershipAccess} />
        </section>
      </div>
    </div>
  );
}
