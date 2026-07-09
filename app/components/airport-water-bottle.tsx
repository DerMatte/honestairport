import { Droplets, MapPin, Sparkles, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AirportWaterOption, AirportWaterOptionKind } from "@/lib/airport-content";

function kindLabel(kind: AirportWaterOptionKind): string {
  switch (kind) {
    case "purchase":
      return "Buy a bottle";
    case "refill":
      return "Refill station";
    case "free":
      return "Free water";
    default: {
      const exhaustiveCheck: never = kind;
      return exhaustiveCheck;
    }
  }
}

function kindBadge(kind: AirportWaterOptionKind) {
  switch (kind) {
    case "purchase":
      return (
        <Badge variant="secondary" className="rounded-full">
          {kindLabel(kind)}
        </Badge>
      );
    case "refill":
      return (
        <Badge className="rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300">
          {kindLabel(kind)}
        </Badge>
      );
    case "free":
      return (
        <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          {kindLabel(kind)}
        </Badge>
      );
    default: {
      const exhaustiveCheck: never = kind;
      return exhaustiveCheck;
    }
  }
}

function WaterFactRow({
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

export function AirportWaterOptionCard({ option }: { option: AirportWaterOption }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-300 [&_svg]:size-5">
            <Droplets aria-hidden="true" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {option.isBestValue ? (
              <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                Best value
              </Badge>
            ) : null}
            {option.isBestQuality ? (
              <Badge className="rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300">
                Best quality
              </Badge>
            ) : null}
          </div>
        </div>
        <CardTitle>{option.name}</CardTitle>
        <p className="text-sm font-medium leading-6 text-foreground">{option.location}</p>
        <div className="flex flex-wrap gap-2">
          {kindBadge(option.kind)}
          <Badge variant="outline" className="rounded-full">
            {option.terminal}
          </Badge>
          {option.zone ? (
            <Badge variant="outline" className="rounded-full capitalize">
              {option.zone}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{option.summary}</p>
        <div className="space-y-3">
          {option.price ? (
            <WaterFactRow icon={<Tag aria-hidden="true" />} label="Price">
              {option.price}
            </WaterFactRow>
          ) : null}
          <WaterFactRow icon={<MapPin aria-hidden="true" />} label="Terminal">
            {option.terminal}
            {option.zone ? ` · ${option.zone}` : ""}
          </WaterFactRow>
        </div>
      </CardContent>
    </Card>
  );
}

export function AirportWaterOptionGrid({ options }: { options: AirportWaterOption[] }) {
  if (!options.length) {
    return null;
  }

  const bestValue = options.find((option) => option.isBestValue);
  const bestQuality = options.find((option) => option.isBestQuality);

  return (
    <div className="space-y-4">
      {bestValue || bestQuality ? (
        <div className="grid gap-4 md:grid-cols-2">
          {bestValue ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tag className="size-4" aria-hidden="true" />
                  Cheapest pick
                </CardTitle>
                <CardDescription>
                  The lowest-priced reliable bottle option we found.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{bestValue.name}</p>
                <p className="font-medium text-foreground">{bestValue.location}</p>
                <p className="text-muted-foreground">{bestValue.summary}</p>
                {bestValue.price ? (
                  <p className="font-mono text-base">{bestValue.price}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
          {bestQuality ? (
            <Card className="border-violet-500/30 bg-violet-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="size-4" aria-hidden="true" />
                  Best bottle
                </CardTitle>
                <CardDescription>
                  Worth paying a bit more for taste, size, or availability.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{bestQuality.name}</p>
                <p className="font-medium text-foreground">{bestQuality.location}</p>
                <p className="text-muted-foreground">{bestQuality.summary}</p>
                {bestQuality.price ? (
                  <p className="font-mono text-base">{bestQuality.price}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <AirportWaterOptionCard
            key={`${option.kind}-${option.terminal}-${option.name}-${option.location}`}
            option={option}
          />
        ))}
      </div>
    </div>
  );
}
