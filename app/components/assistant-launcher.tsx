"use client";

import dynamic from "next/dynamic";
import { RadioTower } from "lucide-react";
import { useState } from "react";
import { SplitFlapText } from "@/app/components/split-flap-text";
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
  loading: () => (
    <Loading
      className="assistant-loading m-auto"
      label="Opening guide desk"
    />
  ),
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
          className="assistant-trigger"
        >
          <span className="assistant-trigger__lamp" aria-hidden="true" />
          <RadioTower className="size-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="assistant-sheet h-[100dvh] w-full gap-0 sm:max-w-md"
      >
        <SheetHeader className="assistant-sheet__header pr-12">
          <div className="assistant-sheet__status">
            <span aria-hidden="true" />
            Guide link / ready
          </div>
          <SheetTitle className="assistant-sheet__title">
            <SplitFlapText
              className="assistant-sheet__flaps"
              length={9}
              text="ASK GUIDE"
              tone="amber"
            />
          </SheetTitle>
          <SheetDescription className="assistant-sheet__description">
            Grounded in HonestAirport guides and Airportist Scores.
          </SheetDescription>
        </SheetHeader>
        {open ? <AssistantPanel /> : null}
      </SheetContent>
    </Sheet>
  );
}
