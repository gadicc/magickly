import { readFileSync } from "node:fs";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";
import { ANGEL_SIGIL_SLUGS } from "../render/contracts/angelSigil";
import {
  ANGEL_PAGE_SEGMENTS,
  ANGEL_SIGIL_NOT_FOUND_PATH,
  ANGEL_SIGIL_RSC_REWRITE,
  angelSigilFilePaths,
  isAngelPageSegmentPath,
  isAngelSigilFilePath,
} from "./angelSigilFileGuard";
import { allAngelSigilStyleFiles } from "./angelSigils";

const KNOWN = allAngelSigilStyleFiles().map(({ file }) => file.path);

/** The angel page's prerendered segments, by path, as a build writes them. */
const SEGMENTS = ANGEL_SIGIL_SLUGS.flatMap((slug) => [
  ...ANGEL_PAGE_SEGMENTS.map(
    (segment) => `/kabbalah/angel/${slug}.segments/${segment}.segment.rsc`,
  ),
  `/kabbalah/angel/${slug}.segments/!KHB1YmxpYyk/kabbalah/angel/$d$slug/__PAGE__.segment.rsc`,
]);

/** Paths the `[file]` route would take, none of them one of the 576. */
const UNKNOWN = [
  "/kabbalah/angel/vehuiah/jeliel-rose-cross-sigil.png",
  "/kabbalah/angel/vehuiah/jeliel-rose-cross-sigil-band.png",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil.jpg",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-small.png",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-rose.png",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-Band.png",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-lamen.svg",
  "/kabbalah/angel/VEHUIAH/vehuiah-rose-cross-sigil-band.png",
  "/kabbalah/angel/vehuiah/VEHUIAH-rose-cross-sigil-band.png",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-band.PNG",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil%2Dband.png",
  "/kabbalah/angel/vehuiah/vehuiah-rose-cross-sigil-band.png%00",
  "/kabbalah/angel/lauviah/lauviah-rose-cross-sigil.png",
  "/kabbalah/angel/lauviah/lauviah-rose-cross-sigil-talisman.png",
  "/kabbalah/angel/constructor/constructor-rose-cross-sigil-band.png",
  "/kabbalah/angel/__proto__/__proto__-rose-cross-sigil-band.png",
  "/kabbalah/angel/vehuiah/vehuiah.png",
  "/kabbalah/angel/vehuiah/x",
];

describe("the angels' sigil files' guard (plan 096, decision 3)", () => {
  it("admits exactly the 576 files the route serves", () => {
    expect(KNOWN).toHaveLength(576);
    expect(new Set(KNOWN).size).toBe(576);
    expect(angelSigilFilePaths()).toEqual(KNOWN);
    for (const path of KNOWN)
      expect(isAngelSigilFilePath(path), path).toBe(true);
  });

  it.each(UNKNOWN)("refuses %s", (path) => {
    expect(isAngelSigilFilePath(path)).toBe(false);
  });

  it("refuses the files' paths with anything more or less", () => {
    for (const path of KNOWN.slice(0, 8)) {
      expect(isAngelSigilFilePath(`${path}/`)).toBe(false);
      expect(isAngelSigilFilePath(path.slice(1))).toBe(false);
      expect(isAngelSigilFilePath(`/he${path}`)).toBe(false);
      expect(isAngelSigilFilePath(path.replace(/\.(png|svg)$/, ""))).toBe(
        false,
      );
    }
  });
});

