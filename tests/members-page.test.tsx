import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MembersLanding } from "@/app/components/members-landing";
import { MembershipTeaser } from "@/app/components/membership-teaser";
import { metadata } from "@/app/members/page";
import type { AirportTeaser } from "@/lib/whop-teaser";

const checkoutHref = "https://whop.com/checkout/plan_ee0kSfuyD6v9a";

function landing(
  overrides: Partial<{
    nextPath: string;
    paymentId: string | null;
    access: "open" | "allowed" | "denied";
    gateOn: boolean;
    signedIn: boolean;
    signInHref: string;
  }> = {},
) {
  const paymentId = overrides.paymentId ?? null;
  return renderToStaticMarkup(
    <MembersLanding
      checkoutHref={checkoutHref}
      nextPath={overrides.nextPath ?? "/airports/lax"}
      paymentId={paymentId}
      access={overrides.access ?? "denied"}
      gateOn={overrides.gateOn ?? true}
      signedIn={overrides.signedIn ?? false}
      signInHref={overrides.signInHref ?? "/login?next=%2Fmembers"}
      restoreForm={
        <form>
          <label htmlFor="whop-receipt">Whop receipt</label>
          <input
            id="whop-receipt"
            name="receiptId"
            defaultValue={paymentId ?? ""}
            placeholder="pay_…"
          />
          <button type="submit">Restore access</button>
        </form>
      }
    />,
  );
}

test("members metadata is a public sales page", () => {
  assert.match(String(metadata.title), /Free finds the airport/);
  assert.match(String(metadata.description), /\$8\/mo/);
  assert.match(String(metadata.description), /Lounges/);
  const robots = metadata.robots;
  assert.ok(robots && typeof robots === "object");
  assert.equal(robots.index, true);
  assert.equal(robots.follow, true);
  assert.equal(metadata.alternates?.canonical, "/members");
});

test("logged-out members page sells $8/month and the real free vs paid split", () => {
  const html = landing();

  assert.match(html, /Join members · \$8\/mo/);
  assert.match(html, /href="https:\/\/whop.com\/checkout\/plan_ee0kSfuyD6v9a"/);
  assert.match(html, /\$8\/month/);
  assert.match(html, /Free finds the airport\. Members decide the day\./);
  assert.match(
    html,
    /Scores are free\. Lounges deep, disruptions, tips, and reviews unlock for members — \$8\/mo\./,
  );
  assert.match(html, /Free stays useful\. Members get the rest\./);
  assert.match(html, /Airport Overview/);
  assert.match(html, /Lounge directory on the airport page/);
  assert.match(html, /Home and search/);
  assert.match(html, /Getting There — ground transport/);
  assert.match(html, /Amenities, tips, water, disruptions/);
  assert.match(html, /Individual lounge pages/);
  assert.match(html, /Back to LAX/);
  assert.match(html, /href="\/airports\/lax"/);
  assert.match(html, /Telegram community on the Whop product/);
  assert.match(html, /no Telegram bot in this app/);
  assert.doesNotMatch(html, /x402/);
  assert.doesNotMatch(html, /\.md/);
  assert.doesNotMatch(html, /WHOP_API_KEY/);
  assert.match(html, /href="#restore"/);
  assert.match(html, /Already a member\?/);
  assert.match(html, /href="\/login\?next=%2Fmembers"/);
  assert.match(html, />Sign in</);
  assert.match(html, /id="restore"/);
  assert.match(html, /Restore access/);
  assert.doesNotMatch(html, /You&#x27;re in/);
  assert.doesNotMatch(html, /admin/);
  assert.doesNotMatch(html, /owner/);
});

test("signed-in non-members still see Join members, not a Sign in CTA", () => {
  const html = landing({ signedIn: true });
  assert.match(html, /Join members · \$8\/mo/);
  assert.doesNotMatch(html, />Sign in</);
  assert.match(html, /saves the Whop id on your account/);
});

test("restore stays secondary unless a receipt is in the URL", () => {
  const idle = landing();
  assert.match(idle, /<details/);
  assert.doesNotMatch(idle, /<details[^>]*open/);
  assert.doesNotMatch(idle, /Welcome back from checkout/);

  const returning = landing({ paymentId: "pay_abc123" });
  assert.match(returning, /<details[^>]*open/);
  assert.match(returning, /Welcome back from checkout/);
  assert.match(returning, /value="pay_abc123"/);
  assert.match(returning, /Join members · \$8\/mo/);
});

test("allowed state confirms membership and continues to the safe next path", () => {
  const html = landing({
    access: "allowed",
    nextPath: "/airports/sin",
  });

  assert.match(html, /You&#x27;re in/);
  assert.match(html, /Membership is active/);
  assert.match(html, /href="\/airports\/sin"/);
  assert.match(html, />Continue</);
  assert.doesNotMatch(html, /Join members · \$8\/mo/);
  assert.doesNotMatch(html, /id="restore"/);
  assert.match(html, /Telegram community lives on the Whop product page/);
  assert.match(html, /there is no Telegram bot in this app/);
});

test("gate-off is a quiet note on the same sales page", () => {
  const html = landing({ access: "open", gateOn: false, nextPath: "/" });

  assert.match(html, /Join members · \$8\/mo/);
  assert.match(html, /Free finds the airport\. Members decide the day\./);
  assert.match(html, /Membership is not enabled in this environment/);
  assert.doesNotMatch(html, /WHOP_PRODUCT_ID/);
  assert.match(html, /id="restore"/);
  assert.match(html, /All airports/);
});

test("lounge teaser uses the lounge name and returns to the airport lounges tab", () => {
  const teaser: AirportTeaser = {
    iata: "SIN",
    name: "Singapore Changi Airport",
    city: "Singapore",
    country: "Singapore",
    blurb: null,
  };
  const html = renderToStaticMarkup(
    <MembershipTeaser
      teaser={teaser}
      returnPath="/airports/sin?tab=lounges"
      scope="lounge"
      heading="Changi Lounge"
    />,
  );

  assert.match(html, />Changi Lounge</);
  assert.match(html, /Singapore Changi Airport/);
  assert.match(html, /Back to lounges/);
  assert.match(html, /href="\/airports\/sin\?tab=lounges"/);
  assert.doesNotMatch(html, /All airports/);
});

test("membership teaser still points at /members restore", () => {
  const teaser: AirportTeaser = {
    iata: "LAX",
    name: "Los Angeles International",
    city: "Los Angeles",
    country: "United States",
    blurb: "A practical airport page.",
  };
  const html = renderToStaticMarkup(
    <MembershipTeaser
      teaser={teaser}
      returnPath="/airports/lax"
      variant="panel"
      heading="Traveler Tips"
    />,
  );

  assert.match(html, /href="\/members\?next=%2Fairports%2Flax#restore"/);
  assert.match(html, /Subscribe — \$8\/month/);
  assert.match(html, /Unlock Traveler Tips/);
  assert.match(html, /Traveler Tips is for HonestAirport members/);
});
