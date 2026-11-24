import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { crc32, gzipSync } from "node:zlib";
import {
  GD_HALL_FONT_STACKS,
  hallRoot,
  hallViewBox,
  resolveHall,
} from "magick-components/gd/hall";
import { HALL_PRESETS, hallPreset } from "magick-components/gd/hall/presets";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { gdHallArt } from "@/app/gd/halls/art";
import { renderComponentImage } from "./componentImage";
import { parseComponentImageRequest } from "./componentImageRequest";
import { componentImagePath } from "./componentImageUrl";
import {
  GD_HALL_SLUGS,
  GD_HALLS,
  type GdHallEntry,
  gdHall,
  gdHallFileBase,
  gdHallImage,
  gdHallPixels,
  gdHallShortName,
  gdHallTitle,
} from "./contracts/gdHall";
import {
  bareHallFonts,
  compactHallSvg,
  GD_HALL_IMAGE_PROFILE,
  hallImageArt,
  hallXmp,
  pngWithXmp,
  renderGdHallImage,
  svgWithLicence,
  XMP_KEYWORD,
} from "./gdHallImage";
import { outlineComponentImage } from "./outlineTreeImage";
import { COMPONENT_IMAGE_REGISTRY } from "./registry";

const sha256 = (bytes: Uint8Array | string) =>
  createHash("sha256").update(bytes).digest("hex");
const render = (query: string) =>
  renderComponentImage("gd-hall", new URLSearchParams(query));
const parse = (query: string) =>
  parseComponentImageRequest("gd-hall", new URLSearchParams(query));

/** A PNG's chunks, in order: type, data and whether the CRC holds. */
function chunks(png: Buffer) {
  const out: { type: string; data: Buffer; crcOk: boolean }[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    out.push({
      type: png.toString("latin1", offset + 4, offset + 8),
      data: png.subarray(offset + 8, offset + 8 + length),
      crcOk:
        crc32(png.subarray(offset + 4, offset + 8 + length)) ===
        png.readUInt32BE(offset + 8 + length),
    });
    offset += 12 + length;
  }
  return out;
}

/** The XMP packet of a PNG's iTXt chunk. */
const xmpOf = (png: Buffer) =>
  chunks(png)
    .find((chunk) => chunk.type === "iTXt")
    ?.data.subarray(XMP_KEYWORD.length + 5)
    .toString("utf8");

