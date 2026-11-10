/**
 * The IP lookup started from the page's `<head>` (plan 072), so that
 * `/api/geo` answers while the page's JavaScript downloads instead of after
 * it hydrates. The pages stay static: the place is still fetched by the
 * browser, only sooner. The place store takes the answer when it would
 * otherwise fetch one (`takeEarlyPlaceLookup`).
 */

/** `localStorage`: the place the reader chose, `{ version, source, place }`. */
export const CHOSEN_PLACE_KEY = "magickli.place";
/** `sessionStorage`: the IP lookup's place, `{ version, place }`. */
export const DETECTED_PLACE_KEY = "magickli.place.ip";

/**
 * The pages whose components use the place store. A test checks this list
 * against `src/app`; a page missing from it still works, only without the
 * early start.
 */
export const PLACE_PAGES = [
  "/astrology/planetary-hours",
  "/astrology/planets",
  "/geomancy/reading",
] as const;

/**
 * `/api/geo`'s parsed body, or `undefined` when it failed: offline, an
 * error status, or an answer that is not JSON.
 */
type EarlyLookup = Promise<unknown>;

declare global {
  interface Window {
    __magickliPlaceLookup?: EarlyLookup;
  }
}

/**
 * The inline script for the root layout's `<head>`. It runs on every full
 * page load but fetches only on a place page with nothing stored, since the
 * store would not look up otherwise. Any error (blocked storage, no fetch)
 * leaves it to the store. Plain ES5, as it is not compiled.
 */
export const earlyPlaceLookupScript = `(function(){try{if(${JSON.stringify(
  PLACE_PAGES,
)}.indexOf(location.pathname.replace(/\\/$/,""))<0)return;if(localStorage.getItem(${JSON.stringify(
  CHOSEN_PLACE_KEY,
)})!==null||sessionStorage.getItem(${JSON.stringify(
  DETECTED_PLACE_KEY,
)})!==null)return;window.__magickliPlaceLookup=fetch("/api/geo",{cache:"no-store"}).then(function(r){return r.ok?r.json():void 0}).catch(function(){})}catch(e){}})()`;

/**
 * The lookup the `<head>` script started, once: later lookups (a retry when
 * back online, another page after a client-side navigation) fetch afresh.
 */
export function takeEarlyPlaceLookup(): EarlyLookup | undefined {
  const lookup = window.__magickliPlaceLookup;
  delete window.__magickliPlaceLookup;
  return lookup;
}
