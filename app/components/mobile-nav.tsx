"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as NavDialog, VisuallyHidden } from "radix-ui";
import { SiteSidebar } from "@/app/components/site-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { signOut, useSession } from "@/lib/auth-client";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nearestAirportSlot: ReactNode;
}

export function MobileNav({
  open,
  onOpenChange,
  nearestAirportSlot,
}: MobileNavProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

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

  async function handleSignOut() {
    await signOut();
    onOpenChange(false);
    router.refresh();
  }

  return (
    <NavDialog.Root open={open} onOpenChange={onOpenChange}>
      <NavDialog.Portal>
        <NavDialog.Content
          className="site-mobile-nav fixed inset-x-0 top-14 bottom-0 z-40 outline-none md:hidden"
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
                user={
                  session
                    ? {
                        name: session.user.name,
                        email: session.user.email,
                      }
                    : null
                }
                isPending={isPending}
                onNavigate={() => onOpenChange(false)}
                onSignOut={handleSignOut}
                nearestAirportSlot={nearestAirportSlot}
              />
            </SidebarProvider>
          </div>
        </NavDialog.Content>
      </NavDialog.Portal>
    </NavDialog.Root>
  );
}
