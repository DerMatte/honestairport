import { AirportDirectory } from "@/app/components/airport-directory";
import { getAllAirports } from "@/lib/airport-content";

export default async function AirportsDirectory() {
  const airports = await getAllAirports();

  return <AirportDirectory airports={airports} />;
}
