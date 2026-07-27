import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsForm } from "@/app/components/settings-form";
import { UtilityPageShell } from "@/app/components/utility-page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your HonestAirport profile and password.",
};

function SettingsPageFallback() {
  return (
    <UtilityPageShell
      code="ACCOUNT"
      eyebrow="Account control"
      title="Your settings"
      description="Manage how your account identifies you and keep its access secure."
      note="Your email address is the fixed account identifier. Your display name and password can be updated here."
      wide
    >
      <Skeleton className="h-[42rem] w-full rounded-xl" />
    </UtilityPageShell>
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
    <UtilityPageShell
      code="ACCOUNT"
      eyebrow="Account control"
      title="Your settings"
      description="Manage how your account identifies you and keep its access secure."
      note="Your email address is the fixed account identifier. Your display name and password can be updated here."
      wide
    >
      <SettingsForm
        user={{
          name: session.user.name,
          email: session.user.email,
          emailVerified: session.user.emailVerified,
        }}
      />
    </UtilityPageShell>
  );
}
