import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsForm } from "@/app/components/settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your HonestAirport profile and password.",
};

function SettingsPageFallback() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:py-16">
      <div className="space-y-1.5">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageFallback />}>
      <SettingsPageContent />
    </Suspense>
  );
}

async function SettingsPageContent() {
  if (!isDatabaseConfigured()) {
    redirect("/");
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-12 sm:py-16">
      <div className="space-y-1.5">
        <h1 className="font-heading text-3xl font-medium tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Update your profile details and password.
        </p>
      </div>
      <SettingsForm
        user={{
          name: session.user.name,
          email: session.user.email,
          emailVerified: session.user.emailVerified,
        }}
      />
    </div>
  );
}
