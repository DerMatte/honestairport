"use client";

import dynamic from "next/dynamic";
import { Plane, Sparkles } from "lucide-react";
import { useState } from "react";
import { Loading } from "@/components/ai-elements/loading";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const AssistantPanel = dynamic(() => import("@/app/components/assistant-panel"), {
  loading: () => <Loading className="m-auto" label="Opening assistant" />,
});

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ask HonestAirport"
          title="Ask HonestAirport"
        >
          <Sparkles className="size-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="h-[100dvh] w-full gap-0 sm:max-w-md"
        aria-describedby="assistant-description"
      >
        <SheetHeader className="border-b border-border/60 pr-12">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Plane className="size-3.5 -rotate-45" aria-hidden="true" />
            </span>
            Ask HonestAirport
          </SheetTitle>
          <SheetDescription id="assistant-description">
            Answers grounded in our airport guides and scores.
          </SheetDescription>
        </SheetHeader>
        {open ? <AssistantPanel /> : null}
      </SheetContent>
    </Sheet>
  );
}
