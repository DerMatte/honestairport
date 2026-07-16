import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/app/components/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Choose a new password for your account.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  if (!isDatabaseConfigured()) {
    redirect("/");
  }

  const { token, error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:py-16">
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
    </main>
  );
}
