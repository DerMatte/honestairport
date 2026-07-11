import Link from "next/link";
import { ArrowRight, Clock3, DoorOpen, KeyRound, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PROGRAM_LABELS,
  type AirportLoungeVerdict,
  type AirportLoungeView,
  type LoungeAccessMethod,
} from "@/lib/airport-content";

export function LoungeVerdictBadge({ verdict }: { verdict: AirportLoungeVerdict }) {
  switch (verdict) {
    case "worth-it":
      return (
        <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          Worth it
        </Badge>
      );
    case "depends":
      return (
        <Badge variant="secondary" className="rounded-full">
          Depends
        </Badge>
      );
    case "skip":
      return (
        <Badge className="rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300">
          Skip it
        </Badge>
      );
    default: {
      const exhaustiveCheck: never = verdict;
      return exhaustiveCheck;
    }
  }
}

export function LoungeStatusBadge({ status }: { status: AirportLoungeView["status"] }) {
  if (status === "open") {
    return null;
  }

  return (
    <Badge className="rounded-full bg-red-500/15 text-red-700 dark:text-red-300">
      {status === "temporarily-closed" ? "Temporarily closed" : "Closed"}
    </Badge>
  );
}

export function accessMethodLabel(method: LoungeAccessMethod): string {
  return method.label ?? PROGRAM_LABELS[method.program];
}

export function LoungeFactRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 text-sm">
      <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center text-primary [&_svg]:size-4">
        {icon}
      </div>
      <div>
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}

export function AirportLoungeCard({
  lounge,
  href,
}: {
  lounge: AirportLoungeView;
  /** Link to the lounge's subpage; omitted for legacy guide-jsonb lounges. */
  href?: string;
}) {
  return (
    <Card className="relative h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-5">
            <DoorOpen aria-hidden="true" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <LoungeStatusBadge status={lounge.status} />
            {lounge.verdict ? <LoungeVerdictBadge verdict={lounge.verdict} /> : null}
          </div>
        </div>
        <CardTitle>
          {href ? (
            <Link href={href} className="after:absolute after:inset-0 hover:underline">
              {lounge.name}
            </Link>
          ) : (
            lounge.name
          )}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full">
            {lounge.terminal}
          </Badge>
          {lounge.zone ? (
            <Badge variant="outline" className="rounded-full">
              {lounge.zone}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{lounge.summary}</p>
        <div className="space-y-3">
          {lounge.access.length ? (
            <LoungeFactRow icon={<KeyRound aria-hidden="true" />} label="Access">
              {lounge.access.map(accessMethodLabel).join(" · ")}
            </LoungeFactRow>
          ) : null}
          {lounge.hours ? (
            <LoungeFactRow icon={<Clock3 aria-hidden="true" />} label="Hours">
              {lounge.hours}
            </LoungeFactRow>
          ) : null}
          {lounge.amenities.length ? (
            <LoungeFactRow icon={<Sparkles aria-hidden="true" />} label="Amenities">
              {lounge.amenities.join(" · ")}
            </LoungeFactRow>
          ) : null}
          {lounge.bestFor.length ? (
            <LoungeFactRow icon={<Users aria-hidden="true" />} label="Best for">
              {lounge.bestFor.join(" · ")}
            </LoungeFactRow>
          ) : null}
        </div>
        {href ? (
          <p className="flex items-center gap-1 text-sm font-medium text-primary">
            Full access guide
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AirportLoungeGrid({
  lounges,
  iata,
}: {
  lounges: AirportLoungeView[];
  /** Enables links to `/airports/{iata}/lounge/{slug}` for directory lounges. */
  iata?: string;
}) {
  if (!lounges.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lounges.map((lounge) => (
        <AirportLoungeCard
          key={lounge.slug ?? `${lounge.terminal}-${lounge.name}`}
          lounge={lounge}
          href={
            lounge.slug && iata
              ? `/airports/${iata.toLowerCase()}/lounge/${lounge.slug}`
              : undefined
          }
        />
      ))}
    </div>
  );
}
