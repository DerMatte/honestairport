import { AirportDirectory } from "@/app/components/airport-directory";
import { getAllAirports, getAllHonestAirports } from "@/lib/airport-content";

export default async function HomePage() {
  const [scoredAirports, allAirports] = await Promise.all([
    getAllHonestAirports(),
    getAllAirports(),
  ]);

  return <AirportDirectory scoredAirports={scoredAirports} allAirports={allAirports} />;
}
