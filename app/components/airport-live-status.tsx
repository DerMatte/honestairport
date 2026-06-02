import { AlertTriangle, Clock3, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AirportLiveData, AirportDisruption, SecurityCheckpoint } from "@/lib/airport-live-data";

interface AirportLiveStatusProps {
  data: AirportLiveData;
  className?: string;
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
        <div className="font-medium text-sm">{checkpoint.name}</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {securityLaneLabel(checkpoint.laneType)}
          {checkpoint.terminal ? ` • ${checkpoint.terminal}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-sm">{checkpoint.displayWait}</div>
        {checkpoint.lastUpdated ? (
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Updated {checkpoint.lastUpdated}</div>
        ) : null}
      </div>
    </div>
  );
}

function DisruptionRow({ disruption }: { disruption: AirportDisruption }) {
  const delayRange =
    disruption.minDelay && disruption.maxDelay
      ? `${disruption.minDelay} – ${disruption.maxDelay}`
      : disruption.minDelay ?? disruption.maxDelay;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="font-medium text-sm">{disruptionTitle(disruption.type)}</div>
      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{disruption.reason}</div>
      {delayRange ? (
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {disruption.type === "closure" ? "Window" : "Delay range"}: {delayRange}
          {disruption.trend ? ` • Trend: ${disruption.trend}` : ""}
        </div>
      ) : null}
    </div>
  );
}

export function AirportLiveStatus({ data, className }: AirportLiveStatusProps) {
  const hasSecurity = data.security.supported && data.security.checkpoints.length > 0;
  const hasDisruptions = data.disruptions.supported;
  const showSection = hasSecurity || hasDisruptions;

  if (!showSection) {
    return (
      <div
        className={cn(
          "mb-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900",
          className,
        )}
      >
        <div className="flex items-center gap-2 font-semibold text-sm tracking-wide">
          <Clock3 className="size-4" aria-hidden="true" />
          Live airport status
        </div>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Live security wait times and operational disruptions are not available for this airport yet.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("mb-8 grid gap-4 md:grid-cols-2", className)}>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2 font-semibold text-sm tracking-wide">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Security wait times
        </div>

        {hasSecurity ? (
          <div className="mt-4 space-y-3">
            {data.security.checkpoints.map((checkpoint) => (
              <CheckpointRow key={checkpoint.id} checkpoint={checkpoint} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {data.security.message ??
              "Checkpoint-level wait times are not published for this airport."}
          </p>
        )}

        {data.security.source ? (
          <p className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400">
            Source:{" "}
            {data.security.sourceUrl ? (
              <a
                href={data.security.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {data.security.source}
              </a>
            ) : (
              data.security.source
            )}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-sm tracking-wide">
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
            Source:{" "}
            {data.disruptions.sourceUrl ? (
              <a
                href={data.disruptions.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                {data.disruptions.source}
              </a>
            ) : (
              data.disruptions.source
            )}
          </p>
        ) : null}
      </section>

      <p className="md:col-span-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        Live data fetched at {new Date(data.fetchedAt).toLocaleString()} • Estimates only — always confirm with official sources before travel.
      </p>
    </div>
  );
}
