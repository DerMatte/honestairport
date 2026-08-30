import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteSidebar } from "@/app/components/site-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

test("mobile sidebar keeps browse, account, TSA tips, and Members", () => {
  const html = renderToStaticMarkup(
    <SidebarProvider>
      <SiteSidebar
        user={null}
        isPending={false}
        onNavigate={() => {}}
        onSignOut={() => {}}
        nearestAirportSlot={null}
      />
    </SidebarProvider>,
  );

  assert.match(html, /Browse airports/);
  assert.match(html, /Sign in/);
  assert.match(html, /href="\/tsa-tips"/);
  assert.match(html, /TSA tips/);
  assert.match(html, /href="\/members"/);
  assert.match(html, /Members/);
  assert.doesNotMatch(html, />Join</);
});
