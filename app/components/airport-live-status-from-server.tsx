import { connection } from "next/server";
import {
  AirportLiveStatusPanel,
  AirportLiveStatusProvider,
} from "@/app/components/airport-live-status-loader";
import { getAirportLiveData } from "@/lib/airport-live-data";

export async function AirportLiveStatusFromServer({
  iata,
  officialAirportUrl,
  className,
}: {
  iata: string;
  officialAirportUrl?: string;
  className?: string;
}) {
  // Live ops use `new Date()` and uncached upstreams — wait for the request
  // so Cache Components can prerender the airport page around this island.
  await connection();

  try {
    const data = await getAirportLiveData(iata);
    return (
      <AirportLiveStatusProvider
        iata={iata}
        officialAirportUrl={officialAirportUrl}
        initialData={data}
      >
        <AirportLiveStatusPanel className={className} />
      </AirportLiveStatusProvider>
    );
  } catch {
    return (
      <AirportLiveStatusProvider iata={iata} officialAirportUrl={officialAirportUrl}>
        <AirportLiveStatusPanel className={className} />
      </AirportLiveStatusProvider>
    );
  }
}
