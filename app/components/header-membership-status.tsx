import Link from "next/link";
import { getHtmlAccess } from "@/lib/whop-access";
import { isWhopGateEnabled } from "@/lib/whop-gate";

/**
 * Compact membership line for the signed-in account menu. Hidden when the
 * Whop gate is off so we never show a fake "Not a member" in local dev.
 */
export async function HeaderMembershipStatus() {
  if (!isWhopGateEnabled()) {
    return null;
  }

  const access = await getHtmlAccess();
  const isMember = access === "allowed";

  return (
    <p className="text-xs leading-5 text-muted-foreground">
      <span className="font-medium text-foreground">
        {isMember ? "Member" : "Not a member"}
      </span>
      {" · "}
      <Link href="/members" className="underline-offset-4 hover:underline">
        {isMember ? "Membership" : "Join members"}
      </Link>
    </p>
  );
}
