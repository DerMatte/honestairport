import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import {
  Barlow_Condensed,
  Geist,
  IBM_Plex_Mono,
} from "next/font/google";
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
import { SiteFooter } from "@/app/components/site-footer";
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
  themeColor: "#d5dcde",
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
      className={`${geistSans.variable} ${ibmPlexMono.variable} ${barlowCondensed.variable} h-full antialiased`}
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
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
