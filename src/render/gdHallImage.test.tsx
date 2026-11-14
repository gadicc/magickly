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
        "<dc:rights>© 2026 Magick.ly. Licensed under CC BY 4.0</dc:rights>" +
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
 * chunk 23 bytes longer. Each moved pin's comment gives its old value.
 */
const PINS: Record<string, readonly string[]> = {
  neophyte: [
    "e9f85a70cbcf6f2b5ce424c4c7b42a9c95c71834c2fa1c271f33cc19259d7077",
    "d03370eb92100e83efb8a06383172caa998322e231f3ee09c72abe0719eaa6a0",
    "68e23d1aae1ce63577fc30d40a4d06f591311837d8337f1716596275b0752d6d", // was 96ea6f82…
    "eed02bbd82bf9698935d002cd845fb9cca5e3a8d93c92318127ebd32a3883a15", // was 32e7829b…
    "ba7e0500bbe41f50644381b11fa2bf455d0d56120ab7eace884e574cba2a8f9a", // was c914fc77…
  ],
  "zelator-1": [
    "c8b9f8460fcadd4e7ce785d01efa481f0f8f12f64886cdf5ff2fc78077cd6041",
    "a526323dcf5939188eeeb1947d46f7a2f2a6dde141a26e566c42ad6f4ebfc686",
    "ad8dfce5a679755cbc4c2e2ab1e03755378ae17de714a6e3b6906d2c1d2848a7", // was afdcbe31…
    "055dc2be1954411e86fd5076f0e6ca127694fb66722d59eb84b99d62eb5dca09", // was 578cb9d9…
    "86f29dc51f3bedf204c78e56d2e8b514e4a52fe9974491b9e186ac008ba951be", // was c4d57ea0…
  ],
  // Moved by Cancer's and Sagittarius' permutations of the Name on the
  // table of shewbread (magick-data 0.2.1), those two labels alone; from
  // 83fb7da1…, ebc9924a…, 7b7ff735…, ebf86b37… and 42f5e185….
  "zelator-2": [
    "b6aac4cd3fb60b52771333d7de1e55e97192e90a6d19d225e0f827ec39a3747d",
    "85d11121b69e9911f3c02f717d94ebb36b16a122f39b77fa1cf57b819744f878",
    "688ba81972cc18ff999892b9ad68f47738c6ff34a024a5ef18631efecb6b2e5c", // was 0e9393fc…
    "0d432e1d3bf50c172b8f47402f87b7ce1eacaeb53b789592dfe1e6eac51aa704", // was ee6aead8…
    "57707e51edf8e06abd44708fc38180e99a11b80813b6ba70e497c5ecc84171fd", // was 0cff95be…
  ],
  "theoricus-1": [
    "4d9f0a7431254eeecc0216558cd7fd87aa65be8d31629777aa1049743be99024",
    "d330795a8ad6af3fc1fe330920a229be4ef18742d72f10758d1376750510be1d",
    "235851a76406da3d03a0d210f410ee0e368568efb28169aaab273a03e9478e9f", // was 49ce61ef…
    "37c8bcba2bb82f277f8fcec714e16f810dca6f12f28aa3d1e36f6b6f4f40fc50", // was 2a4fc1cb…
    "ce9d536b81e13020bab1d3ac7864890b36ec13801a252e3af0b6d48419a406b0", // was eaca1a11…
  ],
  "theoricus-2": [
    "72c860e3bdba8b816d0bfbf02558666d901db112989d2d44261171f0e31c1736",
    "aafdcfddbb470f434a52fc3055939b1aa888090f397f41567ea80d42dfe0ed7c",
    "f62b4b488811da0807b05021cadd6a7878be621d36ee0e8c80fa836b504ac887", // was dfbf57f0…
    "5421d8211e97a46d2bad065be0c414d54b93ba1e5ed96b5695dfc0c667869bc8", // was 7835a03c…
    "aaccf7b2ec6cc872b2e98e1a5dfb17128aa2223a192838303167cafdf7ab6108", // was 4d3ed103…
  ],
  "practicus-1": [
    "9bbfd564d558aa4a1453383c46bee6613f50531418c29c8401255e57c8b83d88",
    "fca78d054e2f82da03460dd9bcecd1aceb4e84e3605beceb0031be67ad39837b",
    "a82cee309a14889ba0c6063de56d378eba15c54f1e8137faecf35ecf79140b5c", // was 54ce6658…
    "283dd82aa4dbbd88cf076c6f595ebd932448ae53514822a70ca4c0ebedfb71fe", // was 708c3b42…
    "0aaf7f4487c59566f3747e5359a21c5a3599ca3cd466bc646bd59433b4299531", // was 245aeb31…
  ],
  "practicus-2": [
    "6115a1bdd52b4e90e90dbc2db5a97ed68c679a84254fb305bfcade21cae57d25",
    "4bef9a344748b3df35897b2009ca368b2e031411903fda668987f558f2f30f7c",
    "35e71b512d9cf17c71b0d91f8d95847a35fe140248a796053f08223c1a862378", // was 702c27e3…
    "74458edc97980dbac8020216b26f3baf38708468a1f9954a502529ddee0be7b7", // was fd391b8b…
    "fdd3d96406df55177b1aef2b035b91ab933260bf10a729b77f555fd481a29e63", // was 22a6f70b…
  ],
  "practicus-3": [
    "2625dac315c1ad640e807a8b135642f09efc788393c80affb741b850493a5e6b",
    "e82eba8b0d6888b60129635c38a206e519b11fc3f42edd816da9c146d5b419e0",
    "46765d2adcfa36a0478a5258de2313106b0c55d4fc2721e0ad5c2733ac58f367", // was a9fa8657…
    "499de4c55632c7c0ea78298e9111f67e0e4cfee7d9522c63d72f0fdaed718823", // was a1381bda…
    "58fb9f7299b721f212fdaa14bb79e401a0c032d4f9e47f76d036488052f5b0df", // was 546a209a…
  ],
  "philosophus-1": [
    "e5ab8b166a4836795632f16f704563ade272cdd418637e577f9cfe888f76865b",
    "307d8a939b1945945668119ca1c9b6b33a24c75624e8407fcf498d3076586347",
    "16e13a56a3a90cb46132f0d7b9120c3394ba08ab6e4b475ddddc7a7a1c2876f2", // was 6a53d9a1…
    "e73f09219492bd8aa5062ca2ed7ddc70ce857b5a95dbc7a6773d3533bc57c749", // was c37d1155…
    "15a354ce011cb1d7fa23fb6d8e6fb6315f94dce6498e21a5fe8461b2093681de", // was 3ef4cae1…
  ],
  "philosophus-2": [
    "8e3f7f77f28b524986166b276b70c591c6b664c6e001bc5fac1525985b408fa6",
    "dbafcdc3c2e45ee9c4522465d24578f446884e77f01087fce1d7582455c3cf3b",
    "5c2727318345ac8c79690f7d0afb08d7388c6ac3b2bb62adeec4aeb6780a402c", // was 05492cf1…
    "e4aa902b1bd65da098eb3baeb6fcff71f3b758023b2c1aa4e94c96f73bf91dc0", // was 783f3f63…
    "d7cf4158e663308f59f6dbbc3ecbe3045527afcd31dc9cd349d9426a543924a4", // was 360c131b…
  ],
  "philosophus-3": [
    "9945d1a99a34c1915e09497927a1e4cc64af9bdb8ad1d8873195ebaf8763ce59",
    "6ed2ef8598c818774c3030afbbd2844e5162f277e3fcc16c8fd104c748be7d54",
    "18eb1797d1da11293790e57e15ecec7161ad9cb85551fc301c73abf4aa00527b", // was 50151ac2…
    "9b6e5765f72cd87c90790d4a5796ee755fb105966b37f071d9b672e4b3b04888", // was 65c4dbd5…
    "7b5ae1caaec1b2bafb60bcb69fc982ca7ff10cf05af6935bed41384906d94ec2", // was 8eeec21b…
  ],
  "philosophus-4": [
    "89633f1ba3e7d98996fc7a4f6794f25f6f5ceae8135ef61678e6c0e881257bb3",
    "c434c2b6b9337c954865001dc5e51c7758d94cd260c1f0395afe8ea8586fa587",
    "e26e037847139554f9b7b5ba9eeed968ea14c82ed3290b0ed29b2457c0a00313", // was f53835b4…
    "787c6188f69f9f15f2e2177937ecea249fa85a4f82a8880f5be7ec2818071349", // was e0f513ea…
    "756a3148176fa39707c4b6509faa0956b119f6e132d9851fa3e51c9d47c7673c", // was 59499e84…
  ],
  "portal-1": [
    "c97aa8666a049b8c03ac12cdb7b2586f1bb1900e9f47e3fc331c1cb4f69f18d9",
    "767f1c4f55069979413bfd66689ea3e3cf025b23bbd94fbf1e5c5eacb8a37eb9",
    "580fecd9909690d24d41ff68229c868f8f9ab2964483c04e56ea57d39b7caf95", // was 5d2cbcd2…
    "ce2aefd8b55080a38657b41cc6bc8ccc85d8f2cb9cb9116398c3590afd1f680f", // was c47418e1…
    "5ace6881244d409cac1686e953c5ecb7a2dab51687ee639b040e613f2f0c4267", // was 7e6d8ecd…
  ],
  "portal-2": [
    "11766ad1a432c982874e420589d52fccb4438dc02582a525ed210f5ab089086e",
    "30641cfb0b1c8d2fecb06e5784309b618e326e4d32da29e9d4a5d538afb13c02",
    "768956ec24b8ab111ea72285f5ae51d8adf1c732684b55e7ee887b1ea8ae9e20", // was e503e3bc…
    "5c2d9582c0a36193adfbe9059addc77c38fa1b032827ab6ed3b52eca1f0d5cd2", // was f9599514…
    "c9a3677bd9f7c890eb15bc83f7f0b0264890f90ca4415260c628a80c21961c77", // was d1f1f019…
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
