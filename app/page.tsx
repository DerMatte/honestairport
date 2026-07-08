import { Suspense } from "react";
import { AirportDirectory } from "@/app/components/airport-directory";
import { AirportGuideIndex } from "@/app/components/airport-guide-index";
import { GuideIndexSkeleton } from "@/app/components/loading-skeletons";
import { getAllHonestAirports } from "@/lib/airport-utils";

export default function HomePage() {
  const airports = getAllHonestAirports();

  return (
    <>
      <AirportDirectory airports={airports} />
      <Suspense fallback={<GuideIndexSkeleton />}>
        <AirportGuideIndex />
      </Suspense>
    </>
  );
}
