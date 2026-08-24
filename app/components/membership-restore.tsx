"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Phase =
  | { name: "idle" }
  | { name: "working" }
  | { name: "done" }
  | { name: "error"; message: string };

function messageForError(error: string): string {
  switch (error) {
    case "pending":
      return "Whop is still confirming that payment. Try again in a moment.";
    case "not_found":
      return "We could not find that receipt. Check the payment id and try again.";
    case "wrong_product":
      return "That receipt is for a different product.";
    case "not_paid":
      return "That payment is not an active paid membership.";
    case "invalid_receipt":
      return "Receipt ids look like pay_… — paste the one from your Whop receipt.";
    case "session_unconfigured":
      return "This server is missing a session secret, so we cannot store the membership cookie.";
    case "gate_off":
      return "Membership is not enabled on this environment.";
    default:
      return "We could not restore access. If you were charged, keep the receipt id and try again.";
  }
}

async function postUnlock(receiptId: string): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const res = await fetch("/api/whop/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiptId }),
  });
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, error: body?.error ?? "unlock_failed" };
}

export function MembershipRestore({
  paymentId,
  nextPath,
  checkoutHref,
}: {
  paymentId: string | null;
  nextPath: string;
  checkoutHref: string;
}) {
  const router = useRouter();
  const [receipt, setReceipt] = useState(paymentId ?? "");
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  async function unlock(receiptId: string) {
    setPhase({ name: "working" });
    try {
      const result = await postUnlock(receiptId);
      if (result.ok) {
        setPhase({ name: "done" });
        router.replace(nextPath);
        router.refresh();
        return;
      }
      setPhase({ name: "error", message: messageForError(result.error) });
    } catch {
      setPhase({
        name: "error",
        message: "We could not reach the server. Try again.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="lg" className="sm:flex-1" asChild>
          <a href={checkoutHref} rel="noopener noreferrer">
            Subscribe — $8/month
          </a>
        </Button>
      </div>

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const value = receipt.trim();
          if (value) {
            void unlock(value);
          }
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="whop-receipt">Already subscribed?</Label>
          <p className="text-xs leading-5 text-muted-foreground">
            After checkout, Whop may send you back here with a payment id. Paste
            the <span className="font-mono">pay_…</span> receipt to restore this
            browser — and, if you are signed in, save the Whop id on your
            account. Submit the prefilled value if the URL already has one.
          </p>
          <Input
            id="whop-receipt"
            name="receiptId"
            value={receipt}
            onChange={(event) => setReceipt(event.target.value)}
            placeholder="pay_…"
            autoComplete="off"
            disabled={phase.name === "working"}
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={phase.name === "working" || !receipt.trim()}
        >
          {phase.name === "working" ? "Restoring…" : "Restore access"}
        </Button>
      </form>

      {phase.name === "error" ? (
        <p className="text-sm text-destructive">{phase.message}</p>
      ) : null}
      {phase.name === "done" ? (
        <p className="text-sm text-muted-foreground">Access restored. Redirecting…</p>
      ) : null}
    </div>
  );
}
