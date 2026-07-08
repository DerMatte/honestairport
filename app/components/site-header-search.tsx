import { SiteHeader } from "@/app/components/site-header";
import { getAirportSearchEntries } from "@/lib/airport-search";

export async function SiteHeaderSearch() {
  const airports = await getAirportSearchEntries();

  return <SiteHeader airports={airports} />;
}
