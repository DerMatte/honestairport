"use client"

import * as ResizablePrimitive from "react-resizable-panels"
import { GripVerticalIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px justify-center bg-border outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        // Sticky so the grip stays in view even when the separator spans a
        // page much taller than the viewport.
        <div className="sticky top-[50vh] z-10 flex h-8 w-3 shrink-0 items-center justify-center rounded-xs border bg-border">
          <GripVerticalIcon className="size-2.5" aria-hidden="true" />
        </div>
      ) : null}
      {children}
    </ResizablePrimitive.Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
