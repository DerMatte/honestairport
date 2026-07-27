import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import {
  Barlow_Condensed,
  Geist,
  IBM_Plex_Mono,
} from "next/font/google";
import { ArrowUpRight, Plane } from "lucide-react";
import { Analytics } from "@vercel/analytics/next";
import {
  NearestAirportHeaderLink,
  NearestAirportSidebarItem,
} from "@/app/components/nearest-airport";
import {
  NearestAirportLinkSkeleton,
  NearestAirportSidebarSkeleton,
} from "@/app/components/nearest-airport-skeletons";
import { SiteHeader } from "@/app/components/site-header";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "optional",
  preload: false,
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "optional",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HonestAirport - Airportist Scores and Traveler Tips",
    template: "%s - HonestAirport",
  },
  description:
    "A traveler-focused airport directory with Airportist Scores, practical tips, amenities, and Flighty-style disruption signals.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "HonestAirport - Airportist Scores and Traveler Tips",
    description:
      "A traveler-focused airport directory with Airportist Scores, practical tips, amenities, and disruption signals.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#101210",
  colorScheme: "dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${ibmPlexMono.variable} ${barlowCondensed.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg focus:outline focus:outline-2 focus:outline-primary"
        >
          Skip to content
        </a>
        <SiteHeader
          nearestAirportSlot={
            <Suspense fallback={<NearestAirportLinkSkeleton className="mr-2" />}>
              <NearestAirportHeaderLink className="mr-2" />
            </Suspense>
          }
          nearestAirportSidebarSlot={
            <Suspense fallback={<NearestAirportSidebarSkeleton />}>
              <NearestAirportSidebarItem />
            </Suspense>
          }
        />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-white/10 bg-[#0b0d0c]">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <span className="flex items-center gap-3 font-heading text-xl font-semibold uppercase tracking-[0.08em] text-board-ink">
                <span className="flex size-8 items-center justify-center border border-board-ink/25 bg-board-ink text-board">
                  <Plane className="size-4 -rotate-45" aria-hidden="true" />
                </span>
                HonestAirport
              </span>
              <p className="mt-4 max-w-2xl text-xs leading-5 text-muted-foreground">
              Airportist Scores and guides are editorial content. Always verify
              live rules, terminals, and operational alerts with official
              airport and airline sources.
              </p>
            </div>
            <a
              href="#main-content"
              className="group inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-board-ink/70 transition-colors hover:text-board-amber"
            >
              Return to board
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
