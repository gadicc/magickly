// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { GD_HALL_FONT_FILES } from "@magick-components/gd/hall";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SVG_NAMESPACE } from "@/export/svgExport";
import {
  embedGdHallFonts,
  GD_HALL_FONT_BASE,
  gdHallEmbeddedFontCss,
  resetGdHallEmbeddedFonts,
} from "./exportFonts";

const publicDir = path.join(import.meta.dirname, "../../../../../public");

/** Serves the real subsets from `public/fonts`, counting requests. */
function serveFonts(status = 200) {
  const fetch = vi.fn(async (url: string) => {
    const file = path.join(publicDir, url);
    return new Response(status === 200 ? readFileSync(file) : null, {
      status,
    });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetGdHallEmbeddedFonts();
});

describe("the hall's embedded export fonts", () => {
  it("inline each subset once per page, as its own @font-face", async () => {
    const fetch = serveFonts();
    const css = await gdHallEmbeddedFontCss();
    expect(await gdHallEmbeddedFontCss()).toBe(css);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(
      GD_HALL_FONT_FILES.map((font) => `${GD_HALL_FONT_BASE}/${font.file}`),
    );
    const rules = css.split("\n");
    expect(rules).toHaveLength(GD_HALL_FONT_FILES.length);
    for (const [index, font] of GD_HALL_FONT_FILES.entries()) {
      const bytes = readFileSync(path.join(publicDir, "fonts", font.file));
      expect(rules[index]).toContain(`font-family:"${font.family}"`);
      expect(rules[index]).toContain(`font-weight:${font.weight}`);
      expect(rules[index]).toContain(
        `src:url("data:font/woff2;base64,${bytes.toString("base64")}")`,
      );
      expect(rules[index]).not.toContain("/fonts/");
    }
  });

  it("forget a failed fetch, so the next export tries again", async () => {
    serveFonts(404);
    await expect(gdHallEmbeddedFontCss()).rejects.toThrow(/404/);
    const fetch = serveFonts();
    await expect(gdHallEmbeddedFontCss()).resolves.toContain("base64");
    expect(fetch).toHaveBeenCalledTimes(GD_HALL_FONT_FILES.length);
  });

  it("put the rules first in the clone, and only there", async () => {
    serveFonts();
    const svg = document.createElementNS(SVG_NAMESPACE, "svg");
    svg.append(document.createElementNS(SVG_NAMESPACE, "title"));
    document.body.append(svg);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    await embedGdHallFonts(clone);
    const style = clone.firstElementChild as Element;
    expect(style.localName).toBe("style");
    expect(style.namespaceURI).toBe(SVG_NAMESPACE);
    expect(style.textContent).toBe(await gdHallEmbeddedFontCss());
    expect(svg.querySelector("style")).toBeNull();
    expect(new XMLSerializer().serializeToString(clone)).toMatch(
      /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"><style>@font-face/,
    );
  });
});
