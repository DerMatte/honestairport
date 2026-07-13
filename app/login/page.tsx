import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/components/login-form";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create an account.",
};

export default async function LoginPage() {
  if (!isDatabaseConfigured()) {
    redirect("/");
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:py-16">
      <LoginForm
        providers={{
          github: Boolean(
            process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
          ),
          apple: Boolean(
            process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET,
          ),
        }}
      />
    </main>
  );
}
