import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { getPageStaticInfo } from "next/dist/build/analysis/get-page-static-info";
import { loadBindings } from "next/dist/build/swc";
import { buildCustomRoute } from "next/dist/lib/build-custom-route";
import type { PAGE_TYPES } from "next/dist/lib/page-types";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { ANGEL_SIGIL_SLUGS } from "./render/contracts/angelSigil";
import { ANGEL_SIGIL_RSC_REWRITE } from "./seo/angelSigilFileGuard";
import {
  angelPageSegmentPaths,
  angelSigilRoutingProblems,
} from "./seo/angelSigilRouting";

/*
 * The proxy and the rewrite keep made-up names from the angels' sigil
 * route (plan 096, decision 3), and nothing fails at run time if Next stops
 * registering them: a proxy file Next does not find, a `config` it cannot
 * read, or a rewrite dropped from next.config.ts all leave the site
 * working, with every made-up name kept as a cached 404. So this reads
 * them as `next build` does, with Next's own functions, and
 * scripts/checkProxyBuild.mts checks a build's manifests the same way.
 */

const SRC = path.join(process.cwd(), "src");

/** The proxy's config as `next build` reads it (`getStaticInfoIncludingLayouts`). */
async function proxyStaticInfo() {
  await loadBindings();
  return getPageStaticInfo({
    pageFilePath: path.join(SRC, "proxy.ts"),
    nextConfig: {},
    isDev: false,
    page: "/src/proxy",
    // `PAGE_TYPES.PAGES`, a const enum: the proxy is outside the app dir.
    pageType: "pages" as PAGE_TYPES.PAGES,
  });
}

describe("src/proxy.ts, as Next registers it", () => {
  it("is where Next looks for it, beside the app directory", () => {
    // `next build` lists the files beside `app` (here `src/`) and takes
    // `proxy.<ext>`; a root `proxy.ts` would be ignored, and a
    // `middleware.ts` beside it is an error.
    expect(existsSync(path.join(SRC, "app"))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "app"))).toBe(false);
    const beside = readdirSync(SRC).filter((name) =>
      /^(proxy|middleware)\.[a-z]+$/.test(name),
    );
    expect(beside).toEqual(["proxy.ts"]);
    expect(
      readdirSync(process.cwd()).filter((name) =>
        /^(proxy|middleware)\.[a-z]+$/.test(name),
      ),
    ).toEqual([]);
  });

  it("exports `proxy` and a matcher Next can read, compiled to the files' shape", async () => {
    // Throws, as the build does, if there is no `proxy` or default export;
    // without a `config` Next reads, `middleware` has no matchers and the
    // proxy would run on every path.
    const info = await proxyStaticInfo();
    expect(info.middleware?.matchers).toEqual([
      {
        regexp:
          "^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/kabbalah\\/angel(?:\\/([^\\/#\\?]+?))(?:\\/([^\\/#\\?]+?))(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
        originalSource: "/kabbalah/angel/:slug/:file",
      },
    ]);
  });

  it("and next.config.ts's rewrite keep every made-up name from the route", async () => {
    const config = await nextConfig("phase-proxy-registration-test");
    // The proxy sees Next's router headers only with this set.
    expect(config.skipProxyUrlNormalize).toBe(true);
    const rewrites = await config.rewrites?.();
    expect(rewrites).toMatchObject({ beforeFiles: [ANGEL_SIGIL_RSC_REWRITE] });
    const beforeFiles =
      (rewrites && !Array.isArray(rewrites) && rewrites.beforeFiles) || [];
    const info = await proxyStaticInfo();
    expect(
      angelSigilRoutingProblems({
        matchers: info.middleware?.matchers ?? [],
        // As routes-manifest.json holds them (`buildCustomRoute`).
        rewrites: beforeFiles.map((rule) => buildCustomRoute("rewrite", rule)),
        segmentPaths: angelPageSegmentPaths(ANGEL_SIGIL_SLUGS),
      }),
    ).toEqual([]);
  });

  it("would see each problem: a check of the check", () => {
    const segmentPaths = angelPageSegmentPaths(["vehuiah"]);
    const matcher = {
      regexp:
        "^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/kabbalah\\/angel(?:\\/([^\\/#\\?]+?))(?:\\/([^\\/#\\?]+?))(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    };
    const rewrite = buildCustomRoute("rewrite", ANGEL_SIGIL_RSC_REWRITE);
    const problems = (
      matchers: { regexp: string }[],
      rewrites: (typeof rewrite)[],
    ) => angelSigilRoutingProblems({ matchers, rewrites, segmentPaths });
    expect(problems([matcher], [rewrite])).toEqual([]);
    expect(problems([], [rewrite])).toContain("the proxy has no matcher");
    expect(problems([matcher], [])).toContain(
      "no rewrite takes /kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.png.rsc",
    );
    // The first draft's rewrite, whose file crossed slashes and whose slug
    // took the page's own segments.
    expect(
      problems(
        [matcher],
        [
          buildCustomRoute("rewrite", {
            ...ANGEL_SIGIL_RSC_REWRITE,
            source: "/kabbalah/angel/:slug/:file(.+\\.rsc)",
          }),
        ],
      ),
    ).toContain(
      "a rewrite takes /kabbalah/angel/vehuiah.segments/_tree.segment.rsc",
    );
    // A matcher that leaves out slugs with a dot, as the route does not.
    expect(
      problems(
        [{ regexp: matcher.regexp.replace("([^\\/#\\?]+?)", "([^\\/.]+?)") }],
        [rewrite],
      ),
    ).toContain(
      "the proxy does not run on /kabbalah/angel/vehu.iah/vehuiah-rose-cross-sigil-band.png",
    );
    // The `.*` Next falls back to when it cannot read `config`.
    expect(problems([{ regexp: ".*" }], [rewrite])).toContain(
      "the proxy runs on /",
    );
  });
});
