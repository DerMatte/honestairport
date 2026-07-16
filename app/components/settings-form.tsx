"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogOut } from "lucide-react";
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
import {
  changePassword,
  signOut,
  updateUser,
} from "@/lib/auth-client";

interface SettingsFormProps {
  user: {
    name: string;
    email: string;
    emailVerified: boolean;
  };
}

export function SettingsForm({ user }: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    const trimmed = name.trim();
    if (!trimmed) {
      setProfileError("Name can't be empty.");
      return;
    }
    if (trimmed === user.name) {
      setProfileSuccess(true);
      return;
    }

    setProfileSaving(true);
    try {
      const result = await updateUser({ name: trimmed });
      if (result.error) {
        setProfileError(
          result.error.message ?? "Couldn't update your profile — try again.",
        );
        return;
      }
      setName(trimmed);
      setProfileSuccess(true);
      router.refresh();
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don’t match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setPasswordError(
          result.error.message ?? "Couldn’t change password — try again.",
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            How your name appears across HonestAirport.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-name">Name</Label>
              <Input
                id="settings-name"
                autoComplete="name"
                required
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setProfileSuccess(false);
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                value={user.email}
                disabled
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                {user.emailVerified ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                    Verified
                  </span>
                ) : (
                  "Not verified yet — check your inbox for a verification link."
                )}
              </p>
            </div>

            {profileError ? (
              <p role="alert" className="text-sm text-destructive">
                {profileError}
              </p>
            ) : null}
            {profileSuccess ? (
              <p role="status" className="text-sm text-foreground">
                Profile saved.
              </p>
            ) : null}

            <Button type="submit" disabled={profileSaving}>
              {profileSaving ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Update your password. You’ll stay signed in on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handlePasswordSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-current-password">Current password</Label>
              <Input
                id="settings-current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setPasswordSuccess(false);
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-new-password">New password</Label>
              <Input
                id="settings-new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordSuccess(false);
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="settings-confirm-password">
                Confirm new password
              </Label>
              <Input
                id="settings-confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setPasswordSuccess(false);
                }}
              />
            </div>

            {passwordError ? (
              <p role="alert" className="text-sm text-destructive">
                {passwordError}
              </p>
            ) : null}
            {passwordSuccess ? (
              <p role="status" className="text-sm text-foreground">
                Password updated.
              </p>
            ) : null}

            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            Sign out of HonestAirport on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Separator />
          <Button
            variant="outline"
            className="justify-start gap-2"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
