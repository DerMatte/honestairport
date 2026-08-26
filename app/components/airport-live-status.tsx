import Link from "next/link";
import {
  AlertTriangle,
  Clock3,
  ExternalLink,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AirportDisruption,
  AirportLiveData,
  AirportSecurityData,
  SecurityCheckpoint,
} from "@/lib/airport-live-data";

const timestampFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

interface AirportLiveStatusProps {
  data: AirportLiveData;
  className?: string;
  officialAirportUrl?: string;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "recently"
    : `${timestampFormatter.format(date)} UTC`;
}

function disruptionTitle(type: AirportDisruption["type"]): string {
  switch (type) {
    case "ground_delay":
      return "Ground delay program";
    case "ground_stop":
      return "Ground stop";
    case "departure_delay":
      return "Departure delays";
    case "arrival_delay":
      return "Arrival delays";
    case "closure":
      return "Airport closure";
    default:
      return "Operational issue";
  }
}

function statusBadgeClass(status: AirportLiveData["disruptions"]["status"]): string {
  switch (status) {
    case "normal":
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "delayed":
      return "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "closed":
      return "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function statusBadgeLabel(status: AirportLiveData["disruptions"]["status"]): string {
  switch (status) {
    case "normal":
      return "Normal operations";
    case "delayed":
      return "Delays reported";
    case "closed":
      return "Closure or ground stop";
    default:
      return "Status unavailable";
  }
}

function securityLaneLabel(laneType: SecurityCheckpoint["laneType"]): string {
  switch (laneType) {
    case "precheck":
      return "TSA PreCheck";
    case "standard":
      return "General screening";
    default:
      return "Security lane";
  }
}

function CheckpointRow({ checkpoint }: { checkpoint: SecurityCheckpoint }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-zinc-200 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <div className="min-w-0">
        <div className="text-sm font-medium">{checkpoint.name}</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {securityLaneLabel(checkpoint.laneType)}
          {checkpoint.terminal ? ` • ${checkpoint.terminal}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm">{checkpoint.displayWait}</div>
        {checkpoint.lastUpdated ? (
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Updated {checkpoint.lastUpdated}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SecuritySource({ security }: { security: AirportSecurityData }) {
  if (security.kind === "unavailable" || !security.source) {
    return null;
  }

  return (
    <p className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400">
      Source: {" "}
      <a
        href={security.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        {security.source}
      </a>
      {security.kind === "checkpoints" ? " · Official checkpoint feed" : " · Independent estimate"}
      {` · Retrieved ${formatTimestamp(security.retrievedAt)}`}
    </p>
  );
}

function SecurityActions({
  isUsAirport,
  officialAirportUrl,
}: {
  isUsAirport: boolean;
  officialAirportUrl?: string;
}) {
  if (!officialAirportUrl && !isUsAirport) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-200 pt-4 text-xs dark:border-zinc-800">
      {officialAirportUrl ? (
        <a
          href={officialAirportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          Official airport site
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      ) : null}
      {isUsAirport ? (
        <Link
          href="/tsa-tips"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          TSA screening guide
        </Link>
      ) : null}
    </div>
  );
}

function SecurityPanel({
  data,
  officialAirportUrl,
}: {
  data: AirportLiveData;
  officialAirportUrl?: string;
}) {
  const { security } = data;
  const isUsAirport = data.countryCode === "US";

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Security wait times
        </div>
        {security.kind === "airport_estimate" ? (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-blue-700 uppercase dark:bg-blue-950/40 dark:text-blue-300">
            Estimate
          </span>
        ) : null}
      </div>

      {security.kind === "checkpoints" ? (
        <div className="mt-4 space-y-3">
          {security.checkpoints.map((checkpoint) => (
            <CheckpointRow key={checkpoint.id} checkpoint={checkpoint} />
          ))}
        </div>
      ) : security.kind === "airport_estimate" ? (
        <div className="mt-4">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Estimated airport-wide wait
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tracking-tight">
              {security.estimatedWaitMinutes}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">minutes</span>
          </div>
          <p className="mt-3 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            This blended estimate applies to the airport as a whole, not a specific terminal or checkpoint. Actual waits can change quickly.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                PreCheck availability
              </div>
              <p className="mt-1 text-sm font-medium">
                {security.precheckAvailable === null
                  ? "Not confirmed"
                  : security.precheckAvailable
                    ? "Available at this airport"
                    : "Not listed"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Users className="size-3.5" aria-hidden="true" />
                Recent traveler report
              </div>
              <p className="mt-1 text-sm font-medium">
                {security.travelerReportedMinutes === undefined
                  ? "No current report"
                  : `${security.travelerReportedMinutes} min · self-reported`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 p-3 dark:border-zinc-700 dark:bg-zinc-950/30">
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {security.message}
          </p>
          {security.source && security.sourceUrl ? (
            <a
              href={security.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {security.source}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      )}

      <SecuritySource security={security} />
      <SecurityActions
        isUsAirport={isUsAirport}
        officialAirportUrl={officialAirportUrl}
      />
    </section>
  );
}

function DisruptionRow({ disruption }: { disruption: AirportDisruption }) {
  const delayRange =
    disruption.minDelay && disruption.maxDelay
      ? `${disruption.minDelay} – ${disruption.maxDelay}`
      : disruption.minDelay ?? disruption.maxDelay;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="text-sm font-medium">{disruptionTitle(disruption.type)}</div>
      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
        {disruption.reason}
      </div>
      {delayRange ? (
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {disruption.type === "closure" ? "Window" : "Delay range"}: {delayRange}
          {disruption.trend ? ` • Trend: ${disruption.trend}` : ""}
        </div>
      ) : null}
    </div>
  );
}

export function AirportLiveStatus({
  data,
  className,
  officialAirportUrl,
}: AirportLiveStatusProps) {
  const hasDisruptions = data.disruptions.supported;

  return (
    <div className={cn("mb-8 grid gap-4 md:grid-cols-2", className)}>
      <SecurityPanel data={data} officialAirportUrl={officialAirportUrl} />

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Operational status
          </div>
          {hasDisruptions ? (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadgeClass(data.disruptions.status)}`}>
              {statusBadgeLabel(data.disruptions.status)}
            </span>
          ) : null}
        </div>

        {hasDisruptions ? (
          <>
            {data.disruptions.items.length > 0 ? (
              <div className="mt-4 space-y-3">
                {data.disruptions.items.map((disruption, index) => (
                  <DisruptionRow key={`${disruption.type}-${index}`} disruption={disruption} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {data.disruptions.message ?? "No operational issues reported."}
              </p>
            )}

            {data.disruptions.updatedAt ? (
              <p className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400">
                Status update: {data.disruptions.updatedAt}
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {data.disruptions.message ?? "Operational status is not available for this airport."}
          </p>
        )}

        {data.disruptions.source ? (
          <p className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400">
            Source: {" "}
            {data.disruptions.sourceUrl ? (
              <a
                href={data.disruptions.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {data.disruptions.source}
              </a>
            ) : (
              data.disruptions.source
            )}
          </p>
        ) : null}
      </section>

      <p className="flex items-center gap-1.5 text-[11px] text-zinc-500 md:col-span-2 dark:text-zinc-400">
        <Clock3 className="size-3" aria-hidden="true" />
        Status response {formatTimestamp(data.fetchedAt)} · Confirm live conditions with official sources before travel.
      </p>
    </div>
  );
}
