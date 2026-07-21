"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

const SHEET_EXIT_DURATION_MS = 200

const SheetMotionContext = React.createContext<{
  open: boolean
  present: boolean
} | null>(null)

function Sheet({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen
  const [present, setPresent] = React.useState(open)

  React.useEffect(() => {
    if (open) {
      setPresent(true)
      return
    }

    const timeoutId = window.setTimeout(
      () => setPresent(false),
      SHEET_EXIT_DURATION_MS
    )

    return () => window.clearTimeout(timeoutId)
  }, [open])

  function handleOpenChange(nextOpen: boolean) {
    if (openProp === undefined) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  return (
    <SheetMotionContext.Provider value={{ open, present: open || present }}>
      <SheetPrimitive.Root
        data-slot="sheet"
        open={open}
        onOpenChange={handleOpenChange}
        {...props}
      />
    </SheetMotionContext.Provider>
  )
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  const motion = React.useContext(SheetMotionContext)

  if (motion && !motion.present) {
    return null
  }

  return (
    <SheetPrimitive.Portal
      {...props}
      data-slot="sheet-portal"
      forceMount={motion ? true : props.forceMount}
    />
  )
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  const motion = React.useContext(SheetMotionContext)

  return (
    <SheetPrimitive.Overlay
      {...props}
      forceMount={motion ? true : props.forceMount}
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 opacity-100 transition-opacity duration-[var(--duration-drawer)] ease-[var(--ease-out)] supports-backdrop-filter:backdrop-blur-xs data-closed:pointer-events-none data-closed:opacity-0 motion-reduce:duration-100",
        className
      )}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  const motion = React.useContext(SheetMotionContext)

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        {...props}
        forceMount={motion ? true : props.forceMount}
        data-slot="sheet-content"
        data-side={side}
        aria-hidden={motion && !motion.open ? true : undefined}
        inert={motion && !motion.open ? true : undefined}
        className={cn(
          "fixed z-50 flex translate-x-0 translate-y-0 flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground opacity-100 shadow-lg transition-[translate,opacity] duration-[var(--duration-drawer)] ease-[var(--ease-drawer)] data-closed:pointer-events-none data-closed:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-closed:translate-y-full data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-closed:-translate-x-full data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-closed:translate-x-full data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-closed:-translate-y-full data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm motion-reduce:transition-opacity motion-reduce:duration-100 motion-reduce:ease-[var(--ease-out)]",
          className
        )}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 right-3"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
