import { Car, ExternalLink, Wallet } from "lucide-react";
import { AirportLocalTime } from "@/app/components/airport-local-time";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAirportTransferQuoteLinks } from "@/lib/airport-transfers";
import type { AirportRecord } from "@/lib/airports";
import { getCityDestination } from "@/lib/city-destination";
import {
  buildRideshareDeepLink,
  cityDestinationToDropoff,
  getRideshareProviders,
  getUberAffiliateSignupUrl,
  rideshareDeepLinkPrefillsRoute,
} from "@/lib/rideshare";
import { pickTypicalCityFare } from "@/lib/transport-fares";
import type { TransportOption } from "@/lib/types";

interface AirportRideBookingProps {
  airportRecord: AirportRecord;
  /** Display name for the airport (shortName preferred). */
  airportLabel: string;
  transport?: TransportOption[];
}

function formatDistanceKm(km: number): string {
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function AirportRideBooking({
  airportRecord,
  airportLabel,
  transport = [],
}: AirportRideBookingProps) {
  const city = getCityDestination(airportRecord);
  const cityName = city?.name ?? airportRecord.city_name;
  const rideshareProviders = getRideshareProviders(airportRecord.iata_country_code);
  const typicalFare = pickTypicalCityFare(transport);
  const transferLinks = getAirportTransferQuoteLinks({
    iata: airportRecord.iata_code,
    airportName: airportRecord.name,
    cityName,
  });
  const uberSignupUrl = getUberAffiliateSignupUrl();
  const dropoff = city ? cityDestinationToDropoff(city) : null;

  const hasRideshare = rideshareProviders.length > 0;
  if (!hasRideshare && !transferLinks.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="size-4" aria-hidden="true" />
          Ride to {cityName}
        </CardTitle>
        <CardDescription>
          {dropoff
            ? `Pickup at ${airportRecord.iata_code}. Where the app supports it, dropoff is set to ${cityName} city center for a live price.`
            : `Pickup set to ${airportRecord.iata_code}. Enter your destination in the app for a live price.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">To city center</div>
            <div className="mt-1 font-medium">{cityName}</div>
            {city ? (
              <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                ~{formatDistanceKm(city.distanceKm)}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Wallet className="size-3" aria-hidden="true" />
              Typical fare
            </div>
            <div className="mt-1 font-mono text-base font-semibold">
              {typicalFare?.label ?? "See app"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {typicalFare
                ? `From ${typicalFare.sourceName} notes`
                : "Live quotes open in the ride app"}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-3">
            <AirportLocalTime
              timeZone={airportRecord.time_zone}
              label={`Local time at ${airportRecord.iata_code}:`}
            />
          </div>
        </div>

        {hasRideshare ? (
          <div className="space-y-2">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              On-demand apps
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {rideshareProviders.map((provider) => (
                <Button key={provider.id} asChild variant="outline" size="sm">
                  <a
                    href={buildRideshareDeepLink(provider.id, {
                      pickup: {
                        latitude: airportRecord.latitude,
                        longitude: airportRecord.longitude,
                        nickname: airportLabel,
                        formattedAddress: airportRecord.name,
                      },
                      dropoff,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {provider.label}
                    {dropoff && rideshareDeepLinkPrefillsRoute(provider.id)
                      ? " → city"
                      : ""}
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              ))}
            </div>
            {uberSignupUrl && rideshareProviders.some((p) => p.id === "uber") ? (
              <p className="text-xs text-muted-foreground">
                New to Uber?{" "}
                <a
                  href={uberSignupUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="underline underline-offset-2"
                >
                  Create an account
                </a>{" "}
                — partner link.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Fixed-price transfers
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {transferLinks.map((link) => (
              <Button key={link.id} asChild variant="secondary" size="sm">
                <a
                  href={link.href}
                  target="_blank"
                  rel={
                    link.isAffiliate
                      ? "noopener noreferrer sponsored"
                      : "noopener noreferrer"
                  }
                >
                  {link.label}
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Compare prepaid private transfers to {cityName} — useful overnight, with
            luggage, or when you want a locked-in fare before you land.
            {transferLinks.some((link) => link.isAffiliate)
              ? " We may earn a commission if you book."
              : null}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
