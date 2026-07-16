"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { signIn, signUp } from "@/lib/auth-client";

type SocialProvider = "github" | "apple";

interface LoginFormProps {
  providers: Record<SocialProvider, boolean>;
}

const SOCIAL_LABELS: Record<SocialProvider, string> = {
  github: "Continue with GitHub",
  apple: "Continue with Apple",
};

export function LoginForm({ providers }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signingIn = mode === "sign-in";
  const anySocial = providers.github || providers.apple;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = signingIn
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong — try again.");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{signingIn ? "Sign in" : "Create an account"}</CardTitle>
        <CardDescription>
          {signingIn
            ? "Welcome back — sign in to your account."
            : "Sign up with your email and a password."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {anySocial ? (
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
          {signingIn ? null : (
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
          )}

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

          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete={signingIn ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : signingIn ? "Sign in" : "Sign up"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {signingIn ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-4"
            onClick={() => {
              setMode(signingIn ? "sign-up" : "sign-in");
              setError(null);
            }}
          >
            {signingIn ? "Sign up" : "Sign in"}
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
