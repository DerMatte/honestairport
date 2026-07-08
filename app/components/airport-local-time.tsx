"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

interface AirportLocalTimeProps {
  timeZone: string;
  label: string;
}

/**
 * Live local clock at the airport's time zone. Rendered client-only (starts
 * empty, fills in after mount) so the server-rendered markup never disagrees
 * with the visitor's clock and trips a hydration warning.
 */
export function AirportLocalTime({ timeZone, label }: AirportLocalTimeProps) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    });

    const tick = () => setTime(formatter.format(new Date()));
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [timeZone]);

  if (!time) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Clock className="size-3.5" aria-hidden="true" />
      {label} <span className="font-mono text-foreground">{time}</span>
    </span>
  );
}
