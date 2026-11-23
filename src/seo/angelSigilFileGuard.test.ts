import { readFileSync } from "node:fs";
import { tryToParsePath } from "next/dist/lib/try-to-parse-path";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";
import {
  ANGEL_SIGIL_NOT_FOUND_PATH,
  ANGEL_SIGIL_RSC_REWRITE,
  isAngelSigilFilePath,
} from "./angelSigilFileGuard";
import { allAngelSigilStyleFiles } from "./angelSigils";

const KNOWN = allAngelSigilStyleFiles().map(({ file }) => file.path);

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
  const run = (path: string) =>
    proxy(new NextRequest(new URL(path, "https://magick.ly")));

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

  it("runs on every path the [file] route can match, and only those", () => {
    // As Next compiles a matcher (`getMiddlewareMatchers`, then
    // `new RegExp` with no flags at run time). The route's own pattern is the
    // same two segments under an angel's page, so nothing reaches the route
    // without passing the proxy.
    const matcher = new RegExp(tryToParsePath(config.matcher).regexStr ?? "^$");
    for (const path of [...KNOWN, ...UNKNOWN.filter((p) => !p.includes("%"))])
      expect(matcher.test(path), path).toBe(true);
    for (const path of [
      "/kabbalah/angel/vehuiah",
      "/kabbalah/angel",
      "/kabbalah/yhvh/72angels",
      "/api/render/angel-sigil",
      "/gd/halls/neophyte/neophyte.png",
      ANGEL_SIGIL_NOT_FOUND_PATH,
    ])
      expect(matcher.test(path), path).toBe(false);
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
    // As Next compiles a rewrite's source (`getPathMatch`, case-insensitive).
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
  });
});
