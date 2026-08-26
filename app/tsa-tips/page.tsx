import type { Metadata } from "next";
import Link from "next/link";
import {
  Accessibility,
  ArrowLeft,
  Baby,
  BadgeCheck,
  Ban,
  Clock3,
  ExternalLink,
  HeartPulse,
  IdCard,
  Laptop,
  Luggage,
  MessageCircleQuestion,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "TSA Tips: IDs, Liquids, PreCheck and Airport Security",
  description:
    "A practical U.S. airport security guide covering acceptable ID, the 3-1-1 liquids rule, packing, TSA PreCheck, medication, accessibility, families, and arrival timing.",
  alternates: { canonical: "/tsa-tips" },
  openGraph: {
    title: "TSA screening guide",
    description:
      "Prepare for U.S. airport security with a clear guide to IDs, liquids, packing, PreCheck, and traveler assistance.",
    type: "article",
    url: "/tsa-tips",
  },
  twitter: { card: "summary_large_image" },
};

const sections = [
  ["identification", "Identification"],
  ["liquids", "Liquids"],
  ["prohibited", "Prohibited items"],
  ["screening", "Standard vs. PreCheck"],
  ["packing", "Electronics & packing"],
  ["assistance", "Medication & assistance"],
  ["help", "Get help"],
  ["timing", "Arrival planning"],
] as const;

function OfficialLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary focus-visible:rounded-sm"
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

function GuideSection({
  id,
  icon,
  eyebrow,
  title,
  children,
}: {
  id: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border/80 py-9 first:border-t-0 first:pt-0 sm:py-12">
      <div className="grid gap-5 sm:grid-cols-[52px_1fr]">
        <div className="flex size-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/8 text-primary [&_svg]:size-5">
          {icon}
        </div>
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.15em] text-primary uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-7 text-muted-foreground sm:text-base">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrayItem({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return (
    <div className="flex gap-3 border-t border-dashed border-primary-foreground/25 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mt-0.5 text-primary-foreground/80 [&_svg]:size-4">{icon}</div>
      <div>
        <p className="text-sm font-medium text-primary-foreground">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-primary-foreground/65">{detail}</p>
      </div>
    </div>
  );
}

