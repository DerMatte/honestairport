/**
 * Best-effort ping to the deployed site so guide updates go live instantly
 * instead of waiting for the ISR revalidate window.
 *
 * Requires REVALIDATE_SECRET (same value the site checks). Skips silently
 * when unset — time-based revalidation picks the change up within minutes.
 */
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.honestairport.com";

export async function requestSiteRevalidation(): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret?.trim()) {
    console.log("REVALIDATE_SECRET not set — site will refresh via timed revalidation.");
    return;
  }

  try {
    const response = await fetch(`${SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret },
    });

    if (response.ok) {
      console.log("Site cache revalidated.");
    } else {
      console.warn(`Revalidate request failed (${response.status}) — timed revalidation will catch up.`);
    }
  } catch (error) {
    console.warn(
      `Revalidate request failed — timed revalidation will catch up. (${error instanceof Error ? error.message : error})`,
    );
  }
}
