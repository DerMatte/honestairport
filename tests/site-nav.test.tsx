import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteSidebar } from "@/app/components/site-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

test("mobile sidebar keeps browse and account, and omits TSA and Join", () => {
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
  assert.doesNotMatch(html, /TSA screening/);
  assert.doesNotMatch(html, /tsa-tips/);
  assert.doesNotMatch(html, />Join</);
});
