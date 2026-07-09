import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Plane } from "lucide-react";
import { Analytics } from "@vercel/analytics/next";
import { AirportSearchProvider } from "@/app/components/airport-search-provider";
import { SiteHeader } from "@/app/components/site-header";
import { getAirportSearchEntries } from "@/lib/airport-search";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
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
  const airports = await getAirportSearchEntries();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AirportSearchProvider airports={airports}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg focus:outline focus:outline-2 focus:outline-primary"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Plane className="size-4 -rotate-45" aria-hidden="true" />
              </span>
              <span className="font-heading text-xl font-medium tracking-tight">
                HonestAirport
              </span>
            </Link>
            <SiteHeader />
          </div>
        </header>
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
        </AirportSearchProvider>
        <Analytics />
      </body>
    </html>
  );
}
