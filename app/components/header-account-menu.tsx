"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleUserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";

function accountInitials(name: string, email: string) {
  const fromName = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  if (fromName) return fromName;
  return email.slice(0, 2).toUpperCase();
}

export function HeaderAccountMenu({
  membershipSlot,
  whopImage,
}: {
  membershipSlot?: ReactNode;
  /** Whop profile photo; takes precedence over Better Auth `user.image`. */
  whopImage?: string | null;
}) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  async function handleSignOut() {
    await signOut();
    router.refresh();
  }

  if (isPending) {
    return (
      <Skeleton className="size-8 rounded-full" aria-hidden="true" />
    );
  }

  if (!session) {
    return (
      <Button variant="ghost" size="icon" asChild>
        <Link href="/login" aria-label="Sign in">
          <CircleUserRound className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    );
  }

  const image = whopImage || session.user.image;
  const initials = accountInitials(session.user.name, session.user.email);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Account"
          className="rounded-full p-0"
        >
          <Avatar>
            {image ? <AvatarImage src={image} alt="" /> : null}
            <AvatarFallback className="bg-muted text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="truncate text-sm font-medium">{session.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {session.user.email}
        </p>
        {membershipSlot ? <div className="mt-2">{membershipSlot}</div> : null}
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
