import { AirportDirectory } from "@/app/components/airport-directory";
import { AirportGuideIndex } from "@/app/components/airport-guide-index";
import { getAllHonestAirports } from "@/lib/airport-utils";

// The guide index below reads from Postgres; pick up new airports without a deploy.
export const revalidate = 3600;

export default function HomePage() {
  const airports = getAllHonestAirports();

  return (
    <>
      <AirportDirectory airports={airports} />
      <AirportGuideIndex />
    </>
  );
}
