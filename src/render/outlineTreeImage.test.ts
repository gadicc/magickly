import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createRitualSvgValidator } from "@/files/validateRitualSvg";
import { IMAGE_INPUTS_PROFILE } from "./dataInputs";
import {
  COMPONENT_IMAGE_PROFILE,
  keepPaintServers,
  outlineTreeImage as outline,
  outlineComponentImage,
  TREE_IMAGE_PROFILE,
} from "./outlineTreeImage";

/**
 * The outliner is handed the hash of the data the component drew; it never
 * resolves that data itself, and nothing below depends on which hash it is.
 */
const INPUTS_SHA256 = "0".repeat(64);
const outlineTreeImage = (svg: string, flip: boolean) =>
  outline(svg, flip, INPUTS_SHA256);

const hash = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const source = (text: string, width = "100%") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-170.5 0 341 598" id="TreeOfLife" width="${width}"><style>svg {font-family:'Noto Sans', 'Noto Sans Hebrew'}</style><g id="duplicate"><circle cx="0" cy="100" r="40"/><text x="-25" y="100" fill="red">${text}</text></g><g id="duplicate"><path d="M0 200L10 220"/></g></svg>`;

describe("bundled Tree of Life outlines", () => {
  // These pin accepted shaping, not just nonempty output (which could hide a
  // missing symbol or a .notdef box). Font/engine upgrades require visual review.
  it.each([
    [
      "Hello אבג",
      "507d2e0050c55115bfd40f36540f050cec126584167e3f72bbe764cef87f95ba",
    ],
    [
      "मूलाधार",
      "ae43899790627ec4222a2798c8020f8f8b5125c16aea6d31c9e7c396b65572bc",
    ],
    [
      "🜁🜂🜃🜄",
      "2aedd75512c8ce7dace858621f94f8ed4d1e0f8bc93b36f576fb7a10d5c919d0",
    ],
    [
      "☉☾☿♀♁♂♃♄",
      "3eacec02c87dd7ae5adfaedc95be3f21383d6d8359c720ef15628f9f06930d4b",
    ],
  ])(
    "outlines the existing non-Latin field glyphs: %s",
    async (text, expectedSha256) => {
      const filled = await outlineTreeImage(source(text), false);
      const blank = await outlineTreeImage(source(""), false);
      expect(filled.bytes.length).toBeGreaterThan(blank.bytes.length + 500);
      expect(hash(filled.bytes)).toBe(expectedSha256);
      expect(
        await createRitualSvgValidator().validate(
          filled.bytes,
          new AbortController().signal,
        ),
      ).toMatchObject({ status: "validated" });
    },
  );
  it("keeps Latin/Hebrew glyph outlines without font or link dependencies", async () => {
    const result = await outlineTreeImage(source("Hello אבג"), false);
    const blank = await outlineTreeImage(source(""), false);
    const text = result.bytes.toString();
    expect(text).not.toMatch(/<text|<style|href=|font-family|duplicate/);
    expect(text).toContain('width="100%"');
    expect(text).not.toContain('height="598"');
    expect(text).toContain('viewBox="-170.5 0 341 598"');
    expect(result.bytes.length).toBeGreaterThan(blank.bytes.length + 500);
    expect(
      await createRitualSvgValidator().validate(
        result.bytes,
        new AbortController().signal,
      ),
    ).toMatchObject({ status: "validated" });
  });

  it("is byte deterministic and returns independent output and identity copies", async () => {
    const input = source("אבג 123");
    const first = await outlineTreeImage(input, false);
    const second = await outlineTreeImage(input, false);
    expect(first.bytes).toEqual(second.bytes);
    expect(first.sourceSha256).toBe(hash(input));
    expect(first.identity.profile).toBe(TREE_IMAGE_PROFILE);
    first.bytes.fill(0);
    first.identity.fonts[0].sha256 = "changed";
    const third = await outlineTreeImage(input, false);
    expect(third).toEqual(second);
  });

  it("binds the actual installed wasm and exact bundled font bytes", async () => {
    const { identity } = await outlineTreeImage(source("a"), false);
    expect(identity.fonts.map((font) => font.file)).toEqual([
      "NotoSans-Regular.ttf",
      "NotoSansHebrew-Regular.ttf",
      "NotoSansDevanagari-Regular.ttf",
      "NotoSansSymbols-Regular.ttf",
      "NotoSansSymbols2-Regular.ttf",
    ]);
    const require = createRequire(import.meta.url);
    expect(identity.wasmSha256).toBe(
      hash(await readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm"))),
    );
    for (const font of identity.fonts) {
      expect(font.sha256).toBe(
        hash(
          await readFile(path.join(process.cwd(), "public/fonts", font.file)),
        ),
      );
    }
    expect(identity.defaultFontSize).toBe(16);
    expect(identity.resvg).toBe("2.6.2");
    // The data the component drew is hashed elsewhere and carried through
    // here verbatim, under its own encoding version.
    expect(identity.inputs).toEqual({
      spec: IMAGE_INPUTS_PROFILE,
      sha256: INPUTS_SHA256,
    });
    expect(
      (await outline(source("a"), false, "1".repeat(64))).identity.inputs
        .sha256,
    ).toBe("1".repeat(64));
  });

  it("mirrors the entire image around the centered viewBox without CSS 3D transforms", async () => {
    const input = source("abc", "200");
    const ordinary = await outlineTreeImage(input, false);
    const flipped = await outlineTreeImage(input, true);
    expect(
      flipped.bytes
        .toString()
        .replace('<g transform="scale(-1 1)">', "")
        .replace(/<\/g><\/svg>\s*$/, "</svg>\n"),
    ).toBe(ordinary.bytes.toString());
    expect(
      await createRitualSvgValidator().validate(
        flipped.bytes,
        new AbortController().signal,
      ),
    ).toMatchObject({ status: "validated" });
  });

  it("rejects an unexpected component viewport instead of shifting shapes", async () => {
    await expect(
      outlineTreeImage(
        source("a").replace("-170.5 0 341 598", "0 0 341 598"),
        false,
      ),
    ).rejects.toThrow("Unexpected component viewport");
  });

  it("rejects output that introduces resource references", async () => {
    const input = source("a").replace(
      "</svg>",
      '<defs><linearGradient id="test"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect x="0" y="0" width="10" height="10" fill="url(#test)"/></svg>',
    );
    await expect(outlineTreeImage(input, false)).rejects.toThrow(
      "Unexpected component image dependency",
    );
  });

  it("keeps former curved-text carrier paths invisible in the closed SVG profile", async () => {
    const input = source("").replace(
      "</svg>",
      '<path id="arc" visibility="hidden" d="M -80,300 A80,80 0 0 1 80,300"/><text fill="black"><textPath href="#arc">אבג 123</textPath></text></svg>',
    );
    const result = await outlineTreeImage(input, false);
    expect(result.bytes.toString()).toContain('display="none"');
    expect(result.bytes.toString()).not.toContain("visibility=");
    expect(
      await createRitualSvgValidator().validate(
        result.bytes,
        new AbortController().signal,
      ),
    ).toMatchObject({ status: "validated" });
  });
});

describe("paint servers kept for the temple halls (plan 062)", () => {
  const VIEWBOX = [0, 0, 300, 200] as const;
  const hall = (body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">${body}</svg>`;
  const PAINTED = hall(
    '<defs><pattern id="gdhall-checker" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#eee"/></pattern>' +
      '<linearGradient id="gdhall-wall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>' +
      '<radialGradient id="gdhall-glow"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="red" stop-opacity="0"/></radialGradient>' +
      '<g id="gdhall-art0"><rect x="0" y="0" width="5" height="5" fill="url(#gdhall-glow)"/></g></defs>' +
      '<rect width="300" height="200" fill="url(#gdhall-wall)"/>' +
      '<rect x="10" y="10" width="100" height="100" fill="url(#gdhall-checker)"/>' +
      '<use href="#gdhall-art0" x="150" y="50"/>' +
      // A nested viewport, for which resvg writes a clipPath of its own.
      '<svg x="200" y="100" width="50" height="50" viewBox="0 0 100 100"><circle cx="50" cy="50" r="80" fill="blue"/></svg>' +
      '<text x="20" y="180" font-size="20">Hall</text>',
  );
  const options = {
    profile: COMPONENT_IMAGE_PROFILE,
    inputsSha256: INPUTS_SHA256,
    viewBox: VIEWBOX,
  };

  it("refuses them without the option, as for every other slug", async () => {
    await expect(outlineComponentImage(PAINTED, options)).rejects.toThrow(
      "Unexpected component image dependency",
    );
  });

  it("keeps each url(#id), renumbered, resolving to its paint server", async () => {
    const result = await outlineComponentImage(PAINTED, {
      ...options,
      paintServers: { idPrefix: "gdhall-" },
    });
    const text = result.bytes.toString();
    const ids = [...text.matchAll(/<(\w+)\b[^>]*? id="([^"]*)"/g)].map(
      ([, element, id]) => `${element}#${id}`,
    );
    const references = [...text.matchAll(/url\(#([^)]*)\)/g)].map(
      ([, id]) => id,
    );
    // The pattern, both gradients and resvg's clipPath for the nested
    // viewport, numbered in the order the defs hold them.
    expect(ids.map((id) => id.split("#")[0]).sort()).toEqual([
      "clipPath",
      "linearGradient",
      "pattern",
      "radialGradient",
    ]);
    expect(ids.map((id) => id.split("#")[1]).sort()).toEqual([
      "gdhall-0",
      "gdhall-1",
      "gdhall-2",
      "gdhall-3",
    ]);
    expect(new Set(references)).toEqual(
      new Set(["gdhall-0", "gdhall-1", "gdhall-2", "gdhall-3"]),
    );
    expect(text).not.toMatch(/href=|<text|<style|<image|<use|clipPath\d/);
    const again = await outlineComponentImage(PAINTED, {
      ...options,
      paintServers: { idPrefix: "gdhall-" },
    });
    expect(again.bytes.equals(result.bytes)).toBe(true);
  });

  it.each([
    [
      "a filter",
      '<defs><filter id="f"><feGaussianBlur stdDeviation="2"/></filter></defs><rect width="10" height="10" filter="url(#f)"/>',
    ],
    [
      "a mask",
      '<defs><mask id="m"><rect width="5" height="5" fill="#fff"/></mask></defs><rect width="10" height="10" mask="url(#m)"/>',
    ],
    [
      "an image inside a pattern",
      '<defs><pattern id="p" width="10" height="10" patternUnits="userSpaceOnUse"><image width="10" height="10" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="/></pattern></defs><rect width="10" height="10" fill="url(#p)"/>',
    ],
    [
      "an image",
      '<image width="10" height="10" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="/>',
    ],
  ])("still refuses %s", async (_, body) => {
    await expect(
      outlineComponentImage(hall(body), {
        ...options,
        paintServers: { idPrefix: "gdhall-" },
      }),
    ).rejects.toThrow(/Unexpected component image dependency/);
  });

  it.each([
    ["a script", '<script>alert(1)</script><rect width="5" height="5"/>'],
    [
      "a foreignObject",
      '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>',
    ],
  ])("drops %s, as resvg does, whatever the option", async (_, body) => {
    const result = await outlineComponentImage(hall(body), {
      ...options,
      paintServers: { idPrefix: "gdhall-" },
    });
    expect(result.bytes.toString()).not.toMatch(
      /<script|<foreignObject|<div|alert/,
    );
  });

  describe("keepPaintServers", () => {
    const defs =
      '<defs><linearGradient id="g"><stop offset="0"/></linearGradient><filter id="f"/></defs>';
    it.each([
      ["a dangling reference", `${defs}<path fill="url(#missing)"/>`],
      ["a reference to a filter", `${defs}<path filter="url(#f)"/>`],
      ["an unclosed url(", `${defs}<path fill="url(#g"/>`],
      [
        "an unclosed url( after a good one",
        `${defs}<path fill="url(#g)" stroke="url(#g"/>`,
      ],
      [
        "a url( that is no fragment",
        `${defs}<path fill="url(https://x/y#g)"/>`,
      ],
      ["a url( with spaces", `${defs}<path fill="url( #g)"/>`],
      ["a kept id two elements share", `${defs}<path id="g" fill="url(#g)"/>`],
      [
        "a paint server outside the defs",
        '<defs></defs><linearGradient id="g"/><path fill="url(#g)"/>',
      ],
    ])("refuses %s", (_, body) => {
      expect(() => keepPaintServers(body, "gdhall-")).toThrow(
        "Unexpected component image dependency",
      );
    });

    it("keeps and renumbers what it may", () => {
      expect(
        keepPaintServers(
          `${defs}<path id="x" fill="url(#g)" stroke="url(#g)"/>`,
          "gdhall-",
        ),
      ).toBe(
        '<defs><linearGradient id="gdhall-0"><stop offset="0"/></linearGradient><filter/></defs><path fill="url(#gdhall-0)" stroke="url(#gdhall-0)"/>',
      );
    });
  });
});
