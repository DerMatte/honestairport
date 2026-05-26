import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/app/components/site-header";
import { getAllAirports } from "@/lib/airport-content";
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
  title: "TravelGuide • Airport Knowledge",
  description: "The best practical information for major airports — security tips, clever tricks, navigation, and more. Clean, scannable pages for every traveler.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const airports = await getAllAirports();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-6">
            <a href="/" className="shrink-0 text-xl font-semibold tracking-tight">
              TravelGuide
            </a>
            <SiteHeader airports={airports} />
          </div>
        </header>
        <main className="flex-1">
          {children}
        </main>
        <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
          Curated from official sources (TSA, airports, IATA) + expert travel knowledge. Always verify with official sites before travel.
        </footer>
      </body>
    </html>
  );
}
