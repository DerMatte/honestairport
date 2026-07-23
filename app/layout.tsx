import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Plane } from "lucide-react";
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

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  // Static weights keep the heading font smaller than the full opsz variable cut.
  weight: ["500", "600"],
  // `optional` prevents a late webfont swap from becoming the LCP paint on slow
  // mobile networks (swap was ~85% of LCP render delay in Lighthouse).
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
  themeColor: "#0a0a0a",
  colorScheme: "light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
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
        <footer className="border-t border-border/60 bg-card/60">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Plane className="size-3 -rotate-45" aria-hidden="true" />
              </span>
              HonestAirport
            </span>
            <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
              Airportist Scores and guides are editorial content. Always verify
              live rules, terminals, and operational alerts with official
              airport and airline sources.
            </p>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
