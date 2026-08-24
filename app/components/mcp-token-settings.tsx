"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { McpTokenStatus } from "@/lib/mcp/tokens";

interface McpTokenSettingsProps {
  initialStatus: McpTokenStatus;
}

export function McpTokenSettings({ initialStatus }: McpTokenSettingsProps) {
  const [status, setStatus] = useState(initialStatus);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "revoke" | null>(null);
  const [copied, setCopied] = useState(false);

  async function generateToken() {
    if (
      status.hasToken &&
      !window.confirm(
        "Regenerating replaces your current MCP token. Existing clients will stop working until you update them.",
      )
    ) {
      return;
    }

    setBusy("generate");
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/account/mcp-token", { method: "POST" });
      const data = (await response.json()) as {
        error?: string;
        token?: string;
        hasToken?: boolean;
        prefix?: string | null;
        createdAt?: string | null;
      };
      if (!response.ok || !data.token) {
        setError(data.error ?? "Couldn't create an MCP token — try again.");
        return;
      }
      setRevealedToken(data.token);
      setStatus({
        hasToken: true,
        prefix: data.prefix ?? null,
        createdAt: data.createdAt ?? null,
      });
    } finally {
      setBusy(null);
    }
  }

  async function revokeToken() {
    if (!window.confirm("Revoke this MCP token? Clients using it will get 401.")) {
      return;
    }

    setBusy("revoke");
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/account/mcp-token", { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Couldn't revoke the token — try again.");
        return;
      }
      setRevealedToken(null);
      setStatus({ hasToken: false, prefix: null, createdAt: null });
    } finally {
      setBusy(null);
    }
  }

  async function copyToken() {
    if (!revealedToken) {
      return;
    }
    await navigator.clipboard.writeText(revealedToken);
    setCopied(true);
  }

  const createdLabel = status.createdAt
    ? new Date(status.createdAt).toLocaleString()
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP token</CardTitle>
        <CardDescription>
          Personal access token for the remote MCP server at{" "}
          <code className="text-xs">/mcp</code>. Shown once when you create it —
          regenerate from this page if you lose it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status.hasToken ? (
          <p className="text-sm text-muted-foreground">
            Token on this account:{" "}
            <code className="text-foreground">{status.prefix}…</code>
            {createdLabel ? ` · created ${createdLabel}` : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No MCP token yet. Generate one to connect Cursor or Claude.
          </p>
        )}

        {revealedToken ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Copy this now. We store only a hash, so it cannot be shown again.
            </p>
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted/50 px-2.5 py-2 text-xs">
                {revealedToken}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  void copyToken();
                }}
                aria-label="Copy MCP token"
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              void generateToken();
            }}
          >
            {busy === "generate"
              ? "Generating…"
              : status.hasToken
                ? "Regenerate token"
                : "Generate token"}
          </Button>
          {status.hasToken ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => {
                void revokeToken();
              }}
            >
              {busy === "revoke" ? "Revoking…" : "Revoke"}
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Send it as{" "}
          <code>Authorization: Bearer &lt;token&gt;</code> when adding{" "}
          <code>https://www.honestairport.com/mcp</code> as a remote MCP server.
        </p>
      </CardContent>
    </Card>
  );
}
