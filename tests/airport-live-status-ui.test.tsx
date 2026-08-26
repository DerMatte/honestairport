import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AirportLiveStatusRenderer,
  LIVE_STATUS_REFRESH_MS,
  shouldRefreshLiveStatus,
} from "@/app/components/airport-live-status-loader";
import { AirportLiveStatus } from "@/app/components/airport-live-status";
import type { AirportLiveData } from "@/lib/airport-live-data";
import TsaTipsPage, { metadata } from "@/app/tsa-tips/page";

const disruptions: AirportLiveData["disruptions"] = {
  supported: true,
  status: "normal",
  items: [],
  message: "No operational issues reported.",
  source: "FAA",
  sourceUrl: "https://www.faa.gov/",
};

function dataWith(security: AirportLiveData["security"], countryCode = "US"): AirportLiveData {
  return {
    iata: "ATL",
    countryCode,
    fetchedAt: "2026-08-07T12:00:00.000Z",
    security,
    disruptions,
  };
}

test("official checkpoint rows render as checkpoint-level data", () => {
  const html = renderToStaticMarkup(
    <AirportLiveStatus
      data={dataWith({
        kind: "checkpoints",
        checkpoints: [
          {
            id: "main",
            name: "Main checkpoint",
            terminal: "Terminal A",
            laneType: "standard",
            waitMinutes: 8,
            displayWait: "Less than 10 min",
            status: "open",
          },
        ],
        source: "Official airport",
        sourceUrl: "https://example.com/waits",
        retrievedAt: "2026-08-07T12:00:00.000Z",
      })}
    />,
  );

  assert.match(html, /Main checkpoint/);
  assert.match(html, /Official checkpoint feed/);
  assert.doesNotMatch(html, /Estimated airport-wide wait/);
});

test("aggregate estimates stay airport-wide and link to the TSA guide", () => {
  const html = renderToStaticMarkup(
    <AirportLiveStatus
      officialAirportUrl="https://www.atl.com/"
      data={dataWith({
        kind: "airport_estimate",
        estimatedWaitMinutes: 17,
        displayWait: "17 min",
        travelerReportedMinutes: 20,
        precheckAvailable: true,
        source: "TSAWaitTimes.com",
        sourceUrl: "https://www.tsawaittimes.com/",
        retrievedAt: "2026-08-07T12:00:00.000Z",
      })}
    />,
  );

  assert.match(html, /Estimated airport-wide wait/);
  assert.match(html, />17</);
  assert.match(html, /Independent estimate/);
  assert.match(html, /self-reported/);
  assert.match(html, /href="\/tsa-tips"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /Terminal 1/);
});

test("international unavailable state remains generic and omits TSA links", () => {
  const html = renderToStaticMarkup(
    <AirportLiveStatus
      data={dataWith(
        {
          kind: "unavailable",
          message: "Current security wait information is not available for this airport.",
        },
        "DE",
      )}
    />,
  );

  assert.match(html, /Current security wait information is not available/);
  assert.doesNotMatch(html, /TSA/);
  assert.doesNotMatch(html, /\/tsa-tips/);
  assert.match(html, /Operational status/);
});

test("loader renders loading and retry states", () => {
  const loading = renderToStaticMarkup(
    <AirportLiveStatusRenderer
      controller={{ state: { status: "loading" }, reload: () => {} }}
    />,
  );
  const error = renderToStaticMarkup(
    <AirportLiveStatusRenderer
      controller={{
        state: { status: "error", error: "Network unavailable" },
        reload: () => {},
      }}
    />,
  );

  assert.match(loading, /Loading live airport status/);
  assert.match(error, /Network unavailable/);
  assert.match(error, /Try again/);
});

test("visibility-aware refresh waits five minutes and only runs when visible", () => {
  assert.equal(LIVE_STATUS_REFRESH_MS, 300_000);
  assert.equal(shouldRefreshLiveStatus("visible", 299_999), false);
  assert.equal(shouldRefreshLiveStatus("hidden", 300_000), false);
  assert.equal(shouldRefreshLiveStatus("visible", 300_000), true);
});

test("TSA guide exports metadata, review date, anchors, and safe official links", () => {
  const html = renderToStaticMarkup(<TsaTipsPage />);

  assert.match(String(metadata.title), /TSA Tips/);
  assert.match(html, /August 7, 2026/);
  assert.match(html, /id="identification"/);
  assert.match(html, /id="timing"/);
  assert.match(html, /What Can I Bring\?/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /href="#identification"/);
});
