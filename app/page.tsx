import { AirportDirectory } from "@/app/components/airport-directory";
import { AirportGuideIndex } from "@/app/components/airport-guide-index";
import { getAllHonestAirports } from "@/lib/airport-utils";

export default function HomePage() {
  const airports = getAllHonestAirports();

  return (
    <>
      <AirportDirectory airports={airports} />
      <AirportGuideIndex />
    </>
  );
}
