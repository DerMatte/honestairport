import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { MembershipRestore } from "@/app/components/membership-restore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { checkoutUrlForPath, getHtmlAccess } from "@/lib/whop-access";
import { isWhopGateEnabled } from "@/lib/whop-gate";

export const metadata: Metadata = {
  title: "Members",
  description: "Join HonestAirport Members for $8/month, or restore access after checkout.",
  robots: { index: false, follow: false },
};

interface MembersPageProps {
  searchParams: Promise<{
    payment_id?: string;
    receipt?: string;
    next?: string;
    status?: string;
  }>;
}

function safeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function MembersFallback() {
  return (
    <MembersShell>
      <Skeleton className="h-24 w-full" />
    </MembersShell>
  );
}

function MembersShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(circle_at_top,var(--muted),transparent_34%)]">
      <div className="mx-auto max-w-xl px-5 py-6 sm:px-6 sm:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All airports
        </Link>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            $8/month
          </Badge>
        </div>
        <h1 className="mt-4 text-4xl tracking-tight">HonestAirport Members</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Extra airport tabs (getting there, amenities, tips, water, the full
          guide, disruptions, reviews) and individual lounge pages. Overview
          and the lounge directory stay free. Machines pay for paid{" "}
          <span className="font-mono">.md</span> via x402.
        </p>

        <Card className="mt-8 border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
          <CardContent className="space-y-4 p-5 sm:p-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function MembersPage({ searchParams }: MembersPageProps) {
  return (
    <Suspense fallback={<MembersFallback />}>
      <MembersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MembersPageContent({ searchParams }: MembersPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const paymentId = params.payment_id?.trim() || params.receipt?.trim() || null;
  const gateOn = isWhopGateEnabled();
  const access = gateOn ? await getHtmlAccess() : "open";
  const checkoutHref = checkoutUrlForPath(nextPath);

  return (
    <MembersShell>
      {!gateOn ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Membership is not enabled in this environment (Whop API env is
          unset), so airport pages stay open. Set{" "}
          <span className="font-mono">WHOP_API_KEY</span> and{" "}
          <span className="font-mono">WHOP_PRODUCT_ID</span> to turn the
          gate on.
        </p>
      ) : access === "allowed" ? (
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BadgeCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              You&apos;re in
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This browser has an active membership. Extra airport tabs and
              lounge pages are unlocked. Members also get the existing
              Telegram community from the Whop product page — there is no
              Telegram bot in this app.
            </p>
            <Link
              href={nextPath}
              className="mt-3 inline-flex text-sm text-primary hover:underline"
            >
              Continue
            </Link>
          </div>
        </div>
      ) : (
        <MembershipRestore
          paymentId={paymentId}
          nextPath={nextPath}
          checkoutHref={checkoutHref}
        />
      )}
    </MembersShell>
  );
}
