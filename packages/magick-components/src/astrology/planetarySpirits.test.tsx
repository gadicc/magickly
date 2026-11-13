import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PlanetarySpirit, {
  isPlanetarySpiritId,
  PLANETARY_SPIRIT_IDS,
} from "./planetarySpirits.tsx";

/**
 * The seals are SVGR's output for the Inkscape files in the repository's
 * svg/astrology/spirits/, as next.config.ts ran it before the move (plan
 * 080, stage E). This runs SVGR the same way, with @svgr/webpack's own
 * default plugins, and holds each seal to it, so an edit to either side
 * that the other lacks fails here.
 */
const SPIRITS = new URL("../../../../svg/astrology/spirits/", import.meta.url);
const svgrRequire = createRequire(
  realpathSync(
    createRequire(import.meta.url).resolve("@svgr/webpack/package.json", {
      paths: [fileURLToPath(new URL("../../../../", import.meta.url))],
    }),
  ),
);
const { transform } = svgrRequire("@svgr/core");
const svgo = svgrRequire("@svgr/plugin-svgo");
const jsx = svgrRequire("@svgr/plugin-jsx");

/** The viewBox and path data SVGR writes for a seal's Inkscape file. */
async function svgr(file: string) {
  const filePath = fileURLToPath(new URL(file, SPIRITS));
  const code: string = await transform(
    readFileSync(filePath, "utf8"),
    {},
    {
      caller: {
        name: "@svgr/webpack",
        defaultPlugins: [svgo.default ?? svgo, jsx.default ?? jsx],
      },
      filePath,
    },
  );
  const viewBox = code.match(/viewBox="([^"]+)"/)?.[1];
  const paths = [...code.matchAll(/<path ([^>]*?) ?\/>/g)].map(
    ([, attributes]) => attributes,
  );
  return { viewBox, paths };
}

describe("the planetary spirits' seals", () => {
  it("has a seal for each Inkscape file, and no other", () => {
    const files = readdirSync(SPIRITS)
      .filter((file) => file.endsWith(".svg"))
      .map((file) => file.replace(/\.svg$/, ""));
    expect([...PLANETARY_SPIRIT_IDS].sort()).toEqual(files.sort());
  });

  it("draws each as SVGR draws its Inkscape file", async () => {
    for (const id of PLANETARY_SPIRIT_IDS) {
      const { viewBox, paths } = await svgr(`${id}.svg`);
      const html = renderToStaticMarkup(<PlanetarySpirit id={id} />);
      expect(paths, id).toHaveLength(1);
      expect(html, id).toContain(`viewBox="${viewBox}"`);
      expect(html, id).toContain(`<path ${paths[0]}></path>`);
    }
  });

  it("draws nothing for an id without a seal", () => {
    expect(isPlanetarySpiritId("constructor")).toBe(false);
    expect(renderToStaticMarkup(<PlanetarySpirit id="constructor" />)).toBe("");
    expect(renderToStaticMarkup(<PlanetarySpirit />)).toBe("");
  });
});
