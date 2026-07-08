import { AirportDirectory } from "@/app/components/airport-directory";
import { getAllAirports } from "@/lib/airport-content";
import { getAllHonestAirports } from "@/lib/airport-utils";

export default async function HomePage() {
  const scoredAirports = getAllHonestAirports();
  const allAirports = await getAllAirports();

  return <AirportDirectory scoredAirports={scoredAirports} allAirports={allAirports} />;
}