describe("src/proxy.ts", () => {
  const run = (path: string, headers?: Record<string, string>) =>
    proxy(new NextRequest(new URL(path, "https://magick.ly"), { headers }));

  it("lets the 576 through untouched", () => {
    for (const path of KNOWN) {
      const response = run(path);
      expect(response.headers.get("x-middleware-next"), path).toBe("1");
      expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    }
  });

  it.each(UNKNOWN)("sends %s to a path no route matches", (path) => {
    const response = run(path);
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      `https://magick.ly${ANGEL_SIGIL_NOT_FOUND_PATH}`,
    );
  });

  it.each<Record<string, string>>([
    { rsc: "1" },
    { rsc: "1", "next-router-prefetch": "1" },
    { rsc: "1", "next-router-segment-prefetch": "/_tree" },
    { "next-router-prefetch": "1" },
  ])(
    "answers a file asked for as an RSC payload itself, uncached: %o",
    (headers) => {
      // On Vercel `.rsc` is appended to such a request after the proxy has
      // run, and the route would take `<name>.png.rsc` as unknown. Any answer
      // that is not an RSC payload sends Next's router to load the URL.
      for (const path of KNOWN.slice(0, 8)) {
        const response = run(path, headers);
        expect(response.status, path).toBe(406);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(response.headers.get("x-middleware-next")).toBeNull();
        expect(response.headers.get("x-middleware-rewrite")).toBeNull();
      }
      // A made-up name still gets the 404 page, here its RSC payload.
      expect(run(UNKNOWN[0], headers).headers.get("x-middleware-rewrite")).toBe(
        `https://magick.ly${ANGEL_SIGIL_NOT_FOUND_PATH}`,
      );
    },
  );

  it("lets the angel page's own segments through, and only those", () => {
    // As the proxy is given them: `.rsc` stripped. The deeper `__PAGE__`
    // segment is three segments down, where the proxy never runs.
    const segments = SEGMENTS.filter((path) => !path.includes("__PAGE__")).map(
      (path) => path.replace(/\.rsc$/, ""),
    );
    expect(segments).toHaveLength(72 * 3);
    for (const path of segments) {
      expect(isAngelPageSegmentPath(path), path).toBe(true);
      expect(run(path).headers.get("x-middleware-next"), path).toBe("1");
    }
    for (const path of [
      "/kabbalah/angel/nobody.segments/_tree.segment",
      "/kabbalah/angel/vehuiah.segments/_made-up.segment",
      "/kabbalah/angel/vehuiah.segments/_tree.segment.rsc",
      "/kabbalah/angel/vehuiah.segments/_tree",
      "/kabbalah/angel/VEHUIAH.segments/_tree.segment",
    ]) {
      expect(isAngelPageSegmentPath(path), path).toBe(false);
      expect(run(path).headers.get("x-middleware-rewrite"), path).toBe(
        `https://magick.ly${ANGEL_SIGIL_NOT_FOUND_PATH}`,
      );
    }
  });

  it("imports no data, so its bundle stays small", () => {
    // The proxy runs before the routes, on its own bundle: only the
    // contract's written lists, never magick-data.
    for (const file of [
      "src/proxy.ts",
      "src/seo/angelSigilFileGuard.ts",
      "src/render/contracts/angelSigil.ts",
      "src/render/contracts/roseSigil.ts",
      "src/render/contracts/types.ts",
    ]) {
      const imports = [
        ...readFileSync(file, "utf8").matchAll(/from "([^"]+)"/g),
      ].map((match) => match[1]);
      for (const specifier of imports)
        expect(
          [
            "next/server",
            "@/seo/angelSigilFileGuard",
            "../render/contracts/angelSigil",
            "./roseSigil",
            "./types",
          ],
          `${file}: ${specifier}`,
        ).toContain(specifier);
    }
  });

  it("is backed by a rewrite of the names Next strips `.rsc` from first", () => {
    // As `next start` compiles a rewrite's source (`getPathMatch`, without
    // case); src/proxyRegistration.test.ts has it as Vercel's manifest does.
    const rewrite = getPathMatch(ANGEL_SIGIL_RSC_REWRITE.source, {
      removeUnnamedParams: true,
    });
    expect(ANGEL_SIGIL_RSC_REWRITE.destination).toBe(
      ANGEL_SIGIL_NOT_FOUND_PATH,
    );
    for (const path of KNOWN) {
      expect(rewrite(path), path).toBe(false);
      expect(rewrite(`${path}.rsc`), `${path}.rsc`).not.toBe(false);
      expect(rewrite(`${path}.RSC`), `${path}.RSC`).not.toBe(false);
    }
    expect(rewrite("/kabbalah/angel/vehuiah.rsc")).toBe(false);
    // Nor the angel page's own segments, nor anything deeper.
    for (const path of SEGMENTS) expect(rewrite(path), path).toBe(false);
    expect(rewrite(`${KNOWN[0]}/x.rsc`)).toBe(false);
  });
});
