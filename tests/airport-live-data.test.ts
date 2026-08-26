import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchSecurityWaitTimes,
  LIVE_DATA_REVALIDATE_SECONDS,
  normalizeTsaWaitTimesResponse,
} from "@/lib/airport-live-data";
import { LIVE_DATA_CACHE_CONTROL } from "@/app/api/airports/[iata]/live/route";

function jsonResponse(payload: unknown, date = "Fri, 07 Aug 2026 12:00:00 GMT") {
  return Response.json(payload, { headers: { date } });
}

test("official checkpoint data takes precedence over the aggregate provider", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return jsonResponse({
      data: {
        securityWaitTimes: [
          {
            title: "Terminal 4",
            terminal: "4",
            queueType: "Reg",
            isOpen: true,
            isWaitTimeAvailable: true,
            waitTime: 7,
          },
        ],
      },
    });
  }) as typeof fetch;

  const result = await fetchSecurityWaitTimes("JFK", "US", {
    apiKey: "secret-key",
    fetchImpl,
  });

  assert.equal(result.kind, "checkpoints");
  assert.equal(calls.length, 1);
  if (result.kind === "checkpoints") {
    assert.equal(result.checkpoints[0]?.waitMinutes, 7);
    assert.equal(result.source, "Port Authority of NY & NJ");
  }
});

test("an empty official feed falls back to the airport-wide estimate", async () => {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    assert.equal(init?.next?.revalidate, LIVE_DATA_REVALIDATE_SECONDS);
    if (calls.length === 1) {
      return jsonResponse({ data: { securityWaitTimes: [] } });
    }
    return jsonResponse({ code: "JFK", rightnow: 18.6, user_reported: 12, precheck: 1 });
  }) as typeof fetch;

  const result = await fetchSecurityWaitTimes("JFK", "US", {
    apiKey: "secret-key",
    fetchImpl,
  });

  assert.equal(result.kind, "airport_estimate");
  assert.equal(calls.length, 2);
  if (result.kind === "airport_estimate") {
    assert.equal(result.estimatedWaitMinutes, 19);
    assert.equal(result.travelerReportedMinutes, 12);
    assert.equal(result.precheckAvailable, true);
    assert.equal("checkpoints" in result, false);
    assert.equal(JSON.stringify(result).includes("secret-key"), false);
  }
});

test("an official-feed timeout falls back without exposing the failure", async () => {
  let callCount = 0;
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    callCount += 1;
    if (callCount === 1) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
          once: true,
        });
      });
    }
    return Promise.resolve(jsonResponse({ code: "JFK", rightnow: 9, precheck: 0 }));
  }) as typeof fetch;

  const result = await fetchSecurityWaitTimes("JFK", "US", {
    apiKey: "secret-key",
    fetchImpl,
    timeoutMs: 5,
  });

  assert.equal(callCount, 2);
  assert.equal(result.kind, "airport_estimate");
});

test("third-party responses are normalized and traveler zero means no report", () => {
  const result = normalizeTsaWaitTimesResponse(
    { code: "atl", rightnow: "10.6", user_reported: 0, precheck: false },
    "ATL",
    "2026-08-07T12:00:00.000Z",
  );

  assert.ok(result);
  assert.equal(result.estimatedWaitMinutes, 11);
  assert.equal(result.displayWait, "11 min");
  assert.equal(result.travelerReportedMinutes, undefined);
  assert.equal(result.precheckAvailable, false);
});

test("malformed, mismatched, and unsupported provider results are rejected", async () => {
  assert.equal(normalizeTsaWaitTimesResponse({ code: "ATL", rightnow: -1 }, "ATL"), null);
  assert.equal(normalizeTsaWaitTimesResponse({ code: "LAX", rightnow: 12 }, "ATL"), null);

  const fetchImpl = (async () => jsonResponse({ success: false, error: "bad key" })) as typeof fetch;
  const result = await fetchSecurityWaitTimes("ATL", "US", {
    apiKey: "secret-key",
    fetchImpl,
  });

  assert.equal(result.kind, "unavailable");
  assert.equal(result.message.includes("bad key"), false);
});

test("missing keys retain a useful fallback without making a request", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    throw new Error("must not be called");
  }) as typeof fetch;

  const result = await fetchSecurityWaitTimes("ATL", "US", {
    apiKey: "",
    fetchImpl,
  });

  assert.equal(called, false);
  assert.equal(result.kind, "unavailable");
  assert.match(result.message, /official airport site or MyTSA/);
});

test("non-U.S. airports never call the paid provider and use generic wording", async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    throw new Error("must not be called");
  }) as typeof fetch;

  const result = await fetchSecurityWaitTimes("FRA", "DE", {
    apiKey: "secret-key",
    fetchImpl,
  });

  assert.equal(called, false);
  assert.equal(result.kind, "unavailable");
  assert.equal(result.message.includes("TSA"), false);
});

test("security fetches and the route response use five-minute caching", () => {
  assert.equal(LIVE_DATA_REVALIDATE_SECONDS, 300);
  assert.match(LIVE_DATA_CACHE_CONTROL, /s-maxage=300/);
});
