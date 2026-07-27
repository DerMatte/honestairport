import type { ReactNode } from "react";
import { SplitFlapText } from "@/app/components/split-flap-text";
import { cn } from "@/lib/utils";

interface UtilityPageShellProps {
  children: ReactNode;
  code: string;
  description: string;
  eyebrow: string;
  note: ReactNode;
  status?: string;
  statusTone?: "normal" | "warning" | "error";
  title: string;
  wide?: boolean;
}

export function UtilityPageShell({
  children,
  code,
  description,
  eyebrow,
  note,
  status = "Service available",
  statusTone = "normal",
  title,
  wide = false,
}: UtilityPageShellProps) {
  return (
    <div className="utility-page">
      <div
        className={cn("utility-page__frame", wide && "utility-page__frame--wide")}
      >
        <section className="utility-page__briefing">
          <div
            className={cn(
              "utility-page__status",
              statusTone === "warning" && "utility-page__status--warning",
              statusTone === "error" && "utility-page__status--error",
            )}
          >
            <span aria-hidden="true" />
            {status}
          </div>

          <div className="utility-page__route-code">
            <p>Desk reference</p>
            <SplitFlapText
              className="utility-page__flaps"
              length={Math.max(3, Math.min(code.length, 9))}
              text={code}
              tone="amber"
            />
          </div>

          <div className="utility-page__copy">
            <p className="utility-page__eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>

          <div className="utility-page__note">
            <span aria-hidden="true">i</span>
            <p>{note}</p>
          </div>
        </section>

        <section className="utility-page__content">{children}</section>
      </div>
    </div>
  );
}
