import type React from "react";
import { AlertTriangle, Clock3, Map, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tipCategoryLabel } from "@/lib/airport-utils";
import { cn } from "@/lib/utils";
import type { Airport, ImportantTip, ImportantTipCategory, TipCategory } from "@/lib/types";

interface AirportTipBentoProps {
  airport: Airport;
  guideTips?: ImportantTip[];
}

const categoryStyles: Record<
  ImportantTipCategory,
  {
    label: string;
    className: string;
    icon: React.ReactNode;
  }
> = {
  timing: {
    label: "Timing",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    icon: <Clock3 aria-hidden="true" />,
  },
  terminal: {
    label: "Terminal",
    className: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    icon: <Map aria-hidden="true" />,
  },
  food: {
    label: "Food",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: <Utensils aria-hidden="true" />,
  },
  status: {
    label: "Status",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: <AlertTriangle aria-hidden="true" />,
  },
};

function compactCategory(category: TipCategory): ImportantTipCategory {
  switch (category) {
    case "food":
      return "food";
    case "navigation":
    case "lounge":
      return "terminal";
    case "security":
    case "layover":
    case "transport":
    case "family":
      return "timing";
    default: {
      const exhaustiveCheck: never = category;
      return exhaustiveCheck;
    }
  }
}

function fallbackTips(airport: Airport): ImportantTip[] {
  return airport.tips.slice(0, 4).map((tip) => ({
    id: `important-${tip.id}`,
    category: compactCategory(tip.category),
    label: tipCategoryLabel(tip.category),
    title: tip.title,
    summary: tip.summary,
    detail: tip.details,
  }));
}

export function AirportTipBento({ airport, guideTips }: AirportTipBentoProps) {
  const tips = (
    guideTips?.length
      ? guideTips
      : airport.importantTips?.length
        ? airport.importantTips
        : fallbackTips(airport)
  ).slice(0, 4);

  if (tips.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="important-tips-heading">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Most important tips</p>
          <h2 id="important-tips-heading" className="text-2xl font-semibold tracking-tight">
            Know before you go
          </h2>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          A compact traveler cheat sheet for timing, terminals, food, and disruption checks.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {tips.map((tip, index) => {
          const style = categoryStyles[tip.category];

          return (
            <Card
              key={tip.id}
              size="sm"
              className={cn(
                "border-border/70 bg-card/95 shadow-sm",
                index === 0 && "md:col-span-2",
              )}
            >
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="secondary" className="rounded-full">
                    {tip.label || style.label}
                  </Badge>
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-4",
                      style.className,
                    )}
                  >
                    {style.icon}
                  </span>
                </div>
                <CardTitle>{tip.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium leading-5">{tip.summary}</p>
                {tip.detail ? (
                  <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
                    {tip.detail}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
