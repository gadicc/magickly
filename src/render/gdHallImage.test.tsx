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
 * Gadi's review"). Each moved pin's comment gives its old value.
 */
const PINS: Record<string, readonly string[]> = {
  neophyte: [
    "ea691cf4e967aa0724aab92aeb7c40fd846899f1a162fcdcf3c0a707ac1baafc", // was e9f85a70…
    "ee79ca001a97d2af60a845f03969b5c0bf9ce8b7f15d7738be879ddd17208d27", // was 7bd63c47…
    "732e85894d185a04bcdddba32ac3796dedd7ba53fc86d8d935110ee48e44555d", // was a6d38ed0…
    "daa0fb602c23ee9ce806bd307b0f512f4a3b9d553ba718b62fe872b2855f2ab0", // was 6b61743b…
    "dda11357a8d9ddd41fcd617cddffb868d31f186275ca762d024d0f6c18197186", // was 97ce7592…
  ],
  "zelator-1": [
    "6d015d57759ebc5a28599a408dc114c132715042747155f7b0581cb9b736e8a1", // was c8b9f846…
    "e3bf5c665d332e393b4901e70e36a79ae39a3e697536d6093e4877bea6721da9", // was 9477204f…
    "6712afad77e6f5905ae9a47a2569b0caee1a65a019c1526008879115172eee32", // was 70d2bc70…
    "fe148bfdec2c7f6e0cf9f3e69282312df8598dafcb2c2037ee83bfd9d0ad1c45", // was 07c0a152…
    "8984f717325e442471df271c8227b282a2c7e88c3cdf5815d008d8a433aabb81", // was 07cb05cf…
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
    "2ee955d82e1eda2d74675cf2599f458cd1a475696eb096efe1068bae1972983f", // was 50299ad5…
    "dc129dfe07f8ce3abe1797d8b7ec596fcb394b228d323c315aa7482d2c086be3", // was 8066e397…
    "3c1ce9a9a83e73a7b2cf8876a63c70a428ed90569fa5c52b6a82c8bbec7dae76", // was c6ba7e77…
    "6244fd0002703a7f3ce6ceaeb6b8e200ceca08fb6f2a07b57c2bee02900abafd", // was e6886725…
  ],
  "theoricus-1": [
    "7da45131c491cb3f388b0d82fc8031a859bf5d6ffcdd93e15a9d99bc9c28f035", // was 4d9f0a74…
    "778cc59d8df39cb1cb3775c8c22e2d7f420a5156f8051e58ea8d9ea6d75a3995", // was c713b57b…
    "5e4f311548b08b58ee899c0da9c4c7eda7cdfe64c393fe50b31a49c9d39ece37", // was b7a2d0a5…
    "d1c2ea2bb4a62617e09b630a42a6c7707cbd3637d3238ce90558d19ce1bcf236", // was 727f0b8e…
    "fa9d36f46475c00e6452c423011cdefb9f0bcd5eb4e71e988b1eef0650c5ed0f", // was c7766c1e…
  ],
  "theoricus-2": [
    "352303afc2ad48b920e132294be306434c4cfe2d931cf48d70227c678a13d287", // was 72c860e3…
    "8ea3141c1021edafc9ba409527d3ceb0ffb339d7c6db2f217a8743bb26219f68", // was 0d00a079…
    "c71f9457cafb42a2f5cc58fe70d8a1276bcafc18a06822f8f8a2c10183ee3ccc", // was 0084497e…
    "b55f48082e320c4a96b4478a0f639042d1fdfcdf34cf945bb1fe0c4276696422", // was ae95ea8d…
    "dcbea45fe34c41d701e03f7fe3456700d15358bd5962f5761b21e7a9ddee690f", // was 5f9d6384…
  ],
  "practicus-1": [
    "ce9b6dc503b4f1a225a1ee42f83f924f2135cdde2429ec330b93ab9b42978a37", // was 9bbfd564…
    "778ccb1f5e56782210bc97c5dcf3da9736fc39869dadf12b57e1635194cb9dc2", // was 3755f0fa…
    "6ca07d168df9d873791ea8d6c79d3ef68440f96b392c6d741d84c259ecd57593", // was 172f0f2f…
    "4da5ee3733280f2da2d363fc0200fab182eee284a2a5ea75cfa2ca39166c5464", // was f751fbce…
    "a58bb6c458b6b76b1c722c22d2b9615f3c2ab2a5207f617dd303794d4e616d02", // was 32f2caf8…
  ],
  "practicus-2": [
    "049f9fbb0fb370b724097ab88c35efb0fb3668d71230f6932d457b9601deff34", // was 6115a1bd…
    "3b94e335e4a5ec538ee3d55cae0b64d511b9db4affcfbef720efe59d04bb2e22", // was 2c311ed1…
    "18fa09d2cbda355ef856aeec5ec23a3291853ed135d8277f11a84fe294086741", // was a3b7a93f…
    "c7ca7e9728c9bd19d7fa0dafd4807f60820b28a91145dab3e1199be04df671ab", // was e8ab0099…
    "6fb69d20785745f78dcf853ff4b7d087208c3e0ccdc85e7ba9fb4bd5355ded6f", // was a4cace09…
  ],
  "practicus-3": [
    "2d5d118e1fa185aec6aed867011734297321b706b13c56a6dd0091cd1c4ca643", // was 2625dac3…
    "f311861aa9917df34954465e7f98e6a46a48ee386391e9a3595ca3f94d8b8fa0", // was 1a5423e8…
    "f2ad6e30f37ffdfe86218d78eafa524c1082683dc40564c641b922bfbc102d12", // was 55b03ae4…
    "ae49dae3e9a6aa015eefe411e477b2459fe2bc35c6dd65c75fca9445beb3d6d5", // was a371ec38…
    "5ab73d1aef48822fc23727c193a6e8b71d79670c1680b90526fb96ef15ec8ba1", // was dd401d2d…
  ],
  "philosophus-1": [
    "9cbc7afd2c5ad8970b8e38bcfdf0f4a0b2808caed2b92dd7d8b8b7a613bbd403", // was e5ab8b16…
    "6812b81f97c0ba1a3b16942cd04370ed283f4ff77d13ee3fcde4bc231a040d0d", // was 0c78c468…
    "0b6081b3b384c5db5c263d7968d5f296e69639a8b7c1d5602f430ab296ac6c7f", // was bdcb052e…
    "5de1af219b20f2ad7ab0bc7060189ee5a8e0f8a8078fe574ae503ec8d1842949", // was ef0c738f…
    "1211eaa0354d8265db4011e298819a3a1c5407916697c7b8ca73b0a9a9cb06d9", // was d6ef5842…
  ],
  "philosophus-2": [
    "923a513eb53f663165537b1317d2b3dac7758ff8f61517b0e6bb5e05c7d94347", // was 8e3f7f77…
    "33a839acff71f675ee9fb43cd8d2f3ef189be5a8eba0f3bfb498de2154cf7369", // was 3ab897f2…
    "53b68b79bde881297d6d8ef8b0744cede17e3f7dbeacedd7ad2ef60345bd3e1f", // was 6722ef35…
    "b9712a73755d765922d65b3f97b096b9b7fc7dea31181c8014b773bc63118bd4", // was 640d226f…
    "0835e43a62ca385199376e6f55cb633d636f1b2fe2c8115bc8917d6023aeab84", // was b652ba5d…
  ],
  "philosophus-3": [
    "bc0fa5f400af04bbcb5a2ca2f494fbb8fdde68fc2d16af7b513385bd5209a21a", // was 9945d1a9…
    "a4d6c0e3c11a9b11c789996cd2094b000e153493f8e24d1e24ca6df44802e119", // was bd795d7a…
    "7a0a0c58bc0e05854e63fbf62e563ad3ca13224b3e32fd9df4e887fd6fed251b", // was 4c42f124…
    "05f1a3eb8d1d6f2f824a7dfec02d3cabdad8e8a8fa401c1e2e8c90fda33c2f5d", // was 4cdfa61e…
    "85cdb7452929b6873edbdc5192b64a00746cd3e6cae993d363450036602e7891", // was 8cd2b3ef…
  ],
  "philosophus-4": [
    "247d679ac6c7230ad13742b487a39d2e4eb557c90422b12edc7c2c827f78f269", // was 89633f1b…
    "6c7d8f0b347758460fd4231723a1d9d0708090ef8704a73763cf2b5fee43fddb", // was 8e82bb46…
    "00ee9af6f3bf9c82312a49a683198d2c2bc10d62a5eb8469d80258b730a19149", // was 3b3cbf68…
    "b1c29894e0765899c0f5b2397990c6e9d7f00417014e3433ea63dc80995581f8", // was 4059967e…
    "4499de70c3fb8d75c0bc7368cfe1c51aedda2ec3e4e21302f12cfe55e17acff9", // was b2da11ff…
  ],
  "portal-1": [
    "c97aa8666a049b8c03ac12cdb7b2586f1bb1900e9f47e3fc331c1cb4f69f18d9",
    "2b61b1787426930e65a192d14b5493191fc867cd884f7fc6513e825d66bf4406", // was 767f1c4f…
    "37164857794d8c6974b9e689b9e390628ea0584a60031e0a915a9ed30c92c922", // was 580fecd9…
    "cccdd65732f26da71970142b65402892c87e2514db65a756438f8df943420d23", // was ce2aefd8…
    "19f9a66010a35c1c297f00de3477c3166f484a6ddeeb3ce21ea52ab50efed320", // was 5ace6881…
  ],
  "portal-2": [
    "11766ad1a432c982874e420589d52fccb4438dc02582a525ed210f5ab089086e",
    "0bd861180c4eac5979f31d6cc2148bd47f881aa495616ea68c1e6bfdc153de89", // was 30641cfb…
    "6f009c8a5fa58c979056e0f7e95df3a22efb3f95fa97d603a60ad20e9de4d1ad", // was 768956ec…
    "b79900d1c6ebe587c66b029363ce007b6a8c358ce7249b2351a1670900fa04fa", // was 5c2d9582…
    "6fe050adb978bd4fa4c11dcf22339c5d79031e4c259c2ea45c9fdbbafe5db8f3", // was c9a3677b…
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
