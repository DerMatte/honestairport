/**
 * Whop Pixel (https://docs.whop.com/developer/guides/pixel).
 *
 * Page views only. Do not fire `purchase` or `subscribe` — Whop checkout
 * already records those server-side and rejects duplicates.
 */

import {
  DEFAULT_WHOP_COMPANY_ID,
  type WhopEnv,
} from "@/lib/whop-gate";

export const WHOP_BIZ_ID_ENV = "NEXT_PUBLIC_WHOP_BIZ_ID";
export const WHOP_PIXEL_ORIGIN = "https://t.whop.tw";
export const WHOP_PIXEL_SCRIPT_URL = `${WHOP_PIXEL_ORIGIN}/s.js`;
export const WHOP_PIXEL_SCRIPT_ID = "whop-pixel";
export const WHOP_PIXEL_INIT_ID = "whop-pixel-init";

export type WhopPixelApi = {
  q: unknown[];
  t: number;
  s: string[];
  o: string;
  track: (eventName: string, payload?: Record<string, unknown>) => void;
  setScope: (...scopes: string[]) => void;
  scope: (...scopes: string[]) => {
    track: (eventName: string, payload?: Record<string, unknown>) => void;
  };
};

declare global {
  interface Window {
    whop?: WhopPixelApi;
  }
}

/**
 * Public Pixel company id.
 * Unset → HonestAirport default so production lights up after merge.
 * Explicit empty / whitespace → off.
 */
export function getWhopPixelBizId(env: WhopEnv = process.env): string | null {
  const raw = env[WHOP_BIZ_ID_ENV];
  if (raw === undefined) {
    return DEFAULT_WHOP_COMPANY_ID;
  }
  const trimmed = raw.trim();
  return trimmed || null;
}

/**
 * Official stub (no second s.js inject — `next/script` loads the loader).
 * Queues `setScope` + first `page` until https://t.whop.tw/s.js runs.
 */
export function whopPixelInitScript(bizId: string): string {
  const origin = JSON.stringify(WHOP_PIXEL_ORIGIN);
  const scope = JSON.stringify(bizId);
  return `!function(w,n,u){if(w[n])return;var a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};}(window,"whop",${origin});
whop.setScope(${scope});
whop.track("page");`;
}

export function trackWhopPageView(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.whop?.track("page");
}

/**
 * First path is already tracked by the init snippet. Later App Router
 * navigations fire `page` again without reloading s.js.
 */
export function shouldTrackWhopSpaPage(
  lastPath: string | null,
  pathname: string,
): boolean {
  return lastPath !== null && lastPath !== pathname;
}
