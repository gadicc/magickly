import { type NextRequest, NextResponse } from "next/server";
import {
  ANGEL_SIGIL_NOT_FOUND_PATH,
  isAngelPageSegmentPath,
  isAngelSigilFilePath,
  isFlightRequest,
} from "@/seo/angelSigilFileGuard";

/**
 * Keeps made-up names away from the angels' sigil files (plan 096,
 * decision 3). The route draws the bare and talisman files on their first
 * request and keeps the response, so it may only ever see one of the 576
 * names: any other path under `/kabbalah/angel/<slug>/` is rewritten to a
 * path no route matches, and Next answers it with the site's 404 page,
 * kept nowhere.
 *
 * Two forms of a known name could still reach the route as unknown ones:
 * - `<file>.png.rsc`, since Next strips a final `.rsc` before any proxy sees
 *   the URL: `ANGEL_SIGIL_RSC_REWRITE` in next.config.ts sends those to the
 *   404;
 * - `<file>.png` asked for with `RSC: 1`, to which Vercel appends `.rsc`
 *   after the proxy and the rewrites have run: answered here, uncached,
 *   with a status that Next's router takes as its cue to load the URL as a
 *   browser would. The site links its files with plain anchors, so only a
 *   hand-made request should ever get this answer.
 *
 * The angel page's own prerendered segments, asked for by their paths
 * (`<slug>.segments/_tree.segment.rsc`), pass untouched.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isAngelSigilFilePath(pathname)) {
    if (!isFlightRequest(request.headers)) return NextResponse.next();
    return new NextResponse(null, {
      status: 406,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (isAngelPageSegmentPath(pathname)) return NextResponse.next();
  return NextResponse.rewrite(new URL(ANGEL_SIGIL_NOT_FOUND_PATH, request.url));
}

/*
 * A literal, as Next reads it from the source without running it, and
 * compiles it (`getMiddlewareMatchers`) with the `.rsc`, `.json`,
 * `.segments/…` and `/_next/data/…` forms added. The route `[slug]/[file]`
 * takes any two segments, so the proxy runs on any two segments: a slug
 * with a dot reaches the route too. src/proxyRegistration.test.ts holds the
 * compiled matcher and the rewrite to the files and the page's segments.
 */
export const config = {
  matcher: "/kabbalah/angel/:slug/:file",
};
