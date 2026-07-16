import { Droplets, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        {option.price ? (
          <WaterFactRow icon={<Tag aria-hidden="true" />} label="Price">
            {option.price}
          </WaterFactRow>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AirportWaterOptionGrid({ options }: { options: AirportWaterOption[] }) {
  if (!options.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {options.map((option) => (
        <AirportWaterOptionCard
          key={`${option.kind}-${option.terminal}-${option.name}-${option.location}`}
          option={option}
        />
      ))}
    </div>
  );
}
