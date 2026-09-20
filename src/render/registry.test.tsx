import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRitualSvgValidator } from "@/files/validateRitualSvg";
import { renderComponentImage } from "./componentImage";
import { COMPONENT_IMAGE_SLUGS, CONTRACTS } from "./contracts";
import { IMAGE_INPUTS_PROFILE } from "./dataInputs";
import {
  COMPONENT_IMAGE_PROFILE,
  TREE_IMAGE_PROFILE,
} from "./outlineTreeImage";
import { COMPONENT_IMAGE_REGISTRY, componentInputsHash } from "./registry";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const render = (slug: string, query = "") =>
  renderComponentImage(slug, new URLSearchParams(query));
const validate = (bytes: Uint8Array) =>
  createRitualSvgValidator().validate(bytes, new AbortController().signal);

describe("component image registry", () => {
  it("registers exactly the contract slugs", () => {
    expect(Object.keys(COMPONENT_IMAGE_REGISTRY).sort()).toEqual(
      [...COMPONENT_IMAGE_SLUGS].sort(),
    );
    expect(COMPONENT_IMAGE_REGISTRY["tree-of-life"].profile).toBe(
      TREE_IMAGE_PROFILE,
    );
  });

  // The other half of an image's identity: the data it draws (plan 032,
  // decision 10). These move when that data changes and the profiles above do
  // not, so a value here moving with no byte hash below moving means a field
  // was added to a spec that the component does not draw; the reverse means a
  // spec is missing something the component does.
  it.each([
    [
      "tree-of-life",
      "2591a504c3be2507d88e46bff86ea4ec09b4e1557dd14bda5d4d2034cc077d76",
    ],
    [
      "astro-geomancy-chart",
      "c89a608fb92e2f9b43ff58bdd53b7dc4259ab6a2530d861a8f78f7bb7bdee093",
    ],
    [
      "enochian-tablet",
      "63b83840b8a165223df3f3e8c12afcb74a49132c8f4f5fa56e92bb9829a75e3e",
    ],
    [
      "seven-branched-candlestick",
      "a8a081550bbcdd43f319e960754eae84e56a384a1fe1b11474c850b5c256cad9",
    ],
    // Moved once, by Manasseh's Hebrew name (plan 032's data fixes); the five
    // above did not, which is what decision 10 is for.
    [
      "table-of-shewbread",
      "dfd57ffbab8f4194e4c7702966d5cd887c44f1e68523247ec6195d38f5be90ab",
    ],
    // No table at all, so no data edit can ever move this one.
    [
      "rose-sigil",
      "f88d8766945579ec0fffa38d7271d4f59717f79dac05c9ae57cc7ab1c9dabc28",
    ],
  ] as const)("pins the data %s draws", (slug, sha256) => {
    expect(componentInputsHash(slug)).toBe(sha256);
  });

  it("reproduces the published ritual Tree of Life bytes under the unchanged profile", async () => {
    const jade = await readFile("src/doc/2=9.jade", "utf8");
    const reference = jade.match(/\/api\/treeOfLife\?([^"'\s)]+)/)?.[1];
    expect(reference).toBeDefined();
    const image = await render("tree-of-life", reference);
    expect(image.identity.profile).toBe(TREE_IMAGE_PROFILE);
    expect(image.identity.fonts).toHaveLength(5);
    expect(image.identity.inputs).toEqual({
      spec: IMAGE_INPUTS_PROFILE,
      sha256: componentInputsHash("tree-of-life"),
    });
    // Profile v3: v1 was 142,962 bytes (plans/009), v2 151,079 once Keter,
    // Chochmah and Malchut gained their archangels, and v3 is shorter again
    // because the path data is rounded to three decimals (plans/030).
    expect(image.byteSize).toBe(150_736);
    expect(image.sha256).toBe(
      "96516a75ce13374a234de855bf596ce1a50d1e9adf7340b398e4b3a2b7e4858a",
    );
    expect(await validate(image.bytes)).toMatchObject({ status: "validated" });
  });

  // Pinned after visual review of the rasterised output (see plans/027).
  // The path minimums are glyph-coverage floors measured after visual review:
  // every label, symbol and Hebrew letter becomes at least one outlined path,
  // so a font that silently dropped glyphs would fall below them.
  it.each([
    ["astro-geomancy-chart", "", 1024, 1024, 100],
    ["astro-geomancy-chart", "m=2222111122221111&width=256", 256, 256, 100],
    ["enochian-tablet", "", 840, 1188, 300],
    ["enochian-tablet", "id=air&height=297", 210, 297, 300],
    ["enochian-tablet", "font=enochian", 840, 1188, 300],
    ["seven-branched-candlestick", "", 1024, 1024, 60],
    ["table-of-shewbread", "", 1024, 1024, 130],
    ["rose-sigil", "text=גדי", 1024, 1024, 26],
    ["rose-sigil", "text=שלום&rose=false&width=200", 200, 200, 1],
  ] as const)(
    "renders %s?%s as validated outlined SVG and a %dx%d PNG",
    async (slug, query, width, height, minimumPaths) => {
      const svg = await render(slug, query);
      expect(svg.contentType).toBe("image/svg+xml");
      expect(svg.identity.profile).toBe(COMPONENT_IMAGE_PROFILE);
      // The query is the third part of the identity, not part of the inputs.
      expect(svg.identity.inputs).toEqual({
        spec: IMAGE_INPUTS_PROFILE,
        sha256: componentInputsHash(slug),
      });
      const text = svg.bytes.toString();
      expect(text).not.toMatch(/<text|<style|href=|font-family|<image/);
      expect((text.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(
        minimumPaths,
      );
      expect(text).toContain(`viewBox="${CONTRACTS[slug].viewBox.join(" ")}"`);
      expect(await validate(svg.bytes)).toMatchObject({ status: "validated" });
      const again = await render(slug, query);
      expect(again.sha256).toBe(svg.sha256);
      const png = await render(slug, `fmt=png${query ? `&${query}` : ""}`);
      expect(png.contentType).toBe("image/png");
      const decoded = await sharp(png.bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(decoded.info).toMatchObject({ width, height, channels: 4 });
      expect(png.sourceSha256).toBe(svg.sourceSha256);
    },
  );

  it("loads extra fonts only for the components that declare them", async () => {
    const base = [
      "NotoSans-Regular.ttf",
      "NotoSansHebrew-Regular.ttf",
      "NotoSansDevanagari-Regular.ttf",
      "NotoSansSymbols-Regular.ttf",
      "NotoSansSymbols2-Regular.ttf",
    ];
    const files = async (slug: string, query = "") =>
      (await render(slug, query)).identity.fonts.map((font) => font.file);
    expect(await files("tree-of-life")).toEqual(base);
    expect(await files("astro-geomancy-chart")).toEqual(base);
    expect(await files("seven-branched-candlestick")).toEqual(base);
    expect(await files("rose-sigil", "text=א")).toEqual(base);
    expect(await files("enochian-tablet")).toEqual([
      ...base,
      "EnochianPlain.ttf",
    ]);
    expect(await files("table-of-shewbread")).toEqual([
      ...base,
      "NotoEmoji-Variable.ttf",
    ]);
  });

  // resvg falls back to the default family with only a log line when a font
  // is missing, and path counts do not change under that fallback. These
  // pins were taken after visual review of the rasterised output; a font or
  // engine change needs a new review before they move.
  it.each([
    [
      "enochian-tablet",
      "id=air",
      124_838,
      "5ed3a569d959b1ed9065bd9e6ee2af84938f1b0e8139789af1a85bb045f96fed",
    ],
    [
      "enochian-tablet",
      "id=air&font=enochian",
      223_771,
      "53514ca864d7f13b59c90bf048a462c6d56c65b11c306c53a569a6684c3c81fe",
    ],
    // 136,294 bytes and df3c3791… until Manasseh's Hebrew name stopped being
    // Benjamin's; the Gemini branch is one glyph shorter and one wider.
    [
      "table-of-shewbread",
      "",
      136_643,
      "34e0fce138e4b50930aac5b226e71fbe452eb1ba7db5a9bb1929e0300e106e1b",
    ],
    [
      "seven-branched-candlestick",
      "",
      52_363,
      "5d8b637f7ceb159014b1bf7322b51456a8bd2b730bdb699883288ed6bf063331",
    ],
    [
      "astro-geomancy-chart",
      "",
      52_476,
      "eb2f1b6fe2fef2f563ee164de6e403ca9f398ec4706c9ad331195bc34286bffa",
    ],
  ] as const)(
    "pins the reviewed bytes of %s?%s so a silent font fallback fails",
    async (slug, query, byteSize, sha256) => {
      const image = await render(slug, query);
      expect(image.byteSize).toBe(byteSize);
      expect(image.sha256).toBe(sha256);
    },
  );

  it("draws different geomancy readings and sigils differently", async () => {
    const a = await render("astro-geomancy-chart", "m=1111111111111111");
    const b = await render("astro-geomancy-chart", "m=2222222222222222");
    expect(a.sha256).not.toBe(b.sha256);
    const rose = await render("rose-sigil", "text=אב");
    const bare = await render("rose-sigil", "text=אב&rose=false");
    expect(rose.byteSize).toBeGreaterThan(bare.byteSize);
    expect(hash(rose.bytes)).toBe(rose.sha256);
  });
});
