import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";
import { getAllHonestAirports } from "@/lib/airport-utils";
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
  metadataBase: new URL("https://honestairport.vercel.app"),
  title: {
    default: "HonestAirport - Airportist Scores and Traveler Tips",
    template: "%s - HonestAirport",
  },
  description:
    "A traveler-focused airport directory with Airportist Scores, practical tips, amenities, and Flighty-style disruption signals.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const airports = getAllHonestAirports();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-6">
            <Link href="/" className="shrink-0 text-xl font-semibold tracking-tight">
              HonestAirport
            </Link>
            <SiteHeader airports={airports} />
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
          Airportist Scores are editorial mock data for this starter. Always verify live rules, terminals, and operational alerts with official airport and airline sources.
        </footer>
      </body>
    </html>
  );
}
