import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import {
  MembersLanding,
  MembersLandingFallback,
} from "@/app/components/members-landing";
import { MembershipRestore } from "@/app/components/membership-restore";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { checkoutUrlForPath, getHtmlAccess } from "@/lib/whop-access";
import { isWhopGateEnabled } from "@/lib/whop-gate";

export const metadata: Metadata = {
  title: "Members: $8/month airport intel",
  description:
    "Join HonestAirport Members for $8/month. Unlock extra airport tabs and lounge pages. Overview, the lounge directory, home, and search stay free. Cancel anytime.",
  alternates: { canonical: "/members" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "HonestAirport Members — $8/month",
    description:
      "Unlock extra airport tabs and lounge pages. Overview and the lounge directory stay free. Cancel anytime.",
    type: "website",
    url: "/members",
  },
  twitter: { card: "summary_large_image" },
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

function membersLoginHref(nextPath: string): string {
  const membersPath =
    nextPath === "/"
      ? "/members"
      : `/members?next=${encodeURIComponent(nextPath)}`;
  return `/login?next=${encodeURIComponent(membersPath)}`;
}

async function readSignedIn(): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return false;
  }
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return Boolean(session);
  } catch {
    return false;
  }
}

export default function MembersPage({ searchParams }: MembersPageProps) {
  return (
    <Suspense fallback={<MembersLandingFallback />}>
      <MembersPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MembersPageContent({ searchParams }: MembersPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const paymentId = params.payment_id?.trim() || params.receipt?.trim() || null;
  const gateOn = isWhopGateEnabled();
  const [access, signedIn] = await Promise.all([
    gateOn ? getHtmlAccess() : Promise.resolve("open" as const),
    readSignedIn(),
  ]);

  return (
    <MembersLanding
      checkoutHref={checkoutUrlForPath(nextPath)}
      nextPath={nextPath}
      paymentId={paymentId}
      access={access}
      gateOn={gateOn}
      signInHref={membersLoginHref(nextPath)}
      signedIn={signedIn}
      restoreForm={
        <MembershipRestore paymentId={paymentId} nextPath={nextPath} />
      }
    />
  );
}
