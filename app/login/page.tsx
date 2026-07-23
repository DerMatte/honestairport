import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm, type LoginNotice } from "@/app/components/login-form";
import { Skeleton } from "@/components/ui/skeleton";
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

/** Only allow relative in-app paths — reject protocol-relative / absolute URLs. */
function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

function LoginPageFallback() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:py-16">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="mt-3 h-4 w-64" />
      <Skeleton className="mt-8 h-72 w-full rounded-xl" />
    </main>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; next?: string }>;
}) {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string; next?: string }>;
}) {
  if (!isDatabaseConfigured()) {
    redirect("/");
  }

  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-12 sm:py-16">
      <LoginForm
        notice={noticeFromParams(params)}
        nextPath={nextPath}
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
