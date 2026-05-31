import { AirportDirectory } from "@/app/components/airport-directory";
import { getAllHonestAirports } from "@/lib/airport-utils";

export default function HomePage() {
  const airports = getAllHonestAirports();

  return <AirportDirectory airports={airports} />;
}
