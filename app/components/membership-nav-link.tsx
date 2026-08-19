"use client";

import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MembershipNavLink({
  checkoutUrl,
}: {
  checkoutUrl: string | null;
}) {
  if (!checkoutUrl) {
    return null;
  }

  return (
    <Button variant="ghost" size="sm" className="gap-1.5" asChild>
      <Link href="/members">
        <BadgeCheck className="size-4" aria-hidden="true" />
        Join
      </Link>
    </Button>
  );
}