export default function TsaTipsPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_7%,var(--background)),var(--background)_38rem)]">
      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6 sm:py-8 lg:py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All airports
        </Link>

        <header className="mt-8 grid items-end gap-8 lg:grid-cols-[1fr_370px] lg:gap-14">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 font-mono text-[11px] font-semibold tracking-[0.14em] text-primary uppercase shadow-sm backdrop-blur">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                U.S. security briefing
              </span>
              <span className="text-xs text-muted-foreground">
                Last reviewed <time dateTime="2026-08-07">August 7, 2026</time>
              </span>
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl leading-[1.04] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Reach the checkpoint ready, not rushed.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              The practical TSA rules worth checking before you leave: the ID in your wallet, what belongs in the quart-size bag, what comes out at screening, and where to get help.
            </p>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-primary p-5 shadow-2xl shadow-primary/20 sm:p-6">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-1/2 h-px bg-linear-to-r from-transparent via-primary-foreground/40 to-transparent shadow-[0_0_18px_4px_color-mix(in_oklab,var(--primary-foreground)_18%,transparent)]"
            />
            <p className="relative font-mono text-[11px] font-semibold tracking-[0.16em] text-primary-foreground/60 uppercase">
              Put these in your mental tray
            </p>
            <div className="relative mt-4">
              <TrayItem icon={<IdCard />} label="ID checked" detail="Use an accepted physical or participating digital ID." />
              <TrayItem icon={<Luggage />} label="Bag checked" detail="Liquids separated; prohibited items left at home." />
              <TrayItem icon={<Clock3 />} label="Time checked" detail="Build in the airport's recommended arrival buffer." />
            </div>
          </div>
        </header>

        <div className="mt-12 grid gap-10 lg:grid-cols-[220px_minmax(0,760px)] lg:justify-between lg:gap-16">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <nav aria-label="On this page" className="rounded-2xl border bg-card/80 p-4 shadow-sm backdrop-blur">
              <p className="px-2 font-mono text-[10px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                On this page
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
                {sections.map(([id, label]) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="block rounded-lg px-2 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:text-foreground"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="min-w-0">
            <GuideSection id="identification" icon={<IdCard />} eyebrow="At document check" title="Bring an acceptable ID">
              <p>
                Travelers 18 and older need an acceptable credential for domestic screening. A REAL ID-compliant state license or ID is one option; passports and several other federal credentials are also accepted. The name on your reservation should match the ID you plan to show.
              </p>
              <p>
                Some checkpoints accept participating digital IDs, but keep your physical credential with you. Confirm the current list on TSA’s {" "}
                <OfficialLink href="https://www.tsa.gov/travel/security-screening/identification">acceptable identification page</OfficialLink>.
              </p>
            </GuideSection>

            <GuideSection id="liquids" icon={<BadgeCheck />} eyebrow="Inside your carry-on" title="Use the 3-1-1 rule for everyday liquids">
              <p>
                Each standard liquid, gel, cream, paste, or aerosol container must be 3.4 ounces (100 milliliters) or smaller. Fit those containers in one quart-size clear resealable bag, with one bag per passenger. Larger containers generally belong in checked baggage.
              </p>
              <p>
                Medically necessary liquids, breast milk, formula, and certain other essentials can be exceptions and should be declared for separate screening. Review TSA’s {" "}
                <OfficialLink href="https://www.tsa.gov/travel/security-screening/liquids-rule">liquids rule</OfficialLink> before packing an exception.
              </p>
            </GuideSection>

            <GuideSection id="prohibited" icon={<Ban />} eyebrow="Before the airport" title="Check uncertain items one by one">
              <p>
                Knives, many tools, firearms, realistic replicas, and flammable materials have item-specific rules. “Allowed” can also depend on whether something is in a carry-on or checked bag. The final decision at a checkpoint rests with the TSA officer.
              </p>
              <p>
                Search the official {" "}
                <OfficialLink href="https://www.tsa.gov/travel/security-screening/whatcanibring/all">What Can I Bring?</OfficialLink>{" "}
                database instead of relying on a general packing list. Firearms require a separate, strict checked-baggage process and may also be subject to airline and local rules.
              </p>
            </GuideSection>

            <GuideSection id="screening" icon={<ShieldCheck />} eyebrow="Choose the right lane" title="Standard screening and TSA PreCheck differ">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border bg-card p-4 text-foreground">
                  <p className="font-medium">Standard screening</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Be ready to remove shoes, belts, light jackets, the liquids bag, and larger electronics when instructed.
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 text-foreground">
                  <p className="font-medium">TSA PreCheck</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Eligible travelers usually keep shoes, belts, light jackets, compliant liquids, and laptops in place in dedicated lanes.
                  </p>
                </div>
              </div>
              <p>
                Your boarding pass must show the TSA PreCheck indicator to use the lane. Screening procedures can change, and officers may direct any traveler to additional screening—follow the instructions at your checkpoint.
              </p>
            </GuideSection>

            <GuideSection id="packing" icon={<Laptop />} eyebrow="At the X-ray" title="Pack electronics so they are easy to reach">
              <p>
                In a standard lane, electronics larger than a cell phone are commonly removed from the carry-on and placed in a bin with nothing above or below them. Avoid burying laptops, tablets, cameras, and game consoles under tightly packed clothing.
              </p>
              <p>
                Empty pockets before reaching the scanner, keep cords organized, and do not pack a power bank in checked baggage—spare lithium batteries and power banks belong in carry-on baggage under airline and FAA limits.
              </p>
            </GuideSection>

            <GuideSection id="assistance" icon={<HeartPulse />} eyebrow="Screening with extra needs" title="Declare medication and ask for the screening you need">
              <p>
                Medication is allowed, including medically necessary liquids beyond the usual limit. Tell the officer about liquid medication or medical equipment before screening begins. Clear labeling can make inspection easier, though TSA does not require medication to be in prescription bottles.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex gap-3 rounded-2xl border bg-card p-4">
                  <Accessibility className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-sm leading-6">
                    Travelers with disabilities or medical conditions may request accommodations, a private screening, or help from a Passenger Support Specialist.
                  </p>
                </div>
                <div className="flex gap-3 rounded-2xl border bg-card p-4">
                  <Baby className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <p className="text-sm leading-6">
                    Formula, breast milk, toddler drinks, and related cooling accessories follow special screening procedures. Tell the officer before the bag is screened.
                  </p>
                </div>
              </div>
            </GuideSection>

            <GuideSection id="help" icon={<MessageCircleQuestion />} eyebrow="Before you travel" title="Use TSA Cares and AskTSA for direct help">
              <p>
                <OfficialLink href="https://www.tsa.gov/travel/tsa-cares">TSA Cares</OfficialLink>{" "}
                provides screening assistance for travelers with disabilities, medical conditions, and other special circumstances. Submit a request at least 72 hours before travel when possible.
              </p>
              <p>
                For item and policy questions, contact {" "}
                <OfficialLink href="https://www.tsa.gov/travel/customer-service">AskTSA</OfficialLink>{" "}
                through TSA’s listed messaging channels. Do not send sensitive personal information in a public social post.
              </p>
            </GuideSection>

            <GuideSection id="timing" icon={<Clock3 />} eyebrow="Build your departure plan" title="Treat the security wait as one part of arrival time">
              <p>
                TSA’s broad planning guidance is to arrive about two hours before a domestic flight and three hours before an international flight, but your airport or airline may recommend more time. Parking, bag drop, terminal transfers, peak travel days, and accessibility needs all come before the checkpoint clock.
              </p>
              <div className="rounded-2xl border border-primary/15 bg-primary/5 p-5 text-foreground">
                <p className="font-medium">A useful order of operations</p>
                <ol className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground sm:grid-cols-3">
                  <li><span className="font-mono text-primary">01</span> Check airline and airport alerts.</li>
                  <li><span className="font-mono text-primary">02</span> Add parking, bag-drop, and terminal time.</li>
                  <li><span className="font-mono text-primary">03</span> Add the current security estimate with a buffer.</li>
                </ol>
              </div>
            </GuideSection>

            <section className="rounded-3xl bg-foreground p-6 text-background sm:p-8">
              <div className="flex items-start gap-4">
                <Smartphone className="mt-1 size-6 shrink-0 text-background/65" aria-hidden="true" />
                <div>
                  <h2 className="font-sans text-xl font-semibold">Rules can change between trips</h2>
                  <p className="mt-2 text-sm leading-6 text-background/70">
                    Use this guide as a preparation checklist, then confirm unusual items and current procedures directly with TSA. Start with the official {" "}
                    <OfficialLink href="https://www.tsa.gov/news/press/factsheets/tsa-travel-tips">TSA Travel Tips</OfficialLink>.
                  </p>
                </div>
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
