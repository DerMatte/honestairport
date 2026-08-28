"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";

export function HeaderAccountMenu() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  async function handleSignOut() {
    await signOut();
    router.refresh();
  }

  if (isPending) {
    return <Skeleton className="h-8 w-[72px]" />;
  }

  if (!session) {
    return (
      <Button variant="ghost" size="sm" asChild>
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <CircleUserRound className="size-4" aria-hidden="true" />
          Account
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="truncate text-sm font-medium">{session.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {session.user.email}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
