"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Dialog as NavDialog, VisuallyHidden } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SiteSidebar } from "@/app/components/site-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: { name: string; email: string } | null;
  isPending: boolean;
  onNavigate: () => void;
  onSignOut: () => void;
  nearestAirportSlot: ReactNode;
}

export function MobileNav({
  open,
  onOpenChange,
  user,
  isPending,
  onNavigate,
  onSignOut,
  nearestAirportSlot,
}: MobileNavProps) {
  const shouldReduceMotion = useReducedMotion();

  // Radix Dialog only locks scroll via its Overlay; since this panel skips
  // the overlay (it fully covers the viewport below the header itself),
  // lock scroll here instead.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // The nearest-airport link is server-rendered (no client onClick available),
  // so close the panel on any route change as a catch-all alongside the
  // explicit onNavigate handlers used by the other, client-rendered links.
  const pathname = usePathname();
  const isInitialPathname = useRef(true);
  useEffect(() => {
    if (isInitialPathname.current) {
      isInitialPathname.current = false;
      return;
    }
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  return (
    <NavDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <NavDialog.Portal forceMount>
            <NavDialog.Content forceMount asChild>
              <motion.div
                className="fixed inset-x-0 top-14 bottom-0 z-40 outline-none md:hidden"
                initial={{ y: "-100%" }}
                animate={{ y: 0 }}
                exit={{ y: "-100%" }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "tween", duration: 0.32, ease: [0.32, 0.72, 0, 1] }
                }
              >
                <VisuallyHidden.Root asChild>
                  <NavDialog.Title>Menu</NavDialog.Title>
                </VisuallyHidden.Root>
                <VisuallyHidden.Root asChild>
                  <NavDialog.Description>
                    Find airports and manage your account.
                  </NavDialog.Description>
                </VisuallyHidden.Root>
                <div className="h-full w-full overflow-y-auto border-t border-border/60 bg-sidebar text-sidebar-foreground shadow-lg">
                  <SidebarProvider className="h-full w-full !min-h-0">
                    <SiteSidebar
                      user={user}
                      isPending={isPending}
                      onNavigate={onNavigate}
                      onSignOut={onSignOut}
                      nearestAirportSlot={nearestAirportSlot}
                    />
                  </SidebarProvider>
                </div>
              </motion.div>
            </NavDialog.Content>
          </NavDialog.Portal>
        )}
      </AnimatePresence>
    </NavDialog.Root>
  );
}
