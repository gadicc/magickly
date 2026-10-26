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

import { gdHallArt } from "@/app/gd/hall/art";
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
        '<cc:attributionURL rdf:resource="https://magick.ly/gd/hall/portal-1"/>' +
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
    "e7e19aee097561925a6b15c713c20ba74fe8b08f07818cdbfc035620e8ca9094",
    "04d28d410554326b2de394c39abb3881e87d63395eb353c3c493da051aae5ba4",
    "4cfeea04d9cb4042f396a93231048ba7aca140a53564838ef19e3d3263d423f5",
    "3ba794909294e5192fbf6b4c35437e48e266f9c2a7a07d880c1323bf18b814eb",
  ],
  "zelator-1": [
    "206c75ab2cb5305154978908f194525606a7b13263257ba018b6c13e057ef449",
    "1ca49c83f91d31a64ab14dc63d58d80cb3170bb711868e4f42ac86194ebf6f09",
    "010b6f60377fb6d20591a8a7da6944e8cc6135b0dc31366842a4573612de24f9",
    "b194e9dda511c2f5b233d4718ef9e55860baa3b766c3df3a03c29beec3fd30ec",
    "1a94a93450bef548e753bfa8d4ca4014968536786d3a1a2bb691e1710f9ac9c6",
  ],
  "zelator-2": [
    "e771cb8febaf7f97c5698e6c3ef9d01ef64af0529a1b598dd666d90438e25f08",
    "37b2b3b10b92fa90b6671cfec8a7d9aa574a969891f87cc8be8c359c7c7e3d70",
    "e0392326e42e62ad9623b4129f647e6f73fd28e6cf4f4e4452df60d39f1ed259",
    "f895e37b7541b533909a22d9e916be51475f508fc311528fc7810b90188da256",
    "2327c110c4d04fc3c7d364e87c9949fd6669b993b63fd0c3109c68cd52daaa97",
  ],
  "theoricus-1": [
    "31fca5f0262a34a041ca873a42b76c8ce101d6529279b12f8fcc7f3133ce9c18",
    "25506be0374de6b2fbcabf83ccf1556e1e5e400e899bd1bec0bbf6c14ca95e99",
    "47a38166a85996a343ebeecd07183a2c84e333c15bae89fcbfba5f64f264fc23",
    "a9457c1c83dc6bbdd31754df48422ce2dd1e22fbaebdc08cb14131764c8b4303",
    "44ed89d390d9966a716bb4835a974e28d91b1706e284e24985db963d9051c5a5",
  ],
  "theoricus-2": [
    "86366f1bea8cd60183ba1acf53e57ebdd33c19d5c050364389105cd6bcd90e48",
    "5f3fdc15582fb1af88b6e8210de3d019f00f7eb2674060eb1c4d354d0848d8c3",
    "6845b36d3dee6d3bc10398b308cd01971a08f512dfa8818f25910c304e5c1f61",
    "a67f0dec1b0244c021a3572bf4af41532f4b18eb5876ab45db473336132d72a3",
    "f9b0a0535b6e2c4cef12f2461087602b7389af55b886e91401c2f4f282a562d3",
  ],
  "practicus-1": [
    "e2c169f57f5dba61d9f4b98fd2a5671af164684d01951a698187771dab856e5a",
    "8b3937032562309c329573f3b5a9946ee81304f807cc9b7f7e45c807e8466097",
    "b8622d81fa7774d3b3fd274665c892bd666d6a15ecd7e60ca5162fd4f45dc392",
    "bd669bfdf27485962f2ae80fe9f9a1e73ababe573963d390abafad194340d17f",
    "8649e17cbddac6b629954ee564149862064c08e1c48c528ad087c8b92d6bbe04",
  ],
  "practicus-2": [
    "05bf1ede8ac9893121bd2b8345979b29ec0f578a1cfc5aaeb2fa9f0faee8d61d",
    "a6920640b7ffadc1b41fbf70df8274693026f45c39bb37e2c539c5f675362664",
    "16c2d27e3d82cbd61aee13d701a670846c5ff1f24dfbeaa49de291f5824f91be",
    "c07ea3c00781bec43e76ec283cf8cbb2340008571e06d15211515c40b49ed480",
    "2f18eb1acf70624671832165aceebac384197f8f8a0a17d7f409f5192f85359a",
  ],
  "practicus-3": [
    "7cfb50e340b85c62a256f6534fbaba0f7db60849c707d2f5bc4ff38d16b07ad2",
    "25fcb0f18fdea00d13d85ec57129f5de5011f0738b5f524c78bded04bd86290d",
    "2f326c69e2a21effd121abe84048c712e8a5ed268525f3b26f035682dc37d678",
    "940b7118b7e03f442d0f9802c656c4846fe3847db51a6ac18b553022046052e1",
    "d1be022de079279f8577c8acdaac2282750a6f45066c0e29f9db28e249dd8dca",
  ],
  "philosophus-1": [
    "ba7334ea6a0ec9422a0d77c0d436d7a9843eff3daba758d09bfdb99927d3e40e",
    "171b360fdd7c860986047648e6d02dc9c644c2a395cc95f2ec84dac318192b2e",
    "e69dca6921c01fda1049df979ee1c13fb919d26c2e58cacc630e83c9092bee4b",
    "cef50b0f81996f0cab8f5667da465bf08dc4d5003d98532e4011b1dd02e04634",
    "1a3d8a0d1526a57bc8a40b7e5b31dfbb09f3844ff2a2b78bb6523a150a84cd82",
  ],
  "philosophus-2": [
    "b4d9b6be08936cbbf75ca4699a4893bfecc13a5dea0ccf4ef89fbb0b57156ae6",
    "50fe61142a2c8777b014b737faabd2adaa310b54d1d7ba1d2a33a9ac4726b632",
    "6e808f5ae7bfbd6bc43878ba72094ae51dde59b4645ac52c8c5ce48b22b6176a",
    "7fffd9b4c71bf8e6afc73cedfeaed72060d9594f22f6a297f69531dd5e3ab2be",
    "61b098372d58d747fe577360b38fd095c80759e35470312ba90e96741ac3b0aa",
  ],
  "philosophus-3": [
    "83921fd796702d4199dd44244a1d9f4d04d79d4882818bbdf345dd4e40d7ab93",
    "9a51b74495d2167c8a27d8763bea6bd5c11bbb1ae3f434932e49ea015ded9057",
    "c87e82e5fd0655960b7c43db3c50072e103bee5017d735287f09c6ec576bd740",
    "e90845672467e01888950a22c0ce6efd520ad5c1121956933e2929135341b722",
    "e72e51b49869ade56e597620b484554cce79ec10d55f2f8ce263bc3af0cc1e86",
  ],
  "philosophus-4": [
    "9a02eae4ee5741e19d24b773fa619e7d8f9619a51c8386e71cd06ab6bedd6208",
    "0cdef2f500a4951e72e2416260bd358ca0e6e494402b323e0107c4ac12fb10b3",
    "8ab88f67f557ba769291c2e9bfe3fbb68a1dcda11b71ebba488a5d8c8d5131d9",
    "3ce83a09e7b118ac8022c52d3891ea6f9acdc34334277779fb7bfe55373e1ab8",
    "63996afce8160e7b1cc06d9bc1d668a6d34fbff8defeb6e00a80808e129057a6",
  ],
  "portal-1": [
    "1f9e824e1dcf33b4eae9915942dc8751f5fd4c4e96e7879529707cf5b7529a0c",
    "a6065e8e4d6a20779cc6f9fae59abf4a44db96b2700d0f6fb334c30d7cd3c8cb",
    "e324fb4cace917486831bb6eb84d84db3ce891f53a39f049b2818498317012e0",
    "4c80543eebe73d3afebee3d5dc171c6dc89d6d2f40002bef0c1f5fc1b948e670",
    "74a8e11f6bcf4052c82f0e1139c0f37df9ea64fa5a20b2597f4bfddbb943814a",
  ],
  "portal-2": [
    "e323b230625016f682ead1655d65512900a826d03c4081afc8cb8f7ad0212294",
    "6d941737d22d05c3d42bb1d7316a4937c3011b8bc95bcb787436cc79a3374b31",
    "03ad3edb447cf3b5224454c19bd76f1f2ee0d030e849ffb1434b35a5f2da9b80",
    "395d1de2b962abb278053112b2a0e67160a44eed313464cef3ca5534c5667749",
    "51b4d0d1e0d47bb0c31e7afe733ded2efeb55b0a553042233a5a9b15875994fe",
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
