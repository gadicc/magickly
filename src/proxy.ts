import { type NextRequest, NextResponse } from "next/server";
import {
  ANGEL_SIGIL_NOT_FOUND_PATH,
  isAngelSigilFilePath,
} from "@/seo/angelSigilFileGuard";

/**
 * Keeps made-up names away from the angels' sigil files (plan 096,
 * decision 3). The route draws the bare and talisman files on their first
 * request and keeps the response, so it may only ever see one of the 576
 * names: any other path under `/kabbalah/angel/<slug>/` is rewritten to a
 * path no route matches, and Next answers it with the site's 404 page,
 * kept nowhere. Only this one path shape runs the proxy. Next strips a
 * final `.rsc` before any proxy sees the URL, so `<file>.png.rsc` would pass
 * as `<file>.png`; `ANGEL_SIGIL_RSC_REWRITE` in next.config.ts sends those
 * to the 404 instead.
 */
export function proxy(request: NextRequest) {
  if (isAngelSigilFilePath(request.nextUrl.pathname))
    return NextResponse.next();
  return NextResponse.rewrite(new URL(ANGEL_SIGIL_NOT_FOUND_PATH, request.url));
}

export const config = {
  matcher: "/kabbalah/angel/:slug/:file",
};
