import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg focus:outline focus:outline-2 focus:outline-primary"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-6">
            <Link href="/" className="shrink-0 text-xl font-semibold tracking-tight">
              HonestAirport
            </Link>
            <SiteHeader airports={airports} />
          </div>
        </header>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
          Airportist Scores are editorial mock data for this starter. Always verify live rules, terminals, and operational alerts with official airport and airline sources.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
