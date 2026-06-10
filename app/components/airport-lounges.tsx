import { Clock3, DoorOpen, KeyRound, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AirportLounge, AirportLoungeVerdict } from "@/lib/airport-content";

function verdictBadge(verdict: AirportLoungeVerdict) {
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

function LoungeFactRow({
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

export function AirportLoungeCard({ lounge }: { lounge: AirportLounge }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-5">
            <DoorOpen aria-hidden="true" />
          </div>
          {lounge.verdict ? verdictBadge(lounge.verdict) : null}
        </div>
        <CardTitle>{lounge.name}</CardTitle>
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
              {lounge.access.join(" · ")}
            </LoungeFactRow>
          ) : null}
          {lounge.hours ? (
            <LoungeFactRow icon={<Clock3 aria-hidden="true" />} label="Hours">
              {lounge.hours}
            </LoungeFactRow>
          ) : null}
          {lounge.amenities?.length ? (
            <LoungeFactRow icon={<Sparkles aria-hidden="true" />} label="Amenities">
              {lounge.amenities.join(" · ")}
            </LoungeFactRow>
          ) : null}
          {lounge.bestFor?.length ? (
            <LoungeFactRow icon={<Users aria-hidden="true" />} label="Best for">
              {lounge.bestFor.join(" · ")}
            </LoungeFactRow>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AirportLoungeGrid({ lounges }: { lounges: AirportLounge[] }) {
  if (!lounges.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {lounges.map((lounge) => (
        <AirportLoungeCard key={`${lounge.terminal}-${lounge.name}`} lounge={lounge} />
      ))}
    </div>
  );
}
