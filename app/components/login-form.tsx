"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { requestPasswordReset, signIn, signUp } from "@/lib/auth-client";

type SocialProvider = "github" | "apple";

type Mode = "sign-in" | "sign-up" | "forgot-password";
type SentKind = "reset" | "verify";

export interface LoginNotice {
  tone: "error" | "success";
  message: string;
}

interface LoginFormProps {
  providers: Record<SocialProvider, boolean>;
  notice?: LoginNotice | null;
}

const SOCIAL_LABELS: Record<SocialProvider, string> = {
  github: "Continue with GitHub",
  apple: "Continue with Apple",
};

const COPY: Record<Mode, { title: string; description: string }> = {
  "sign-in": {
    title: "Sign in",
    description: "Welcome back — sign in to your account.",
  },
  "sign-up": {
    title: "Create an account",
    description: "Sign up with your email and a password.",
  },
  "forgot-password": {
    title: "Reset your password",
    description: "Enter your email and we'll send you a reset link.",
  },
};

function sentCopy(
  kind: SentKind,
  email: React.ReactNode,
): { title: string; body: React.ReactNode } {
  switch (kind) {
    case "reset":
      return {
        title: "Check your inbox",
        body: (
          <>
            If an account exists for {email}, a password reset link is on its
            way.
          </>
        ),
      };
    case "verify":
      return {
        title: "You're in!",
        body: (
          <>
            Your account is ready. We also sent a verification link to {email}{" "}
            — click it when you get a chance.
          </>
        ),
      };
  }
}

export function LoginForm({ providers, notice }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [sent, setSent] = useState<SentKind | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const anySocial = providers.github || providers.apple;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSent(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "forgot-password") {
        const result = await requestPasswordReset({
          email,
          redirectTo: "/reset-password",
        });
        if (result.error) {
          setError(result.error.message ?? "Something went wrong — try again.");
          return;
        }
        setSentTo(email);
        setSent("reset");
        return;
      }

      const result =
        mode === "sign-in"
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name, callbackURL: "/" });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong — try again.");
        return;
      }

      if (mode === "sign-up") {
        // autoSignIn already created the session; refresh so the header
        // reflects it while the verification notice is on screen.
        setSentTo(email);
        setSent("verify");
        router.refresh();
        return;
      }

      router.push("/");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSocial(provider: SocialProvider) {
    setError(null);
    const result = await signIn.social({ provider, callbackURL: "/" });

    if (result.error) {
      setError(result.error.message ?? "Something went wrong — try again.");
    }
  }

  if (sent) {
    const copy = sentCopy(
      sent,
      <span className="font-medium text-foreground">{sentTo}</span>,
    );
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <MailCheck aria-hidden className="mb-2 size-8 text-primary" />
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {sent === "verify" ? (
            <Button
              onClick={() => {
                router.push("/");
                router.refresh();
              }}
            >
              Continue to the site
            </Button>
          ) : (
            <Button variant="outline" onClick={() => switchMode("sign-in")}>
              Back to sign in
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const passwordMode = mode === "sign-in" || mode === "sign-up";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{COPY[mode].title}</CardTitle>
        <CardDescription>{COPY[mode].description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice && !error ? (
          <p
            role={notice.tone === "error" ? "alert" : "status"}
            className={
              notice.tone === "error"
                ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                : "rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground"
            }
          >
            {notice.message}
          </p>
        ) : null}

        {anySocial && mode !== "forgot-password" ? (
          <>
            <div className="flex flex-col gap-2">
              {(Object.keys(SOCIAL_LABELS) as SocialProvider[])
                .filter((provider) => providers[provider])
                .map((provider) => (
                  <Button
                    key={provider}
                    variant="outline"
                    type="button"
                    onClick={() => handleSocial(provider)}
                  >
                    {SOCIAL_LABELS[provider]}
                  </Button>
                ))}
            </div>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
          </>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "sign-up" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="login-name">Name</Label>
              <Input
                id="login-name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {passwordMode ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                {mode === "sign-in" ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    onClick={() => switchMode("forgot-password")}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <Input
                id="login-password"
                type="password"
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : mode === "sign-in"
                ? "Sign in"
                : mode === "sign-up"
                  ? "Sign up"
                  : "Send reset link"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "sign-in" ? (
            <>
              No account yet?{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-4"
                onClick={() => switchMode("sign-up")}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              {mode === "sign-up" ? "Already have an account?" : ""}{" "}
              <button
                type="button"
                className="font-medium text-foreground underline underline-offset-4"
                onClick={() => switchMode("sign-in")}
              >
                {mode === "sign-up" ? "Sign in" : "Back to sign in"}
              </button>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