describe("the temple halls' names (plan 062)", () => {
  it("publishes every preset once, in order, under its permanent slug", () => {
    // Published slugs never change. A renamed preset changes `preset`; a
    // withdrawn hall gets a permanent redirect, never a reused slug.
    expect(GD_HALLS.map((hall) => [hall.preset, hall.slug])).toEqual([
      ["neophyte", "neophyte"],
      ["zelator1", "zelator-1"],
      ["zelator2", "zelator-2"],
      ["theoricus1", "theoricus-1"],
      ["theoricus2", "theoricus-2"],
      ["practicus1", "practicus-1"],
      ["practicus2", "practicus-2"],
      ["practicus3", "practicus-3"],
      ["philosophus1", "philosophus-1"],
      ["philosophus2", "philosophus-2"],
      ["philosophus3", "philosophus-3"],
      ["philosophus4", "philosophus-4"],
      ["portal1", "portal-1"],
      ["portal2", "portal-2"],
    ]);
    expect(GD_HALLS.map((hall) => hall.preset)).toEqual(
      HALL_PRESETS.map((preset) => preset.id),
    );
    for (const slug of GD_HALL_SLUGS) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("titles each hall descriptively, within a search result's width", () => {
    const titles = GD_HALLS.map(gdHallTitle);
    expect(titles).toEqual([
      "Golden Dawn Neophyte Temple (0=0): floor plan",
      "Golden Dawn Zelator Temple, part 1 (1=10): floor plan",
      "Golden Dawn Zelator Temple, part 2 (1=10): floor plan",
      "Golden Dawn Theoricus Temple, 32nd path (2=9): floor plan",
      "Golden Dawn Theoricus Temple in Yesod (2=9): floor plan",
      "Golden Dawn Practicus Temple, 31st path (3=8): floor plan",
      "Golden Dawn Practicus Temple, 30th path (3=8): floor plan",
      "Golden Dawn Practicus Temple in Hod (3=8): floor plan",
      "Golden Dawn Philosophus Temple, 29th path (4=7): floor plan",
      "Golden Dawn Philosophus Temple, 28th path (4=7): floor plan",
      "Golden Dawn Philosophus Temple, 27th path (4=7): floor plan",
      "Golden Dawn Philosophus Temple in Netzach (4=7): floor plan",
      "Golden Dawn Portal Temple, part 1: floor plan",
      "Golden Dawn Portal Temple, part 2: floor plan",
    ]);
    for (const title of titles) expect(title.length).toBeLessThanOrEqual(60);
    expect(new Set(titles).size).toBe(titles.length);
    expect(gdHallShortName(GD_HALLS[3])).toBe("Theoricus Temple, 32nd path");
    for (const hall of GD_HALLS) {
      expect(gdHallFileBase(hall)).toBe(`golden-dawn-${hall.slug}-temple`);
      // Each hall's grade and part are its preset's.
      const preset = hallPreset(hall.preset);
      expect(preset?.grade).toBe(hall.number || "Portal");
      expect(preset?.title.startsWith(hall.grade)).toBe(true);
    }
  });
});

describe("the gd-hall image contract", () => {
  it("draws each hall in the viewBox the image mode writes", () => {
    for (const hall of GD_HALLS) {
      const preset = hallPreset(hall.preset);
      const root = hallRoot(preset?.hall ?? { type: "gdHall" });
      const image = hallViewBox(resolveHall(root, { art: hallImageArt }), true);
      expect([hall.slug, ...image]).toEqual([hall.slug, ...hall.viewBox]);
      // The app's registry gives the tablets their font through next/font;
      // the layout, and so the box, is the same.
      expect(hallViewBox(resolveHall(root, { art: gdHallArt }), true)).toEqual(
        image,
      );
      expect(resolveHall(root, { art: gdHallArt })).toEqual(
        resolveHall(root, { art: hallImageArt }),
      );
    }
  });

  it("names the hall and the size, defaults left out", () => {
    expect(parse("").props).toEqual({ hall: "neophyte" });
    expect(parse("hall=portal-2&fmt=png&size=small")).toEqual({
      slug: "gd-hall",
      format: "png",
      props: { hall: "portal-2", size: "small" },
    });
    expect(
      componentImagePath({
        slug: "gd-hall",
        props: { hall: "zelator-1", size: "medium" },
      }),
    ).toBe("/api/render/gd-hall?hall=zelator-1&size=medium");
    expect(
      componentImagePath(
        { slug: "gd-hall", props: { hall: "neophyte" } },
        { format: "png" },
      ),
    ).toBe("/api/render/gd-hall?fmt=png");
    expect(gdHallImage.filename({ hall: "zelator-1" })).toBe(
      "golden-dawn-zelator-1-temple",
    );
    expect(gdHallImage.filename({ hall: "zelator-1", size: "small" })).toBe(
      "golden-dawn-zelator-1-temple-small",
    );
  });

  it.each([
    "hall=zelator1",
    "hall=Neophyte",
    "hall=toString",
    "width=300",
    "fmt=png&height=300",
    "size=small",
    "fmt=svg&size=medium",
    "fmt=png&size=large",
    "fmt=png&size=",
  ])("refuses %s", (query) => {
    expect(() => parse(query)).toThrow("Unsupported component image request");
  });

  it("sizes each PNG within the route's pixel limit", () => {
    for (const hall of GD_HALL_SLUGS) {
      const full = gdHallPixels({ hall });
      expect(full.width).toBe(1500);
      expect(full.width * full.height).toBeLessThanOrEqual(4_194_304);
      expect(gdHallPixels({ hall, size: "medium" }).width).toBe(750);
      expect(gdHallPixels({ hall, size: "small" }).width).toBe(360);
    }
    expect(gdHallPixels({ hall: "theoricus-2" })).toEqual({
      width: 1500,
      height: 2420,
    });
  });
});

describe("the gd-hall image", () => {
  it("names the labels' fonts as resvg resolves them", () => {
    const markup = renderToStaticMarkup(
      renderGdHallImage({ hall: "theoricus-2" }),
    );
    const families = (svg: string) =>
      new Set([...svg.matchAll(/font-family="([^"]*)"/g)].map(([, f]) => f));
    // The stacks GdHall writes, the Hebrew one among them (the banners).
    expect(families(markup)).toEqual(
      new Set(
        [GD_HALL_FONT_STACKS.serif, GD_HALL_FONT_STACKS.hebrew].map((stack) =>
          stack.replaceAll('"', "&quot;"),
        ),
      ),
    );
    const bare = bareHallFonts(markup);
    expect(families(bare)).toEqual(new Set(["Noto Serif", "Frank Ruhl Libre"]));
    // Nowhere else either, such as a style attribute; the tablets name the
    // bundled Enochian Plain in theirs.
    expect(bare).not.toContain("GdHall");
    expect(bare).toContain("font-family:Enochian");
  });

  it("drops resvg's indentation and nothing else", () => {
    expect(
      compactHallSvg(
        Buffer.from(
          '<svg viewBox="0 0 10 10">\n    <path transform="matrix(0.012345 0 0 1 2.5 3)" d="M 1.23456 -0.004 L 2.5 3 Z"/>\n</svg>',
        ),
      ).toString(),
    ).toBe(
      '<svg viewBox="0 0 10 10"><path transform="matrix(0.012345 0 0 1 2.5 3)" d="M1.23456 -0.004L2.5 3Z"/></svg>',
    );
  });

  it.each(["zelator-2", "portal-2"] as const)(
    "draws %s compacted exactly as uncompacted",
    async (hall) => {
      const markup = bareHallFonts(
        renderToStaticMarkup(renderGdHallImage({ hall })),
      );
      const registration = COMPONENT_IMAGE_REGISTRY["gd-hall"];
      const { bytes } = await outlineComponentImage(markup, {
        profile: registration.profile,
        inputsSha256: "0".repeat(64),
        viewBox: (gdHall(hall) as GdHallEntry).viewBox,
        fonts: registration.fonts,
        paintServers: registration.paintServers,
      });
      const raw = await sharp(bytes).raw().toBuffer();
      const compact = await sharp(compactHallSvg(bytes)).raw().toBuffer();
      let worst = 0;
      for (let i = 0; i < raw.length; i++)
        worst = Math.max(worst, Math.abs(raw[i] - compact[i]));
      expect(worst).toBeLessThanOrEqual(1);
    },
    60_000,
  );

  it("writes an iTXt XMP chunk after IHDR, ahead of the image data", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    const xmp = hallXmp({ hall: "neophyte" });
    const tagged = pngWithXmp(png, xmp);
    const types = chunks(tagged).map((chunk) => chunk.type);
    expect(types.slice(0, 2)).toEqual(["IHDR", "iTXt"]);
    expect(types.indexOf("iTXt")).toBeLessThan(types.indexOf("IDAT"));
    const itxt = chunks(tagged).find((chunk) => chunk.type === "iTXt")?.data;
    expect(itxt?.toString("latin1", 0, XMP_KEYWORD.length + 5)).toBe(
      `${XMP_KEYWORD}\0\0\0\0\0`,
    );
    expect(itxt?.subarray(XMP_KEYWORD.length + 5).toString("utf8")).toBe(xmp);
    // Every chunk's CRC holds. libvips (sharp) reads XMP from zTXt only;
    // ImageMagick reads this iTXt packet and its fields (checked by hand).
    for (const chunk of chunks(tagged)) expect(chunk.crcOk).toBe(true);
    // The image itself is untouched.
    expect(await sharp(tagged).raw().toBuffer()).toEqual(
      await sharp(png).raw().toBuffer(),
    );
    expect(() => pngWithXmp(png.subarray(1), xmp)).toThrow(
      "Unexpected PNG start",
    );
  });

  it("titles the SVG and states its licence, creator and sources", () => {
    const svg = svgWithLicence(
      Buffer.from('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>'),
      { hall: "portal-1" },
    ).toString();
    expect(svg).toBe(
      '<svg viewBox="0 0 1 1"><title>Golden Dawn Portal Temple, part 1: floor plan</title>' +
        '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#">' +
        '<cc:Work rdf:about=""><dc:title>Golden Dawn Portal Temple, part 1: floor plan</dc:title>' +
        "<dc:creator>Magick.ly</dc:creator>" +
        "<dc:rights>© 2026 Gadi Cohen. Licensed under CC BY 4.0</dc:rights>" +
        "<dc:source>Israel Regardie, The Golden Dawn, vol. 2 (Aries Press, Chicago, 1938), p.175, archive.org leaf n168 (its diagram, which the book heads part 2); Israel Regardie, The Golden Dawn, vol. 2 (Aries Press, Chicago, 1938), p.156, archive.org leaf n149 (the rubric of part 1, pp.156–157)</dc:source>" +
        '<cc:license rdf:resource="https://creativecommons.org/licenses/by/4.0/"/>' +
        "<cc:attributionName>Magick.ly</cc:attributionName>" +
        '<cc:attributionURL rdf:resource="https://magick.ly/gd/halls/portal-1"/>' +
        '</cc:Work></rdf:RDF></metadata><path d="M0 0"/></svg>',
    );
    expect(() =>
      svgWithLicence(Buffer.from("<p/>"), { hall: "neophyte" }),
    ).toThrow("Unexpected hall image root");
  });

  it("registers its own profile, fonts and paint servers", () => {
    const registration = COMPONENT_IMAGE_REGISTRY["gd-hall"];
    expect(registration.profile).toBe(GD_HALL_IMAGE_PROFILE);
    expect(registration.fonts).toEqual([
      "NotoSerif-Italic-latin1.ttf",
      "NotoSerif-BoldItalic-compass.ttf",
      "FrankRuhlLibre-Bold-letters.ttf",
      "EnochianPlain.ttf",
    ]);
    expect(registration.paintServers).toEqual({ idPrefix: "gdhall-" });
  });

  it("pins the label fonts' TrueType twins, built with their WOFF2 files", async () => {
    // scripts/gd-hall-fonts/build.py writes both in one run, from the same
    // instances and subsets, so fontMetrics.json measures both.
    for (const [file, digest] of [
      [
        "NotoSerif-Italic-latin1.ttf",
        "b17042575847967023a24dba5b9b4b16aa9fe9a627005acfed7b18ca2c48c6b9",
      ],
      [
        "NotoSerif-BoldItalic-compass.ttf",
        "d443ee9985cdaf7c3aa1120bfb3971b8f4f1b42896bf2c07cec5833b3336f475",
      ],
      [
        "FrankRuhlLibre-Bold-letters.ttf",
        "84304f1b7ce5fcce319b52946a714205d158f5a4ebc6050511090c50b41753ae",
      ],
    ])
      expect(
        sha256(await readFile(path.join(process.cwd(), "assets/fonts", file))),
      ).toBe(digest);
  });
});

/**
 * Every hall's bytes, pinned after visual review of the rasterised output
 * (plan 062): the source the outliner was given, the SVG and the full,
 * medium and small PNGs. The art and the presets are code, so a change to
 * either moves these, and the commit that moves them says why. To list
 * new values after a reviewed change, run this file with GD_HALL_PINS
 * set to a file to write them to. Theoricus 1 and 2 and Portal 1 and 2
 * moved when the Air tablet's sigil was redrawn after the Equinox's Plate
 * X (plan 080, "The sigils' sources"); their sources were 3c8d2e0a…,
 * dcf02ee9…, f8c29109… and 8c19b493… before. They moved again when its
 * four Yods were refined to the plate's slim lozenges (the same section),
 * the Yods' paths alone; their sources were fd4ba7bf…, 06d82cf0…,
 * a2af63a3… and 2ddc2792… before; again when the lozenges became the
 * plate's sinuous flames, from 640c6327…, ae07fd8b…, 04b89cda… and
 * 72f58a3c…; and again when the flames' left sides and lower ends were
 * brought closer to the plate, from bc1f483a…, aa8e7a73…, 969bbdc8… and
 * 48611581…. Every hall's three PNGs moved, and nothing else, when their
 * XMP credit (`photoshop:Credit`) became "Magick.ly, drawn by
 * magick-components (MIT)" from "Magick.ly, CC BY 4.0" (plan 080, stage
 * G): each PNG is its old bytes with that one string swapped, its iTXt
 * chunk 23 bytes longer. Every hall but the Portal's then moved when the
 * Hegemon's lamen became a black cross on a white disc (plan 080, "The
 * provenance check"): its sources differ from the old in that lamen's
 * disc and cross fills alone. Zelator 2 moved when the candlestick's
 * default became the Equinox's figure of 1909 (plan 080, "The rose's and
 * the candlestick's versions"): its source differs from the old inside
 * the candlestick's `<svg>` alone. Every hall's SVG and three PNGs moved,
 * and no source, when the rights statement became "© 2026 Gadi Cohen" from
 * "© 2026 Magick.ly", which is not a legal entity (plan 088, "After
 * Gadi's review"). Every hall's SVG and full PNG moved, and no source,
 * when outlined coordinates were rounded to `OUTLINE_PRECISION` (24 November
 * 2026, `GD_HALL_IMAGE_PROFILE` v3), the drawing unchanged; the medium and
 * small PNGs moved too, but for Practicus 3's. Each moved pin's comment
 * gives its old value.
 */
const PINS: Record<string, readonly string[]> = {
  neophyte: [
    "ea691cf4e967aa0724aab92aeb7c40fd846899f1a162fcdcf3c0a707ac1baafc", // was e9f85a70…
    "9bc71af776376245cdc5bc510f18ae0e5e4a4c13682f14174324c5e3bad19b2c", // was ee79ca00…
    "797d9722f6fb0ca1d8785c13339bb5c83d373ca84a56c527561796b345a4992e", // was 732e8589…
    "50ae5cb9506e2e915cae2d31a734e863764cda5e980e0f7c3a9f7b292213cb23", // was daa0fb60…
    "c16407cfd9a91199d4dd8bbdfe62f7d89c516f9dbecb7328f4d5f175f4973992", // was dda11357…
  ],
  "zelator-1": [
    "6d015d57759ebc5a28599a408dc114c132715042747155f7b0581cb9b736e8a1", // was c8b9f846…
    "4b75e4a39938f2cbff700372d254154b8e5e2309582a5c00f5be5540cc3fbf23", // was e3bf5c66…
    "e293bc75d65b86f444f27c7e5f213ae0a327a59ff2462cd78a0d4ddfa4f0fe81", // was 6712afad…
    "5fbc90dc5fd97528096376fcc8a556e8b6ab135713929425bcb013226286e670", // was fe148bfd…
    "31b4e01d837a5d346be58077194963fee84303f8cf74269b9f424d70a1c91c46", // was 8984f717…
  ],
  // Moved by Cancer's and Sagittarius' permutations of the Name on the
  // table of shewbread (magick-data 0.2.1), those two labels alone; from
  // 83fb7da1…, ebc9924a…, 7b7ff735…, ebf86b37… and 42f5e185….
  "zelator-2": [
    // The table of shewbread's archangels named in Hebrew, those four
    // labels alone, from da1b7cb8…, b38bb80a…, 19c1238a…, 02809bb2… and
    // ee71ec09…; before the Hegemon's lamen, from b6aac4cd…, 85d11121…,
    // 688ba819…, 0d432e1d… and 57707e51…. Then the candlestick became
    // the Equinox's figure of 1909 by default (plan 080, "The rose's and
    // the candlestick's versions"), its drawing alone, as each line says;
    // drawn with `version="modern"` the hall gives the old values.
    "0ccf7a38c8d1b9994cbcbb31e07bfed938e42d4bed956181d97f4dc1e09bd4b0", // was 645c51b8…
    "cf4f73598d1db15db534d847b2387d6fbcca78a9c14b15e4b49ad5aa2ad3fb35", // was 2ee955d8…
    "1d89ecc063a512caaa23434ede7e9b041eeb5d08f0be20120b0636ffa5870ad7", // was dc129dfe…
    "63624bc4ed08c7e6172c39c55546b7f83bacb1679c5f98cace2ce39eab5cbbec", // was 3c1ce9a9…
    "9c2ac5f896dccd5733cd11672a41442fb1adefa8e77d66e74215b0d9cfbbce05", // was 6244fd00…
  ],
  "theoricus-1": [
    "7da45131c491cb3f388b0d82fc8031a859bf5d6ffcdd93e15a9d99bc9c28f035", // was 4d9f0a74…
    "3c8688dc9861585bed062d1e50eeb77fb7ba09b4cca45c71d7febb6b3b3acc60", // was 778cc59d…
    "ef68ee2aa3da6fef5133ee52f7a8e57d6b0086c9fb0b36346492d0c0124f1094", // was 5e4f3115…
    "f5e95b83919b11a3c384b18cb23884bd1e3b8ef5431ff088d33bf134b1392fd8", // was d1c2ea2b…
    "75e91095d3f619fdff2e3999d3ec5fffd0a81856b304bd0c69c2f8dcacabd88a", // was fa9d36f4…
  ],
  "theoricus-2": [
    "352303afc2ad48b920e132294be306434c4cfe2d931cf48d70227c678a13d287", // was 72c860e3…
    "fcb3aa5305e80b608d56ed79d855d092b3f440600f04158d8634f6233c7a76a8", // was 8ea3141c…
    "53ef0c1e7617d4f7de020d77f0ba690e0e3e4ca53af0eeb8f7c5e0d17c5a9dea", // was c71f9457…
    "3e0e0d8e3ff74494bf3fc84a3a82085d09b0bc986271731c764cd5922a874ee7", // was b55f4808…
    "25cb0db1876448ec395fd92eda3fdfd9de97b5922cac9184a7915d3eadbb2ade", // was dcbea45f…
  ],
  "practicus-1": [
    "ce9b6dc503b4f1a225a1ee42f83f924f2135cdde2429ec330b93ab9b42978a37", // was 9bbfd564…
    "aeb9c7586b36e848e7784da693b03ca0c7a7c279d71baebe1c3ace5bc7d0b412", // was 778ccb1f…
    "cb74fb6b8008a51aaa1bff28519ca731685f66b2480c57e28c411bdb8ec75453", // was 6ca07d16…
    "b199308696b1065112a92ee8718dabc055af1d8a55d0755b48b2e5a475ea94e6", // was 4da5ee37…
    "7bbbc5ebb5036f571b06fbc3caa628a41015333e40037f13e8fdff51ba8a5630", // was a58bb6c4…
  ],
  "practicus-2": [
    "049f9fbb0fb370b724097ab88c35efb0fb3668d71230f6932d457b9601deff34", // was 6115a1bd…
    "1e2bb33aeeb2ed0234b948dc1e7dd37ac2464e454c490bb584df101a7de17b41", // was 3b94e335…
    "243dde6df21f3e59d6ecea7cab3313d0bfd2929c98b8827827ef3826fd691639", // was 18fa09d2…
    "46874feb71f70a167c1f7456a0b61f3330de2d1afc6344fe970a2630afe658b8", // was c7ca7e97…
    "1b4eb676934219494d0e8fab21336d45725c8308c7b20b714359f1e40123fc02", // was 6fb69d20…
  ],
  "practicus-3": [
    "2d5d118e1fa185aec6aed867011734297321b706b13c56a6dd0091cd1c4ca643", // was 2625dac3…
    "a5f3efaf5beee8abc450a4280f0d61f2a2e39acd22aada5ca4e4f12005fc7661", // was f311861a…
    "edc26cfc972b540d892ac359bbe08d184a2a10eb1700b219e1d378a128fa8688", // was f2ad6e30…
    "ae49dae3e9a6aa015eefe411e477b2459fe2bc35c6dd65c75fca9445beb3d6d5", // was a371ec38…
    "5ab73d1aef48822fc23727c193a6e8b71d79670c1680b90526fb96ef15ec8ba1", // was dd401d2d…
  ],
  "philosophus-1": [
    "9cbc7afd2c5ad8970b8e38bcfdf0f4a0b2808caed2b92dd7d8b8b7a613bbd403", // was e5ab8b16…
    "ed21d69a4878136ab08dc1d83829bfa86d1a31a22d5d64e6821540ca340d7b8a", // was 6812b81f…
    "92640463e6744930e2920401f8367852507374e2325cb7fbeec58f146d3b7493", // was 0b6081b3…
    "ac5f16289b9b2f03c1859954c96a04c7eeb1b3667b71f615c016c8e53ae944d9", // was 5de1af21…
    "b513968db4dbd841e087068e23fcbb7d300a72cc7abe3df0010c7223990dd1fd", // was 1211eaa0…
  ],
  "philosophus-2": [
    "923a513eb53f663165537b1317d2b3dac7758ff8f61517b0e6bb5e05c7d94347", // was 8e3f7f77…
    "4641dbf8f10089dfd6e9e1a1620dbbf7b39d481fb119c8e8a77a3d8b2e8be1e8", // was 33a839ac…
    "d06a18b7a8ee97054f0da7362828a3591fe759ef5ea35742c25eda22c7c2f75d", // was 53b68b79…
    "9005631554d6e7e1c95212dac63258491234b520816cb23bcaed7e4bd5fe1981", // was b9712a73…
    "d7f8df3b84c6431467faddf57aabde3b243b834bb17cf785eee666ca9e8ae5a5", // was 0835e43a…
  ],
  "philosophus-3": [
    "bc0fa5f400af04bbcb5a2ca2f494fbb8fdde68fc2d16af7b513385bd5209a21a", // was 9945d1a9…
    "594f16dd41298e40b10e5f19cbec85437d5c1bea5a4a28afad30ff686a95362a", // was a4d6c0e3…
    "1f51b7ad3172449d6b4c2be5d0bcb539db0c330b2d481d6cc4ecbc588d34c676", // was 7a0a0c58…
    "8b68cfd8c847d4118967046f8b0c04ca9e1633904839f2509fe939837dee940c", // was 05f1a3eb…
    "846dd6607edba1b83dd30e98d46521e71d67862e0907624725796bf3afc52656", // was 85cdb745…
  ],
  "philosophus-4": [
    "247d679ac6c7230ad13742b487a39d2e4eb557c90422b12edc7c2c827f78f269", // was 89633f1b…
    "0ea95a156131dcd01e09bf7581ece0ab3f143658e2c288f9beb83710b7e7b315", // was 6c7d8f0b…
    "a12b32170fd355b01bd0d9ad89f4afc7069751de96c1f49a9a5efdb96f9bc644", // was 00ee9af6…
    "ec26464036f6e83f626b244397d7b6029d95e1039268d8687beedda88973a14c", // was b1c29894…
    "4a132fcc6031b185f67253203ae9c63f4ad2d8b2ba897a26846b6ef3e342c761", // was 4499de70…
  ],
  "portal-1": [
    "c97aa8666a049b8c03ac12cdb7b2586f1bb1900e9f47e3fc331c1cb4f69f18d9",
    "751c0b0281b6526fb250bc739e2ac49b005ada5d91578911736abfa3acd9d641", // was 2b61b178…
    "d70342220cb2c3d1dab56fc9933e37a2b1104318c248a801cf986d2720e84d21", // was 37164857…
    "865cdd677a99e54056424c0929b2060a87c5d31e311b07a8d03ec9c6ffd6a57a", // was cccdd657…
    "0f44ace76d9be7cf8dae4842eff6bdddf34d96e2464779db39d481421f8fae31", // was 19f9a660…
  ],
  "portal-2": [
    "11766ad1a432c982874e420589d52fccb4438dc02582a525ed210f5ab089086e",
    "46046096440a32598151c55e86719f0b8ba54c8656c36d871189343db5582835", // was 0bd86118…
    "83ce30d4976547f636450d5a9d69a7970cd5a89779732e5a88140f137be739c4", // was 6f009c8a…
    "a2802dadf958e73230a60aef6389ef1afccbaac7f8a73be65bec752bc1ca1c63", // was b79900d1…
    "05204ff4c86426d540ed45443821f0a924f64497af04190f7ab5aeccab3ff310", // was 6fe050ad…
  ],
};

describe("each hall's image", () => {
  it.each(GD_HALL_SLUGS.map((slug) => [slug]))(
    "draws %s as reviewed",
    async (slug) => {
      const query = `hall=${slug}`;
      const svg = await render(query);
      const text = svg.bytes.toString();
      expect(svg.identity.profile).toBe(GD_HALL_IMAGE_PROFILE);
      expect(text).not.toMatch(/<text|<style|href=|<image|font-family/);
      const { width, height } = gdHallPixels({ hall: slug });
      expect(text.match(/^<svg\b[^>]*>/)?.[0]).toBe(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${(gdHall(slug) as GdHallEntry).viewBox.join(" ")}" width="${width}" height="${height}">`,
      );
      expect(text).toContain(
        '<cc:license rdf:resource="https://creativecommons.org/licenses/by/4.0/"/>',
      );
      const pngs: string[] = [];
      const pngSizes: number[] = [];
      for (const size of ["", "&size=medium", "&size=small"]) {
        const png = await render(`fmt=png&${query}${size}`);
        const pixels = gdHallPixels(png.request.props as never);
        const decoded = await sharp(png.bytes).metadata();
        expect([decoded.width, decoded.height]).toEqual([
          pixels.width,
          pixels.height,
        ]);
        expect(xmpOf(png.bytes)).toContain(
          "<xmpRights:WebStatement>https://creativecommons.org/licenses/by/4.0/</xmpRights:WebStatement>",
        );
        // The full PNG is drawn from the SVG's source; the smaller ones'
        // sources differ in their root's width and height alone.
        if (!size) expect(png.sourceSha256).toBe(svg.sourceSha256);
        pngs.push(png.sha256);
        pngSizes.push(png.byteSize);
      }
      // The size budgets (plan 062): SVG 300 KB gzipped, PNGs 500, 150
      // and 40 KB.
      expect(gzipSync(svg.bytes).length).toBeLessThanOrEqual(300 * 1024);
      expect(pngSizes[0]).toBeLessThanOrEqual(500 * 1024);
      expect(pngSizes[1]).toBeLessThanOrEqual(150 * 1024);
      expect(pngSizes[2]).toBeLessThanOrEqual(40 * 1024);
      const again = await render(`fmt=png&${query}`);
      expect(again.sha256).toBe(pngs[0]);
      const pins = [svg.sourceSha256, svg.sha256, ...pngs];
      if (process.env.GD_HALL_PINS)
        await (await import("node:fs/promises")).appendFile(
          process.env.GD_HALL_PINS,
          `${JSON.stringify([slug, pins, svg.byteSize])}\n`,
        );
      else expect(pins).toEqual(PINS[slug]);
    },
    60_000,
  );
});
