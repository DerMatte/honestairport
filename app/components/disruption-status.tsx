import { AlertTriangle, CheckCircle2, CloudLightning, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SplitFlap } from "@/app/components/split-flap";
import { cn } from "@/lib/utils";
import {
  disruptionLabel,
  formatDateTime,
} from "@/lib/airport-utils";
import type { Disruption, DisruptionStatus } from "@/lib/types";

interface DisruptionBadgeProps {
  status: DisruptionStatus;
  className?: string;
}

interface DisruptionStatusPanelProps {
  disruption: Disruption;
  compact?: boolean;
}

/** Board-signal color per status: green/amber/amber/red, tuned for the dark casing. */
function statusClasses(status: DisruptionStatus): string {
  switch (status) {
    case "normal":
      return "border-[color:var(--board-green)]/30 bg-[color:var(--board-green)]/10 text-[color:var(--board-green)]";
    case "minor":
      return "border-primary/30 bg-primary/10 text-primary";
    case "moderate":
      return "border-primary/40 bg-primary/15 text-primary";
    case "severe":
      return "border-[color:var(--board-red)]/40 bg-[color:var(--board-red)]/15 text-[color:var(--board-red)]";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

function progressClasses(status: DisruptionStatus): string {
  switch (status) {
    case "normal":
      return "[&_[data-slot=progress-indicator]]:bg-[color:var(--board-green)]";
    case "minor":
      return "[&_[data-slot=progress-indicator]]:bg-primary";
    case "moderate":
      return "[&_[data-slot=progress-indicator]]:bg-primary";
    case "severe":
      return "[&_[data-slot=progress-indicator]]:bg-[color:var(--board-red)]";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

function statusIcon(status: DisruptionStatus) {
  switch (status) {
    case "normal":
      return <CheckCircle2 aria-hidden="true" />;
    case "minor":
      return <Plane aria-hidden="true" />;
    case "moderate":
      return <CloudLightning aria-hidden="true" />;
    case "severe":
      return <AlertTriangle aria-hidden="true" />;
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

export function DisruptionBadge({ status, className }: DisruptionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-[0.25rem] border px-1.5 [&>svg]:size-3",
        statusClasses(status),
        className,
      )}
    >
      {statusIcon(status)}
      <SplitFlap
        value={disruptionLabel(status).toUpperCase()}
        charClassName="h-4 w-[0.85ch] bg-transparent! text-[0.65rem] font-bold shadow-none!"
      />
    </span>
  );
}

function Metric({
  label,
  minutes,
  percent,
  status,
}: {
  label: string;
  minutes: number;
  percent: number;
  status: DisruptionStatus;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          {minutes} min · {percent}%
        </span>
      </div>
      <Progress
        value={Math.min(percent, 100)}
        className={cn("h-1.5", progressClasses(status))}
      />
    </div>
  );
}

export function DisruptionStatusPanel({
  disruption,
  compact = false,
}: DisruptionStatusPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Live Disruption Status</div>
          <p className="text-xs text-muted-foreground">
            Updated {formatDateTime(disruption.lastUpdated)}
          </p>
        </div>
        <DisruptionBadge status={disruption.status} />
      </div>

      <div className={cn("grid gap-4", compact ? "grid-cols-1" : "md:grid-cols-3")}>
        <Metric
          label="Departure delays"
          minutes={disruption.departureDelayMinutes}
          percent={disruption.departureDelayPercent}
          status={disruption.status}
        />
        <Metric
          label="Arrival delays"
          minutes={disruption.arrivalDelayMinutes}
          percent={disruption.arrivalDelayPercent}
          status={disruption.status}
        />
        <Metric
          label="Cancellations"
          minutes={0}
          percent={disruption.cancellationsPercent}
          status={disruption.status}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {disruption.alerts.length > 0 ? (
          disruption.alerts.map((alert) => (
            <Badge key={alert} variant="secondary" className="rounded-full">
              {alert}
            </Badge>
          ))
        ) : (
          <Badge variant="secondary" className="rounded-full">
            No major alerts
          </Badge>
        )}
      </div>
    </div>
  );
}
