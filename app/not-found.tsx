import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { UtilityPageShell } from "@/app/components/utility-page-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <UtilityPageShell
      code="404"
      eyebrow="Route not in service"
      title="This gate doesn’t exist"
      description="The page may have moved, or the airport guide may not be on the board yet."
      note="Airport pages use their three-letter IATA code. Search the directory if you arrived here from an old link."
      status="Route unavailable"
      statusTone="warning"
    >
      <div className="utility-action-card">
        <p className="utility-action-card__label">Recommended routing</p>
        <h2>Return to the departure board</h2>
        <p>
          Browse every rated airport, or use the search control in the header
          to jump straight to an IATA code.
        </p>
        <div className="utility-action-card__actions">
          <Button asChild>
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              Back to the directory
            </Link>
          </Button>
          <span>
            <Search aria-hidden="true" />
            Search is always available above
          </span>
        </div>
      </div>
    </UtilityPageShell>
  );
}
