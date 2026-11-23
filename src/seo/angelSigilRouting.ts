import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import {
  ANGEL_PAGE_SEGMENTS,
  ANGEL_SIGIL_NOT_FOUND_PATH,
  angelSigilFilePaths,
} from "./angelSigilFileGuard";

/*
 * What keeps made-up names from the angels' sigil route (plan 096,
 * decision 3), checked as Next runs it: the proxy's compiled matchers and
 * the `beforeFiles` rewrites' regular expressions, whether compiled here
 * from the sources (src/proxyRegistration.test.ts) or read from a build's
 * manifests (scripts/checkProxyBuild.mts). Each problem found is a line.
 */

/** As Next's runtime tests a proxy matcher: `new RegExp`, no flags. */
type Matcher = { regexp: string };
/** As routes-manifest.json holds a rewrite: matched without case. */
type Rewrite = { source: string; regex: string; destination: string };

/** Paths the `[slug]/[file]` route would take, none of them a file. */
export const MADE_UP_FILE_PATHS = [
  "/kabbalah/angel/vehuiah/jeliel-rose-cross-sigil.png",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-Band.png",
  "/kabbalah/angel/VEHUIAH/vehuiah-rose-cross-sigil-band.png",
  "/kabbalah/angel/constructor/constructor-rose-cross-sigil-band.png",
  "/kabbalah/angel/vehuiah/x",
  // A slug with a dot is still a slug to the route.
  "/kabbalah/angel/vehu.iah/vehuiah-rose-cross-sigil-band.png",
  "/kabbalah/angel/vehuiah.segments/x.png",
  "/kabbalah/angel/vehuiah.segments/_tree.png",
  "/kabbalah/angel/nobody.segments/_tree.segment.rsc",
  "/kabbalah/angel/vehuiah.segments/_made-up.segment.rsc",
];

/** Paths outside the route, which the proxy must never see. */
export const OTHER_PATHS = [
  "/",
  "/kabbalah/angel",
  "/kabbalah/angel/vehuiah",
  "/kabbalah/angel/vehuiah.rsc",
  "/kabbalah/yhvh/72angels",
  "/api/render/angel-sigil",
  "/gd/halls/neophyte/neophyte.png",
  ANGEL_SIGIL_NOT_FOUND_PATH,
];

/**
 * The angel page's prerendered segments, by path: the three the proxy's
 * matcher sees as two segments, and the deeper one it does not.
 */
export function angelPageSegmentPaths(slugs: readonly string[]): string[] {
  return slugs.flatMap((slug) => [
    ...ANGEL_PAGE_SEGMENTS.map(
      (segment) => `/kabbalah/angel/${slug}.segments/${segment}.segment.rsc`,
    ),
    `/kabbalah/angel/${slug}.segments/!KHB1YmxpYyk/kabbalah/angel/$d$slug/__PAGE__.segment.rsc`,
  ]);
}

/** What the proxy does with a path, as it is given it (`.rsc` stripped). */
function proxied(path: string): "next" | "rewrite" | "other" {
  const seen = path.replace(/\.rsc($|\?)/, "$1");
  const response = proxy(new NextRequest(new URL(seen, "https://magick.ly")));
  if (response.headers.get("x-middleware-next") === "1") return "next";
  if (
    response.headers.get("x-middleware-rewrite") ===
    `https://magick.ly${ANGEL_SIGIL_NOT_FOUND_PATH}`
  )
    return "rewrite";
  return "other";
}

export function angelSigilRoutingProblems({
  matchers,
  rewrites,
  segmentPaths,
}: {
  matchers: readonly Matcher[];
  rewrites: readonly Rewrite[];
  segmentPaths: readonly string[];
}): string[] {
  const problems: string[] = [];
  if (matchers.length === 0) problems.push("the proxy has no matcher");
  const runsProxy = (path: string) =>
    matchers.some(({ regexp }) => new RegExp(regexp).test(path));
  const rewritten = (path: string) =>
    rewrites.some(
      ({ regex, destination }) =>
        destination === ANGEL_SIGIL_NOT_FOUND_PATH &&
        new RegExp(regex, "i").test(path),
    );

  const files = angelSigilFilePaths();
  if (files.length !== 576) problems.push(`${files.length} files, not 576`);
  for (const file of files) {
    if (!runsProxy(file)) problems.push(`the proxy does not run on ${file}`);
    else if (proxied(file) !== "next")
      problems.push(`the proxy does not pass ${file}`);
    if (rewritten(file)) problems.push(`a rewrite takes ${file}`);
    for (const suffix of [".rsc", ".RSC"])
      if (!rewritten(file + suffix))
        problems.push(`no rewrite takes ${file}${suffix}`);
  }
  for (const path of segmentPaths) {
    if (rewritten(path)) problems.push(`a rewrite takes ${path}`);
    if (runsProxy(path) && proxied(path) !== "next")
      problems.push(`the proxy does not pass ${path}`);
  }
  for (const path of MADE_UP_FILE_PATHS) {
    if (!runsProxy(path)) problems.push(`the proxy does not run on ${path}`);
    else if (proxied(path) !== "rewrite")
      problems.push(`the proxy does not send ${path} to the 404`);
  }
  for (const path of OTHER_PATHS)
    if (runsProxy(path)) problems.push(`the proxy runs on ${path}`);
  return problems;
}
