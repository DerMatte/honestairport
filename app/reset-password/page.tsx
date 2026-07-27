import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/app/components/reset-password-form";
import { UtilityPageShell } from "@/app/components/utility-page-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your account.",
};

function ResetPasswordFallback() {
  return (
    <UtilityPageShell
      code="RESET"
      eyebrow="Account recovery"
      title="Set a new password"
      description="Replace the credentials for your HonestAirport account."
      note="A completed reset signs out your other sessions so the new password is the only active one."
      status="Secure link active"
    >
      <Skeleton className="h-72 w-full rounded-xl" />
    </UtilityPageShell>
  );
}

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPasswordPageContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  if (!isDatabaseConfigured()) {
    redirect("/");
  }

  const { token, error } = await searchParams;

  return (
    <UtilityPageShell
      code="RESET"
      eyebrow="Account recovery"
      title={token && !error ? "Set a new password" : "Reset link expired"}
      description={
        token && !error
          ? "Replace the credentials for your HonestAirport account."
          : "This recovery link is no longer cleared for use."
      }
      note={
        token && !error
          ? "A completed reset signs out your other sessions so the new password is the only active one."
          : "Requesting another link from the sign-in page is the fastest way back into your account."
      }
      status={token && !error ? "Secure link active" : "Link out of service"}
      statusTone={token && !error ? "normal" : "warning"}
    >
      {token && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Link expired</CardTitle>
            <CardDescription>
              This password reset link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Head back to the{" "}
              <Link
                href="/login"
                className="font-medium text-foreground underline underline-offset-4"
              >
                sign-in page
              </Link>{" "}
              and use “Forgot password?” to request a new one.
            </p>
          </CardContent>
        </Card>
      )}
    </UtilityPageShell>
  );
}
