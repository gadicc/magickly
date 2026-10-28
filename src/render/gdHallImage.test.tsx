import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { crc32, gzipSync } from "node:zlib";
import {
  GD_HALL_FONT_STACKS,
  hallRoot,
  hallViewBox,
  resolveHall,
} from "@magick-components/gd/hall";
import { HALL_PRESETS, hallPreset } from "@magick-components/gd/hall/presets";
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
    expect(families(bare)).toEqual(
      new Set(["Noto Serif", "Noto Serif Hebrew"]),
    );
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
      "NotoSerifHebrew-Bold-letters.ttf",
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
        "NotoSerifHebrew-Bold-letters.ttf",
        "13c7ddab852ce3a9d6e0d02fab9fa21a35c6eef210dd57579c7e43d9074d5573",
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
 * set to a file to write them to.
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
    "206c75ab2cb5305154978908f194525606a7b13263257ba018b6c13e057ef449",
    "7ee535dbfd328d94a08539982d5d56765894f92ecd0554bc4a2dbe1ab58fbc05",
    "4afc1a95b7a6d14a2455d9493e30f6c273f44241f85631bae010c89a90ea74a3",
    "53610b5268d66a45e9599c17eb48a0869c86487fb1247f346cdb355838c4e78a",
    "f517af1374156b7f37d3dea661a3ee5db67cc73c608a8425a919be49d9a1f67c",
  ],
  "zelator-2": [
    "e771cb8febaf7f97c5698e6c3ef9d01ef64af0529a1b598dd666d90438e25f08",
    "20bd2791eedad7f22fb3acdb0bce78ad9ec9926a4c5353150c40e63d5b7d83c1",
    "0cd8ef4ce5186eb0a2e379517c7fedef0b8372d8f03c3f99b53eb7db7752b0e8",
    "a463960694dc277ebea590d42bef31a13ffd9e856b74a7a3375aef4a3c66c8cc",
    "5b77da656681cf0d2bbd341a069852c49e25771be2189a6d226640f75c6b4b98",
  ],
  "theoricus-1": [
    "31fca5f0262a34a041ca873a42b76c8ce101d6529279b12f8fcc7f3133ce9c18",
    "7baaa359de0b5383341f04573cce6737e6bc54f7ff81d097a266f047c6f74be0",
    "2c16815ccfa633411d5cf65586b4419c1c1fb6cd14256e771ecd6aff0b1fd3ed",
    "854b06a77ce5b43c00a8e8eef138f38a3df75ed3f88839cfa0baaf39f4d44470",
    "973edc1b9f2077d4a9375fb8ff85ef67fa8c5a081a3357b1c0f133340857e0e8",
  ],
  "theoricus-2": [
    "86366f1bea8cd60183ba1acf53e57ebdd33c19d5c050364389105cd6bcd90e48",
    "0a8a58c60bfa7cc5a3d81e30e8b8676818bc45ebe8ea373bab8e3846ff9804c7",
    "57eb3515f04cc2a0da884030d1ad7e76763502e9e53c20b65e02536d0ab20ef8",
    "8bbc6068bdca297a6147d49e6d204fe8e25954ae13cd426b0fbfe2c6484a9405",
    "205474ac67973138e8923a0757f298e7a744da548f7ad32445486f73beb36972",
  ],
  "practicus-1": [
    "e2c169f57f5dba61d9f4b98fd2a5671af164684d01951a698187771dab856e5a",
    "69d2d927c4b58eeb00d3c0563fc0a8488daa79780e5afe90c920442546f6f12f",
    "588b577617f5ce06bcf9c01c9d96e17a60a065a0ae11ba396a7edd525a5a372a",
    "c5a2934f4dd2fef0514fbd503b49ffc8671b8b3550cd9012b7a3f96b820e4321",
    "2494e669e09b953e555cd7079575f034263876a23e3b3a123d65b0909af49f7e",
  ],
  "practicus-2": [
    "05bf1ede8ac9893121bd2b8345979b29ec0f578a1cfc5aaeb2fa9f0faee8d61d",
    "c6400482454d53574f33f685951e1c9e0b13f1e7bf185c23cf730660e100b437",
    "15061041e429af57bec9a295130ccb2d5fc2534a596d2057b31446fe5c508db8",
    "20855c71816ed30441308aac31a0ec5b580cb99dca08cb2b71f23ddd986273bb",
    "4c62aa84194ca76eadd00430af5b19581bd27002f43ab71cb965c239dcbac5cb",
  ],
  "practicus-3": [
    "7cfb50e340b85c62a256f6534fbaba0f7db60849c707d2f5bc4ff38d16b07ad2",
    "bdd152b7338f6b4cd3f7e72808cc20e1e61ac517e05357a96f3cb8c1145b90cd",
    "e11d7d1ac94fe788eaf9d3cf30dd91f9eb5c21819edad0b1b34723a7447b6d1d",
    "86b6e0aae9b36855364eb27b28e7ffaa635141a2da996e421fd4c8bfac8c50d0",
    "619d805d3a85605631143243675c5170e4c2627154a951aee189ae61b67d24a7",
  ],
  "philosophus-1": [
    "ba7334ea6a0ec9422a0d77c0d436d7a9843eff3daba758d09bfdb99927d3e40e",
    "4ed8964db34458ed48d4d380ea05b86c6f88c9ef5c92a3ba0be724d11a4986a4",
    "12ebb2507e0380106cb91bf5e7051392d278bc82b691b54d4381b6d5a2f92f1e",
    "1ac0000ac579024672a8eed120a966d21e88acf53328aad1ea48dec4c656882d",
    "160519e64b6281785c3b3be14010b15fa5a87218652db1fc8ab4ebbcde2236c5",
  ],
  "philosophus-2": [
    "b4d9b6be08936cbbf75ca4699a4893bfecc13a5dea0ccf4ef89fbb0b57156ae6",
    "15fa4f28b4cb934a5dc9263fce1445b4d1c2c46eea2a2b7ad660a60e7de9deba",
    "2cd4ad5484744bc4aa584e5a220c3941a80963fdd79ba5ab8ec5a686ab561583",
    "60d04c1a3324943399c756aa98283d4aa0bdb38717ef5c87c860208f2660b1c2",
    "3633cff71d34b0a16bc1d77c42234a16e7f162e13dc6ecbd9062f974c2b3c773",
  ],
  "philosophus-3": [
    "83921fd796702d4199dd44244a1d9f4d04d79d4882818bbdf345dd4e40d7ab93",
    "64bb698a03077bd854b8b6208927e7881caaf1dbf3472225c86dfa8a72d5667d",
    "0ce08b63c99f98a500a30c48b463e1b57f213f34a3a558b7aa91c79b405b49d6",
    "641e27bfcc7312e53435073b7ec9f778c5c8def9a477bfb05e84e524ad8263c6",
    "415cf3c3e830c47c27086ee24960f3a8f0c748cbfa65d69ab9b57fbeee7f4eaf",
  ],
  "philosophus-4": [
    "9a02eae4ee5741e19d24b773fa619e7d8f9619a51c8386e71cd06ab6bedd6208",
    "2603b7c11349a118d9291d20ebe38b82f5f161440c7454ad386c0b869fd5895d",
    "b2188033a64eb06270467c138fadc5244f283f117b0483701bb2c4bc9c9c92d1",
    "94dd917009b8476f02ebce01e9aa8f11f0567bee8738af6b00033a48c59cf2df",
    "eba8dbc1a38943958d0544d0100c5d72adc8c9cbcb9624e723d96f3c721eb883",
  ],
  "portal-1": [
    "1f9e824e1dcf33b4eae9915942dc8751f5fd4c4e96e7879529707cf5b7529a0c",
    "93fd97327dc1ead49935fa062c9b33fa1452a9f7829c286cfb3d0f60e31353bb",
    "0ffe0f4f86ef3a08a5b4a0ccfa3361bf51e66ea0142fe61f734dbc075dfbd1e2",
    "ce793eabc1f5901fa7a5fa56aac869328a82dd0b0a3087b227783071935e4e19",
    "34e603c70a18a3765cd7683add736444d393af695daae0f08243f22e7a4e13c5",
  ],
  "portal-2": [
    "e323b230625016f682ead1655d65512900a826d03c4081afc8cb8f7ad0212294",
    "f0f08eda42ec7014fc35cb33a60e4b376456768843b2ddc15555eb6e919164f7",
    "63da485b787158fb343202df493cc9301a083be13b0c95134b0a4f00304db144",
    "a0a8a070485946bf0e39fc36fc3550c7b61137c42b8bac66613c5d5a0f838f84",
    "b96f3e3742f66ddfedaf6dbc21b75ab0cf6ee91cc857a6313f49f1adf0073a09",
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
