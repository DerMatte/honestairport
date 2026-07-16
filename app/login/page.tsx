import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm, type LoginNotice } from "@/app/components/login-form";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in or create an account.",
};

function noticeFromParams(params: {
  error?: string;
  reset?: string;
}): LoginNotice | null {
  if (params.error) {
    return {
      tone: "error",
      message: "That link is invalid or has expired. Request a fresh one.",
    };
  }
  if (params.reset === "success") {
    return {
      tone: "success",
      message: "Password updated — sign in with your new password.",
    };
  }
  return null;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
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
        notice={noticeFromParams(await searchParams)}
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
