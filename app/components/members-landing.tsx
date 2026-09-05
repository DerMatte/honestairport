import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MembersKnowBeforeYouGo } from "@/app/components/members-know-before-you-go";
import { Skeleton } from "@/components/ui/skeleton";
import { JoinCheckoutLink } from "@/app/components/join-checkout-link";
import type { HtmlAccess } from "@/lib/whop-gate";

const FREE_PERKS = [
  "Airport Overview on every airport page",
  "Getting There — ground transport",
  "Lounge directory on the airport page",
  "Home and search",
] as const;

const MEMBER_PERKS = [
  "Amenities, tips, water, disruptions, and reviews",
  "Individual lounge pages",
  "The existing Telegram community on the Whop product",
] as const;

function membersBackLink(nextPath: string): { href: string; label: string } {
  const match = /^\/airports\/([a-z0-9]+)/i.exec(nextPath);
  if (match) {
    return {
      href: nextPath,
      label: `Back to ${match[1].toUpperCase()}`,
    };
  }
  return { href: "/", label: "All airports" };
}

export function MembersLanding({
  checkoutHref,
  nextPath,
  paymentId,
  access,
  gateOn,
  restoreForm,
  signInHref,
  signedIn,
}: {
  checkoutHref: string;
  nextPath: string;
  paymentId: string | null;
  access: HtmlAccess;
  gateOn: boolean;
  restoreForm: ReactNode;
  signInHref: string;
  signedIn: boolean;
}) {
  const allowed = access === "allowed";
  const returningFromCheckout = Boolean(paymentId) && !allowed;
  const back = membersBackLink(nextPath);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_7%,var(--background)),var(--background)_38rem)]">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 sm:py-8 lg:py-10">
        <Link
          href={back.href}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {back.label}
        </Link>

        <header className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                HonestAirport Members
              </p>
              <Badge variant="secondary" className="rounded-full">
                $8/month
              </Badge>
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {allowed
                ? "You're in — the rest of the airport is unlocked."
                : "Free finds the airport. Members decide the day."}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {allowed
                ? "Overview, Getting There, the lounge directory, home, and search stay free. Members get amenities, tips, water, disruptions, reviews, and every lounge page. Cancel anytime — access ends when the membership ends."
                : "Scores are free. Lounges deep, disruptions, tips, and reviews unlock for members — $8/mo."}
            </p>

            {allowed ? (
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="h-11 px-5 text-base" asChild>
                  <Link href={nextPath}>
                    Continue
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" className="h-11 px-5 text-base" asChild>
                  <JoinCheckoutLink href={checkoutHref}>
                    Join members · $8/mo
                  </JoinCheckoutLink>
                </Button>
                <a
                  href="#restore"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Already a member?
                </a>
                {signedIn ? null : (
                  <Link
                    href={signInHref}
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            )}
          </div>

          {allowed ? (
            <Card className="border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
              <CardContent className="flex items-start gap-3 p-5 sm:p-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BadgeCheck className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Membership is active
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Extra airport tabs and lounge pages are unlocked in this
                    browser. The existing Telegram community lives on the Whop
                    product page — there is no Telegram bot in this app.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-2xl shadow-primary/20 sm:p-6">
              <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-primary-foreground/60 uppercase">
                HonestAirport Members
              </p>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-heading text-5xl font-medium tracking-tight">
                  $8
                </span>
                <span className="text-sm text-primary-foreground/70">
                  /month via Whop
                </span>
              </p>
              <ul className="mt-5 text-sm leading-6 text-primary-foreground/85">
                <li className="border-t border-dashed border-primary-foreground/25 py-3 first:border-t-0 first:pt-0">
                  Cancel anytime
                </li>
                <li className="border-t border-dashed border-primary-foreground/25 py-3">
                  Access ends when the membership ends
                </li>
                <li className="flex items-start gap-2 border-t border-dashed border-primary-foreground/25 pt-3">
                  <MessageCircle
                    className="mt-0.5 size-4 shrink-0 text-primary-foreground/70"
                    aria-hidden="true"
                  />
                  <span>
                    Checkout includes the existing Telegram community on
                    Whop. There is no Telegram bot in this app.
                  </span>
                </li>
              </ul>
            </div>
          )}
        </header>

        <MembersKnowBeforeYouGo
          checkoutHref={checkoutHref}
          showJoinCta={!allowed}
        />

        <section className="mt-14 sm:mt-16" aria-labelledby="what-you-get">
          <p className="font-mono text-[11px] font-semibold tracking-[0.15em] text-primary uppercase">
            What you get
          </p>
          <h2
            id="what-you-get"
            className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Free stays useful. Members get the rest.
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card className="border-border/70 bg-card/95 shadow-sm">
              <CardHeader>
                <Badge variant="outline" className="rounded-full">
                  Free
                </Badge>
                <CardTitle className="text-xl font-semibold tracking-tight">
                  Always free
                </CardTitle>
                <CardDescription>
                  Enough to browse scores and find the airport.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PerkList items={FREE_PERKS} />
              </CardContent>
            </Card>

            <Card className="border-primary/15 bg-card/95 shadow-xl shadow-primary/10">
              <CardHeader>
                <Badge variant="secondary" className="rounded-full">
                  $8/month
                </Badge>
                <CardTitle className="text-xl font-semibold tracking-tight">
                  Members
                </CardTitle>
                <CardDescription>
                  The extra tabs and every lounge page, while the membership
                  is active.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PerkList items={MEMBER_PERKS} emphasized />
              </CardContent>
            </Card>
          </div>
        </section>

        {!allowed ? (
          <section
            id="restore"
            className="mt-14 scroll-mt-24 sm:mt-16"
            aria-labelledby="restore-heading"
          >
            <details
              className="group rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur"
              {...(returningFromCheckout ? { open: true } : {})}
            >
              <summary className="cursor-pointer list-none px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2
                      id="restore-heading"
                      className="text-base font-semibold tracking-tight"
                    >
                      Already a member?
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Restore this browser with the pay_… id from your Whop
                      receipt.
                      {signedIn ? (
                        " Signed in — restore also saves the Whop id on your account."
                      ) : (
                        <>
                          {" "}
                          <Link
                            href={signInHref}
                            className="underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Sign in
                          </Link>{" "}
                          first if you want it saved on your account.
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-sm text-primary group-open:hidden">
                    Show restore
                  </span>
                  <span className="hidden text-sm text-primary group-open:inline">
                    Hide restore
                  </span>
                </div>
              </summary>
              <div className="border-t border-border/70 px-5 py-5 sm:px-6">
                {returningFromCheckout ? (
                  <p className="mb-4 text-sm leading-6 text-muted-foreground">
                    Welcome back from checkout. Submit the prefilled receipt
                    to unlock this browser — and, if you are signed in, save
                    it on your account.
                  </p>
                ) : null}
                {restoreForm}
              </div>
            </details>
          </section>
        ) : null}

        {!gateOn ? (
          <p className="mt-10 max-w-2xl text-xs leading-5 text-muted-foreground">
            Membership is not enabled in this environment (Whop API env is
            unset), so airport pages stay open.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PerkList({
  items,
  emphasized = false,
}: {
  items: readonly string[];
  emphasized?: boolean;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-6">
          <Check
            className={
              emphasized
                ? "mt-0.5 size-4 shrink-0 text-primary"
                : "mt-0.5 size-4 shrink-0 text-muted-foreground"
            }
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function MembersLandingFallback() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 sm:py-10">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-8 h-12 w-full max-w-xl" />
      <Skeleton className="mt-4 h-20 w-full max-w-2xl" />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
