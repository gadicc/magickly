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
 * chunk 23 bytes longer. Every hall but the Portal's then moved when the
 * Hegemon's lamen became a black cross on a white disc (plan 080, "The
 * provenance check"): its sources differ from the old in that lamen's
 * disc and cross fills alone. Zelator 2 moved when the candlestick's
 * default became the Equinox's figure of 1909 (plan 080, "The rose's and
 * the candlestick's versions"): its source differs from the old inside
 * the candlestick's `<svg>` alone. Each moved pin's comment gives its old
 * value.
 */
const PINS: Record<string, readonly string[]> = {
  neophyte: [
    "ea691cf4e967aa0724aab92aeb7c40fd846899f1a162fcdcf3c0a707ac1baafc", // was e9f85a70…
    "7bd63c471ace887022b9c03fe24562660b8acc3deb30e7a3da90c13bd9c699e8", // was d03370eb…
    "a6d38ed06f5ab258a3633e64832ccf12005c168a14ce262e72cc8e2d7ad357cc", // was 68e23d1a…
    "6b61743ba0defe65a14ba123cd4a661dd34847603c588be7da223647ca0936ca", // was eed02bbd…
    "97ce75924fa9c9efef8bbe71f011aadd4f977a107e3ef353e741cdaf0adf44a9", // was ba7e0500…
  ],
  "zelator-1": [
    "6d015d57759ebc5a28599a408dc114c132715042747155f7b0581cb9b736e8a1", // was c8b9f846…
    "9477204f6baacede770fdc2f61d04b305c34a342e90afb20067019d7087549f0", // was a526323d…
    "70d2bc70311b2b4991c3d0437ad8b8067031e3dcf5b45d7ad56a924eff0587e2", // was ad8dfce5…
    "07c0a152c1ef022ce9342656e199e51e5407afe2fb00efc5d4bea1ac4aa60b44", // was 055dc2be…
    "07cb05cf8e155af3f6e00ea7821e9f382e71af42d713e4a0de19c40204e6ae77", // was 86f29dc5…
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
    "50299ad53eabb69c915ec51100da5f80be6be6ee25111b3d041fe72c2666cce8", // was cdfa749b…
    "8066e397f81d9ec5c5f9646eb31629cec57c0716703a26a2861883a40fc853d8", // was 97ba3359…
    "c6ba7e77a12c94d0e0f220849fcf5fcc1fecd9398e09cc48a33a694a03cd4332", // was 1e6eee81…
    "e68867257d79994e42c1800671d9fe11f5905ebdec8e28158ec354ed2acb8ebd", // was 3798d662…
  ],
  "theoricus-1": [
    "7da45131c491cb3f388b0d82fc8031a859bf5d6ffcdd93e15a9d99bc9c28f035", // was 4d9f0a74…
    "c713b57bfac5836b7228d740d05f2b54f47c2a469d73b6b21697b25dcc9be9c7", // was d330795a…
    "b7a2d0a57bc736f96989511849df9b02ef4a569c539178f86cb60a2cfb32c6a3", // was 235851a7…
    "727f0b8ebd69c6c1341bd8a5186125f457b239e14673338b80b30d3477a0b78a", // was 37c8bcba…
    "c7766c1eca34a2fd448209754bbe3d40b58724a7f61880873ecaa2ead464e115", // was ce9d536b…
  ],
  "theoricus-2": [
    "352303afc2ad48b920e132294be306434c4cfe2d931cf48d70227c678a13d287", // was 72c860e3…
    "0d00a0792863b4ddc3943c0c60f5084101d8b47899bf14e72d4bea02d706bd40", // was aafdcfdd…
    "0084497e69e7a9a9c481e5e27616e24aa01ce916302c8b9a17494c575cbb4a24", // was f62b4b48…
    "ae95ea8d4a413eb6bafc54b9e5aeb7250dde7c4e30a449d46e6bd7e5870b283f", // was 5421d821…
    "5f9d638485de4c0d08f9c992f0b065dab2fdfa75062bbc22196f72e6e20cc81e", // was aaccf7b2…
  ],
  "practicus-1": [
    "ce9b6dc503b4f1a225a1ee42f83f924f2135cdde2429ec330b93ab9b42978a37", // was 9bbfd564…
    "3755f0fabcf290789003e03ef1393270f8b5df5fbfa2c96484d3501c1953e5f3", // was fca78d05…
    "172f0f2f4fb6c3934953cda962eaa8a44be68fdb58bb386da5bf418a096f0ec6", // was a82cee30…
    "f751fbce68de4dad888c7b4e1ac38bc8f9cb55ad6ca8c71f48142eee1da0bf87", // was 283dd82a…
    "32f2caf809bbe7cb18feb97f62f4b5205cef66923d1c893bbde6d92e48696d57", // was 0aaf7f44…
  ],
  "practicus-2": [
    "049f9fbb0fb370b724097ab88c35efb0fb3668d71230f6932d457b9601deff34", // was 6115a1bd…
    "2c311ed1666c00cfd9e418151a1c54a04299809a5d46ffcda7ac7f5f79e80171", // was 4bef9a34…
    "a3b7a93f4fc7a66f347c2544f1266a3c19b016923af7ddd64412e07d36cbdfc4", // was 35e71b51…
    "e8ab0099d6791a2ec5aceed09536992a4f601959a357743529edfd355427f868", // was 74458edc…
    "a4cace09483a734c92f2313693f5943f6dcba000111efe2a471f4870ece7d431", // was fdd3d964…
  ],
  "practicus-3": [
    "2d5d118e1fa185aec6aed867011734297321b706b13c56a6dd0091cd1c4ca643", // was 2625dac3…
    "1a5423e80776e5665f3a81b07d86b64ea20e57f1b8de78a1efa881901b70549f", // was e82eba8b…
    "55b03ae45688c7db3f1c4faae2c76cadeb572b02cfa11c0e84c58eee4df54359", // was 46765d2a…
    "a371ec384f3d4808884fad8aba374f4098210aa64995f54c65b95c56ef1cb7b0", // was 499de4c5…
    "dd401d2d9d26d26e780d21d16a3376f6330279cf4963d9acc937fcc9900cf552", // was 58fb9f72…
  ],
  "philosophus-1": [
    "9cbc7afd2c5ad8970b8e38bcfdf0f4a0b2808caed2b92dd7d8b8b7a613bbd403", // was e5ab8b16…
    "0c78c468e14fb7e58dec5cb314a01d7923f11cf193a8b5dffa84f13e2824868d", // was 307d8a93…
    "bdcb052ec1159da8c3b9191611aa1536e1ab5d62e4edccbcd10d57c109c80d9e", // was 16e13a56…
    "ef0c738f660374c51880210173452949e2bb8460ede8581874bbac713777dfc9", // was e73f0921…
    "d6ef5842eb487f770eaa6ebe1c85a8fb3f1061508edefcde9e10e3e2e7cce424", // was 15a354ce…
  ],
  "philosophus-2": [
    "923a513eb53f663165537b1317d2b3dac7758ff8f61517b0e6bb5e05c7d94347", // was 8e3f7f77…
    "3ab897f232fc6503a8ec84826e7e4b0aff9641e7be765d6627aec447777c4e77", // was dbafcdc3…
    "6722ef35ac5c72144aa21afc8f0c8285e0e0cca3435a4df1c3112dc062537300", // was 5c272731…
    "640d226fca0c14ddf20f9ebea7e19961d9e182d1abd9d3b36ee548d5707496c4", // was e4aa902b…
    "b652ba5ddd9c0f3efd0c2b569fe2a3bce93ac901e9fe2c3f551b5c26f3e5404b", // was d7cf4158…
  ],
  "philosophus-3": [
    "bc0fa5f400af04bbcb5a2ca2f494fbb8fdde68fc2d16af7b513385bd5209a21a", // was 9945d1a9…
    "bd795d7ab62642055c17b28754b62c4a7421b859cba93ebcce30c678f7bf62ae", // was 6ed2ef85…
    "4c42f124d3eef0e67d54cad2b8731bad5ced1e58bb33ead9d0ce76e5ededdb0e", // was 18eb1797…
    "4cdfa61ef8540086789eb0df777dd31e1d7d01b8e062712eb93e83663998bd75", // was 9b6e5765…
    "8cd2b3efd86de383edf2c874cb6e130701055334735232d085aff74b55c4ea72", // was 7b5ae1ca…
  ],
  "philosophus-4": [
    "247d679ac6c7230ad13742b487a39d2e4eb557c90422b12edc7c2c827f78f269", // was 89633f1b…
    "8e82bb4684041dcad856016179d0f4f5ff61ae0fb76653e4182f8d93fea44277", // was c434c2b6…
    "3b3cbf68c9f9733737c943a97fe9d4536f2f8cadb525cc56768f3570db58806e", // was e26e0378…
    "4059967e5d10dfbb8a0b3f2069ed3c76f8247ecce9da5e3a86951a29f08a200a", // was 787c6188…
    "b2da11ff62fa0557a5cdc9f39bab1f8ecadc96755d9db941d26ff9e08858dd01", // was 756a3148…
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
