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
 * a2af63a3… and 2ddc2792… before.
 */
const PINS: Record<string, readonly string[]> = {
  neophyte: [
    "e9f85a70cbcf6f2b5ce424c4c7b42a9c95c71834c2fa1c271f33cc19259d7077",
    "d03370eb92100e83efb8a06383172caa998322e231f3ee09c72abe0719eaa6a0",
    "96ea6f82412a0835ddcc83ce4742a4877676cd38b7fe0bdac3dcf8cb655d1c4f",
    "32e7829be7df2af1d5eb5bd46952eee78203491cdefc98debddeedb7fd6afba9",
    "c914fc77fee6bdc75750567bfe51222410e4a2bd65415b467ed7cb5344e12d93",
  ],
  "zelator-1": [
    "c8b9f8460fcadd4e7ce785d01efa481f0f8f12f64886cdf5ff2fc78077cd6041",
    "a526323dcf5939188eeeb1947d46f7a2f2a6dde141a26e566c42ad6f4ebfc686",
    "afdcbe31973194e6fdd2f751003c0d0a3ed903e8756969efa3dcf4d4196acda1",
    "578cb9d986175aa98e4b79818255229253a289d6ad2b3aadef5ea817fb24902d",
    "c4d57ea026d42d05fbac83c42d0d7e65908ec8f698a310e502e20dc10fb95c81",
  ],
  "zelator-2": [
    "83fb7da16cdc3715aa7596ba7ae3f714006d0900d0c09b43c2dfe495d68cc977",
    "ebc9924a4d5657e18b777d553e5afc643944e6da8128117b850bca49b955b0dd",
    "7b7ff73572eb3f75f81cca7f4e8e29addcfcf67f3b4c9b8774e7e3285f9d2e2e",
    "ebf86b37259d69a22bcefe9309a9842fd0dc608b43cd4b7b3bad3cb7d92bf429",
    "42f5e185e0a3b973fc893b7edfbd0c35e9783c30db9c07448cffa6d8c7d2a825",
  ],
  "theoricus-1": [
    "640c6327865f7297072b2026f3406b501a65b1acf84ce977f0b8c30fa1dc9044",
    "0d4980533430202f4604c786621db768f33bbb97c204d5c26aea4324b895ab4e",
    "ed83fcb2f4885b059c1408ce66f3f7bcc7e81333aa6f8b2e8a7479e58a7ef438",
    "f7582d65e339981980d9d5eb437e331d26c986f4c01d7613a3c59c836d512c30",
    "309099441eacb58444eb56cf52eb82e76647e7d0b3d637254be0d14cb2f3d964",
  ],
  "theoricus-2": [
    "ae07fd8b54a0ce20fd420e1b1dbaee7510c8b57ef6aae49b27afd1c01fbb75d7",
    "f8290dd6fe3099eae0721636ff9cc3e8fadefa7457b436e7ae327cab04eacef9",
    "984e014568e87472486e744975ced7c7e1212465579d500cd0df898c7865ddbc",
    "23d4ae812d27a4b42c33650bf494126ab7e82f1ca4245dd881a198cf68ca5aa2",
    "35b30dc4dd6bb682df612284c51a053627f752837538b1e1495e9a244fbe9b58",
  ],
  "practicus-1": [
    "9bbfd564d558aa4a1453383c46bee6613f50531418c29c8401255e57c8b83d88",
    "fca78d054e2f82da03460dd9bcecd1aceb4e84e3605beceb0031be67ad39837b",
    "54ce665861892dc08d8517a032e12c3002015652f2bc03f0ce3b340fc087a138",
    "708c3b429d53116c40d8f677ec497f90eab43b412528697cd9d4127d94e535f6",
    "245aeb31e5613bddb0e5e0770fa2f6f93f2e1b4509ca29b1e05e29196e51e484",
  ],
  "practicus-2": [
    "6115a1bdd52b4e90e90dbc2db5a97ed68c679a84254fb305bfcade21cae57d25",
    "4bef9a344748b3df35897b2009ca368b2e031411903fda668987f558f2f30f7c",
    "702c27e36ab1a9667770efc3d52a34628c1b6b66dbe431b32fee9c046f8ba115",
    "fd391b8bf91a6a869752f3e265692d1eee91f14f8ec45bc5b2ee0f21db7c1a25",
    "22a6f70bbd47a53adcf68f148e4de7b3d76ec39c6492db20cc33a9d115773e30",
  ],
  "practicus-3": [
    "2625dac315c1ad640e807a8b135642f09efc788393c80affb741b850493a5e6b",
    "e82eba8b0d6888b60129635c38a206e519b11fc3f42edd816da9c146d5b419e0",
    "a9fa86576eaf78a9748daf0369418e36f6f382bd2b38c6b4fe39ee67a9b7f5b4",
    "a1381bda2a5d348946f4ba2d44ec61ef2c5ca791a2483a2ac5f8e5146d4977d4",
    "546a209a2c35cea40e9b734b99079c4bdcef5c51918fec26d402e960465572ef",
  ],
  "philosophus-1": [
    "e5ab8b166a4836795632f16f704563ade272cdd418637e577f9cfe888f76865b",
    "307d8a939b1945945668119ca1c9b6b33a24c75624e8407fcf498d3076586347",
    "6a53d9a1227c31d8236e235b11407e72810420ebc910e6d9140084b9bb9ec186",
    "c37d11556b6b04452f1d7ea0829914db4d344f842839fd11a91d5180b01e2890",
    "3ef4cae198ad45189908f170728a0c5e96a509970f065ab34edf61475d48e16a",
  ],
  "philosophus-2": [
    "8e3f7f77f28b524986166b276b70c591c6b664c6e001bc5fac1525985b408fa6",
    "dbafcdc3c2e45ee9c4522465d24578f446884e77f01087fce1d7582455c3cf3b",
    "05492cf126ee6d21e875d35088ec76d838b6d7d5d7e72d88142ef42722813708",
    "783f3f630c6425bdd10730d4d198bfa2c8f63934b62f3520335d7ff8cb2b2386",
    "360c131bb7cb36fe9b468bb67b803a0ef89dcc4ff658093b1aadde5d6cf4631e",
  ],
  "philosophus-3": [
    "9945d1a99a34c1915e09497927a1e4cc64af9bdb8ad1d8873195ebaf8763ce59",
    "6ed2ef8598c818774c3030afbbd2844e5162f277e3fcc16c8fd104c748be7d54",
    "50151ac2d27f0aebaff4c43136355be0e9a957bd86b5ea6b87d9f382c8eeaf31",
    "65c4dbd56c8c1a3eb570e2db884dfc57f495323ada829dfe56ddb5a78cfdb58a",
    "8eeec21b1f6b93f2d98e0d63dca48f1a73680dd5f6d3e22c26d31a001b33cf29",
  ],
  "philosophus-4": [
    "89633f1ba3e7d98996fc7a4f6794f25f6f5ceae8135ef61678e6c0e881257bb3",
    "c434c2b6b9337c954865001dc5e51c7758d94cd260c1f0395afe8ea8586fa587",
    "f53835b4a1b4ca147a199ceecb1a8015ef3058267f131efd5e0d560ea63123b0",
    "e0f513ea635c8593a580442ff2f8ff485329992b384e7649f2204420d3c9b9e7",
    "59499e84a949e60154b7a2128349b28e8e23f1a6d28908de18bd271de9167c75",
  ],
  "portal-1": [
    "04b89cda76e2034d5e28e93c971ffd945e3c4b35b8559f0fa3542ba49d7204a0",
    "c318dd0c80e2040a1254f2a041d0bbce196bdbac6db188357704ab5be76ec825",
    "f1c650219025e7a91b1a63da4a6fb98974b60880a404d0a24cc148029f972a00",
    "edf990ca48ccc8ebe5154cbe62b39e7e0c9a45807acb1f39471096c21933cd01",
    "2c976708bf64a4799f2c710c042c7d2eeb5d6e1ca339516c4241adc04c97df35",
  ],
  "portal-2": [
    "72f58a3c7a43b269ad2d84a49cc0adeb408e7897911b527e929270aeaef6cadc",
    "5c43d7861a6b89c1cb7b60985cdedf2c16bb53cdcfbf63b20bf198a54b0b5486",
    "0e5656466e25aa95aca31ef0684fd33f220900cf371c33f3f1b8cac13242674b",
    "f00b1f1bb71d9d4b668fe12a274c30f30b043ee2463c999017f45311b67e3f85",
    "e13543caf8b505fbb28e4fb9830ff6c66c2e2be0fdef39178b62c559a7b073a1",
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
