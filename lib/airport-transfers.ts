/**
 * Pre-booked airport↔city transfer partners that pay affiliate commission.
 *
 * Uber/Bolt/Grab deep links do not pay per trip for existing riders — their
 * affiliate programs (when approved) only pay for new-user acquisition. Fixed
 * price transfer marketplaces via Travelpayouts do pay on completed bookings,
 * which is the commission path we can wire without partner approval beyond a
 * Travelpayouts marker.
 */

export interface TransferQuoteLink {
  id: "gettransfer" | "kiwitaxi";
  label: string;
  description: string;
  href: string;
  /** True when the href is wrapped with a Travelpayouts tracking marker. */
  isAffiliate: boolean;
}

export interface TransferLinkInput {
  /** Airport IATA, used in labels and search hints. */
  iata: string;
  /** Human airport name for the "from" field. */
  airportName: string;
  /** City-center name for the "to" field. */
  cityName: string;
}

function travelpayoutsMarker(): string | undefined {
  const marker = process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER?.trim();
  return marker || undefined;
}

/**
 * Wrap a destination URL with Travelpayouts when a marker is configured.
 * Product IDs: GetTransfer=4439, Kiwitaxi=647 (Travelpayouts catalog).
 */
export function wrapTravelpayoutsLink(
  destinationUrl: string,
  productId: number,
): { href: string; isAffiliate: boolean } {
  const marker = travelpayoutsMarker();
  if (!marker) {
    return { href: destinationUrl, isAffiliate: false };
  }

  const params = new URLSearchParams({
    marker,
    p: String(productId),
    u: destinationUrl,
  });
  return {
    href: `https://tp.media/r?${params.toString()}`,
    isAffiliate: true,
  };
}

function buildGetTransferSearchUrl(input: TransferLinkInput): string {
  const params = new URLSearchParams({
    from: `${input.iata} Airport`,
    to: input.cityName,
  });
  return `https://gettransfer.com/en?${params.toString()}`;
}

function buildKiwitaxiSearchUrl(input: TransferLinkInput): string {
  const params = new URLSearchParams({
    from: `${input.airportName} (${input.iata})`,
    to: input.cityName,
  });
  return `https://kiwitaxi.com/en/search/?${params.toString()}`;
}

/**
 * Fixed-price transfer quote links for airport → city center. Prefer these
 * when the traveler wants a prepaid fare (and when we can earn commission).
 */
export function getAirportTransferQuoteLinks(
  input: TransferLinkInput,
): TransferQuoteLink[] {
  const gettransfer = wrapTravelpayoutsLink(buildGetTransferSearchUrl(input), 4439);
  const kiwitaxi = wrapTravelpayoutsLink(buildKiwitaxiSearchUrl(input), 647);

  return [
    {
      id: "gettransfer",
      label: "GetTransfer quotes",
      description: "Compare fixed-price private transfers to the city — prepaid, meet & greet.",
      href: gettransfer.href,
      isAffiliate: gettransfer.isAffiliate,
    },
    {
      id: "kiwitaxi",
      label: "Kiwitaxi quotes",
      description: "Fixed airport→city fares with professional drivers in 100+ countries.",
      href: kiwitaxi.href,
      isAffiliate: kiwitaxi.isAffiliate,
    },
  ];
}
