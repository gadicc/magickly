import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ROSE_SIGIL_PROFILE,
  roseSigilLayout,
} from "magick-components/gd/roseSigilLayout";
import { TreeOfLifeSvg } from "magick-components/kabbalah/TreeOfLife";
import {
  KAMEA_SIGIL_PROFILE,
  kameaLayout,
} from "magick-components/sigil/kameaLayout";
import { sigilFigure } from "magick-components/sigil/SigilImage";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRitualSvgValidator } from "@/files/validateRitualSvg";
import { renderComponentImage } from "./componentImage";
import { componentImageResponse } from "./componentImageResponse";
import { COMPONENT_IMAGE_SLUGS, CONTRACTS } from "./contracts";
import { TABLET_IDS } from "./contracts/enochianTablet";
import { TABLET_PYRAMID_IMAGE_VERSIONS } from "./contracts/enochianTabletPyramids";
import type { KameaImagePlanet } from "./contracts/kamea";
import { contractViewBox } from "./contracts/types";
import { IMAGE_INPUTS_PROFILE } from "./dataInputs";
import {
  COMPONENT_IMAGE_PROFILE,
  TREE_IMAGE_PROFILE,
} from "./outlineTreeImage";
import {
  ANGEL_SIGIL_IMAGE_PROFILE,
  COMPONENT_IMAGE_REGISTRY,
  componentInputsHash,
  KAMEA_IMAGE_PROFILE,
  KAMEA_SIGIL_IMAGE_PROFILE,
  ROSE_SIGIL_IMAGE_PROFILE,
  SIGIL_PLACEMENT_HEADER,
  TABLET_PYRAMIDS_IMAGE_PROFILE,
} from "./registry";

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

  it("re-identifies the rose sigil, drawn by rule, and no other image", () => {
    // Every link's drawing changed when placement by rule replaced the
    // optimiser (plan 088), and the inputs hash cannot move (it reads no
    // table), so the profile must: an offline copy or catalog entry made
    // under the optimiser's drawing must not pass for the new one.
    expect(ROSE_SIGIL_IMAGE_PROFILE).toBe("magickli-rose-sigil-image-v3");
    expect(COMPONENT_IMAGE_REGISTRY["rose-sigil"].profile).toBe(
      ROSE_SIGIL_IMAGE_PROFILE,
    );
    expect(ROSE_SIGIL_IMAGE_PROFILE).not.toBe(COMPONENT_IMAGE_PROFILE);
    // The kameas publish under profiles of their own from the start
    // (plan 093, K3), so that their pins move with their drawings alone.
    expect(COMPONENT_IMAGE_REGISTRY.kamea.profile).toBe(KAMEA_IMAGE_PROFILE);
    expect(KAMEA_IMAGE_PROFILE).toBe("magickli-kamea-image-v2");
    expect(COMPONENT_IMAGE_REGISTRY["kamea-sigil"].profile).toBe(
      KAMEA_SIGIL_IMAGE_PROFILE,
    );
    expect(KAMEA_SIGIL_IMAGE_PROFILE).toBe("magickli-kamea-sigil-image-v3");
    // So do the angels' sigil styles (plan 096); the rose's files stay
    // rose-sigil's.
    expect(COMPONENT_IMAGE_REGISTRY["angel-sigil"].profile).toBe(
      ANGEL_SIGIL_IMAGE_PROFILE,
    );
    expect(ANGEL_SIGIL_IMAGE_PROFILE).toBe("magickli-angel-sigil-image-v2");
    // And the tablets drawn as pyramids (plan 095, decision 5), so that
    // the flat tablets' images keep theirs.
    expect(COMPONENT_IMAGE_REGISTRY["enochian-tablet-pyramids"].profile).toBe(
      TABLET_PYRAMIDS_IMAGE_PROFILE,
    );
    expect(TABLET_PYRAMIDS_IMAGE_PROFILE).toBe(
      "magickli-tablet-pyramids-image-v2",
    );
    // The other components still publish under the shared profile, so
    // their identities did not move with the sigil's.
    for (const slug of [
      "astro-geomancy-chart",
      "enochian-tablet",
      "seven-branched-candlestick",
      "table-of-shewbread",
    ] as const)
      expect(COMPONENT_IMAGE_REGISTRY[slug].profile).toBe(
        COMPONENT_IMAGE_PROFILE,
      );
  });

  // The other half of an image's identity: the data it draws (plan 032,
  // decision 10). These move when that data changes and the profiles above do
  // not, so a value here moving with no byte hash below moving means a field
  // was added to a spec that the component does not draw; the reverse means a
  // spec is missing something the component does.
  it.each([
    // 2591a504… until Netzach's and Hod's god names spelt Tzva'ot as the
    // hosts, צבאות, rather than צבעות (plan 036); only this hash moved.
    // 8d5f06b8… until the body parts, stones and scents became rows of their
    // own tables, read as `stones.*.name.en` and the like (plan 039): the
    // field names moved with the values, and no other hash did.
    // edab0be8… until the romanised article was capitalised and joined, as
    // Israel's official romanisation writes it (plan 039): Olam HaYesodot,
    // Chayot HaKodesh, Adonai HaAretz. The Tree can draw all three.
    // 2b895fc2… until the rule took in the other prefixes and Netzach's god
    // name lost its stray hyphen: YHVH Eloah VeDa'at, YHVH Tzvaot.
    // 30011c0c… until the paths' table was renamed treeOfLifePath (plan 052):
    // the table's name is part of the hashed text; no byte moved.
    // 8db079d7… until Hod's English became "Splendour" (plan 071, stage 5).
    [
      "tree-of-life",
      "5d5257e1e37cd3c84f09b8a3c29eebf033cc090f9d65cfb533173993352b4220",
    ],
    [
      "astro-geomancy-chart",
      "c89a608fb92e2f9b43ff58bdd53b7dc4259ab6a2530d861a8f78f7bb7bdee093",
    ],
    // 63b83840… until the Water and Fire Watchtowers joined the page and the
    // spec read each tablet's kind and marks too (plan 061, stage G); the
    // Earth and Air images' bytes did not move. 3340879b… until each
    // tablet held every source's reading and the spec hashed them all
    // (plan 061, "Tablet versions") and the version rules with their
    // revision; Earth and Air moved to the Golden Dawn's letters with it,
    // below. 1212086a… until the Tablet of Union joined the images (plan
    // 090, stage 4) and the spec hashed its row with the Watchtowers';
    // no Watchtower's bytes moved.
    [
      "enochian-tablet",
      "d7fd15d88d703ff532767e52ad8af72eefd7b1e92f71fccd4de65f21bdc8560f",
    ],
    // The flat tablet's letters and version rules, the zodiac the
    // pyramids' rules find a Great Cross square's sign and decans in, what
    // their other lookups need to draw at all (the Kerubs' signs and the
    // Sephiroth's numbers among them), and the symbols the `symbols` key
    // draws, hashed ahead of it (plan 095, stage 5), so that the key moved
    // nothing here.
    [
      "enochian-tablet-pyramids",
      "bef0caccd45b670e5d44856f53f80e81f4c785a5508cd27653cdf119fccc61ee",
    ],
    // a8a08155… until the candlestick drew the Equinox's figure of 1909
    // too (plan 080, "The rose's and the candlestick's versions"): the
    // spec reads the sephirot's archangels, and the planets in that
    // figure's order.
    [
      "seven-branched-candlestick",
      "b65a8939e9be64412a8c81f2db02b061b44a5cb72b9432a2236d35676b2e2fe4",
    ],
    // Moved once, by Manasseh's Hebrew name (plan 032's data fixes); the five
    // above did not, which is what decision 10 is for.
    // dfd57ffb… until the spec read the tribes through the signs' links, so
    // the two tribes no sign names — Levi and Joseph — stopped being hashed
    // (plan 052); no byte moved. 02b94228… until Cancer and Sagittarius
    // stopped repeating Leo's and Capricorn's permutations of the Name
    // (magick-data 0.2.1); 440ffebf… until the four archangels' Hebrew
    // names joined the inputs, drawn in place of their ids.
    [
      "table-of-shewbread",
      "85330d0f560be4f69c465b6244bf0e6576675eec2fc6aff9c6c5c7c396e2fb8b",
    ],
    // No table at all, so no data edit can ever move this one.
    [
      "rose-sigil",
      "f88d8766945579ec0fffa38d7271d4f59717f79dac05c9ae57cc7ab1c9dabc28",
    ],
    // The seven squares' numbers and the planets' English names (plan
    // 093, K3); the bare square and the sigil on it read the same.
    [
      "kamea",
      "533226af5c9cd2bb14ee91c389ae94607fb64febdf120c8c779691415f659f5d",
    ],
    [
      "kamea-sigil",
      "533226af5c9cd2bb14ee91c389ae94607fb64febdf120c8c779691415f659f5d",
    ],
    // The 72 genii's Hebrew and roman names and psalms, and #70's Genesis
    // 1:1 from the Vulgate (plan 096, Y3).
    [
      "angel-sigil",
      "25d38e34e607cd2be8980d1f20fa9363da42358a3d99e7a76af8820ea8404b9a",
    ],
  ] as const)("pins the data %s draws", (slug, sha256) => {
    expect(componentInputsHash(slug)).toBe(sha256);
  });

  it("draws the Tree without hooks, which a route handler cannot run", () => {
    // /og's and /api/render's renderToStaticMarkup runs under the server
    // build of React, where useId has no dispatcher; the build failed on
    // it. Called as a plain function, a hook would throw here too.
    const props = CONTRACTS["tree-of-life"].parse(new URLSearchParams());
    const element = COMPONENT_IMAGE_REGISTRY["tree-of-life"].render(
      props,
    ) as ReactElement<Record<string, unknown>>;
    expect(element.type).toBe(TreeOfLifeSvg);
    expect(element.props.id).toBe("TreeOfLife");
    const drawn = (element.type as (p: object) => ReactElement)(element.props);
    expect(drawn.type).toBe("svg");
  });

  it("reproduces the published ritual Tree of Life bytes under the unchanged profile", async () => {
    const source = await readFile("src/doc/2=9.pug", "utf8");
    const reference = source.match(/\/api\/treeOfLife\?([^"'\s)]+)/)?.[1];
    expect(reference).toBeDefined();
    const image = await render("tree-of-life", reference);
    expect(image.identity.profile).toBe(TREE_IMAGE_PROFILE);
    expect(image.identity.fonts).toHaveLength(5);
    expect(image.identity.inputs).toEqual({
      spec: IMAGE_INPUTS_PROFILE,
      sha256: componentInputsHash("tree-of-life"),
    });
    // Profile v4 since a sphere's label lines were set closer and a list broke
    // per item (plan 039); this query's labels are single words, so its
    // bytes did not move. Profile v3: v1 was 142,962 bytes (plans/009), v2
    // 151,079 once Keter, Chochmah and Malchut gained their archangels, and
    // v3 is shorter again because the path data is rounded to three decimals
    // (plans/030). It
    // was 150,736 bytes, 96516a75…, until the ritual's god names spelt
    // Tzva'ot צבאות (plan 036): a data fix, which moves the inputs hash and
    // the bytes together under the same profile. v4 was 150,785 bytes,
    // a1fe82b8…. v5 (24 November 2026): outlined coordinates rounded to
    // OUTLINE_PRECISION, the drawing unchanged, 124,411 bytes.
    expect(image.byteSize).toBe(124_411);
    expect(image.sha256).toBe(
      "3410d1acdb7ff9af525a162c6268430448739a5d24fc7a07d1202d6dc832f9b3",
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
    ["enochian-tablet", "id=fire&version=dee", 840, 1188, 300],
    // The Union's own page, 124 × 104 at 4 pixels a unit (plan 090,
    // stage 4): its 20 letters and their squares.
    ["enochian-tablet", "id=union", 496, 416, 40],
    ["enochian-tablet", "id=union&version=equinox&font=enochian", 496, 416, 40],
    ["enochian-tablet", "id=union&width=248", 248, 208, 40],
    // As pyramids (plan 095, stage 5), on the same pages at the same
    // sizes: four sides a square, then the letters and the sigil.
    ["enochian-tablet-pyramids", "", 840, 1188, 1000],
    ["enochian-tablet-pyramids", "id=air", 840, 1188, 1000],
    ["enochian-tablet-pyramids", "id=water", 840, 1188, 1000],
    ["enochian-tablet-pyramids", "id=fire", 840, 1188, 1000],
    ["enochian-tablet-pyramids", "id=union", 496, 416, 100],
    ["enochian-tablet-pyramids", "id=fire&version=equinox", 840, 1188, 1000],
    [
      "enochian-tablet-pyramids",
      "id=air&version=regardie&font=enochian&height=594",
      420,
      594,
      1000,
    ],
    // With their symbols (plan 095, "Symbols on the sides"): a mark a
    // side, a glyph, a figure's dots or an element's strokes, besides.
    ["enochian-tablet-pyramids", "id=fire&symbols=outward", 840, 1188, 1600],
    ["enochian-tablet-pyramids", "id=union&symbols=upright", 496, 416, 160],
    ["seven-branched-candlestick", "", 1024, 1024, 60],
    ["seven-branched-candlestick", "version=modern", 1024, 1024, 60],
    ["table-of-shewbread", "", 1024, 1024, 130],
    ["rose-sigil", "text=גדי", 1024, 1024, 26],
    ["rose-sigil", "text=שלום&rose=false&width=200", 200, 200, 1],
    // Words side by side (plan 088, R2): 1,024 pixels a word, then scaled
    // to the route's 4,096 a side.
    ["rose-sigil", "text=יהוה אלהים", 2048, 1024, 52],
    ["rose-sigil", "text=יוד הא ואו הא&rose=false", 4096, 1024, 1],
    ["rose-sigil", `text=${"א ".repeat(8).trim()}&rose=false`, 4096, 512, 1],
    // The squares: the frame and rules, then a path a number glyph.
    ["kamea", "planet=saturn", 1024, 1024, 10],
    ["kamea", "planet=luna&width=256", 256, 256, 82],
    // A word on its square, then two, side by side (plan 093, decision 10).
    ["kamea-sigil", "planet=saturn&text=אגיאל", 1024, 1024, 12],
    ["kamea-sigil", "planet=venus&text=בני שרפים", 2048, 1024, 100],
    // In rows (a long name's card): two words stacked, and five two a row.
    ["kamea-sigil", "planet=venus&text=בני שרפים&columns=1", 1024, 2048, 100],
    [
      "kamea-sigil",
      "planet=luna&text=מלכא בתרשיתים עד ברוח שחקים&columns=2",
      // 2,048 by 3,072, scaled into the route's 4,194,304 pixels.
      1672,
      2508,
      400,
    ],
    // 32 one-letter words: one square in the <defs>, 32 uses (`reuse`).
    [
      "kamea-sigil",
      `planet=luna&text=${Array(32).fill("ת").join(" ")}`,
      4096,
      128,
      2000,
    ],
    ["rose-sigil", `text=${Array(16).fill("אב").join(" ")}`, 4096, 256, 100],
    // The angels' styles (plan 096): the band's rings, name and sigil; the
    // bare sigil and its name; a talisman's verse a path a letter.
    ["angel-sigil", "angel=vehuiah", 1024, 1024, 15],
    ["angel-sigil", "angel=nith-haiah&style=bare&width=300", 300, 300, 11],
    ["angel-sigil", "angel=jabamiah&style=talisman", 1024, 1024, 40],
  ] as const)(
    "renders %s?%s as validated outlined SVG and a %dx%d PNG",
    async (slug, query, width, height, minimumPaths) => {
      const svg = await render(slug, query);
      expect(svg.contentType).toBe("image/svg+xml");
      expect(svg.identity.profile).toBe(COMPONENT_IMAGE_REGISTRY[slug].profile);
      // The query is the third part of the identity, not part of the inputs.
      expect(svg.identity.inputs).toEqual({
        spec: IMAGE_INPUTS_PROFILE,
        sha256: componentInputsHash(slug),
      });
      const text = svg.bytes.toString();
      // The only links an image holds are its shared groups' (`reuse`),
      // each to a group in its own <defs>.
      const { reuse } = COMPONENT_IMAGE_REGISTRY[slug] as {
        reuse?: { idPrefix: string };
      };
      const links = [...text.matchAll(/<use xlink:href="#([^"]+)"/g)];
      for (const [, id] of links) {
        expect(reuse && id.startsWith(reuse.idPrefix), id).toBe(true);
        expect(text.split(`<g id="${id}">`).length, id).toBe(2);
        expect(
          text.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? "",
          `${id} is shared from the <defs>`,
        ).toContain(`<g id="${id}">`);
      }
      expect(text.replace(/<use xlink:href="#[^"]+"/g, "<use")).not.toMatch(
        /<text|<style|href=|font-family|<image/,
      );
      // Paths as drawn: a shared group's once for each <use> of it.
      const paths = (markup: string) => (markup.match(/<path/g) ?? []).length;
      // Outlined ids are stripped, so a `<g id=` in the <defs> starts a
      // shared group, and runs to the next one or the end of the <defs>.
      const defs = text.match(/<defs>([\s\S]*?)<\/defs>/)?.[1] ?? "";
      const shared = new Map(
        defs.split(/(?=<g id=")/).flatMap((part) => {
          const id = part.match(/^<g id="([^"]+)"/)?.[1];
          return id ? [[id, paths(part)] as const] : [];
        }),
      );
      const drawn =
        paths(text) -
        [...shared.values()].reduce((sum, n) => sum + n, 0) +
        links.reduce((sum, [, id]) => sum + (shared.get(id) ?? 0), 0);
      expect(drawn).toBeGreaterThanOrEqual(minimumPaths);
      expect(text).toContain(
        `viewBox="${contractViewBox(CONTRACTS[slug] as never, svg.request.props).join(" ")}"`,
      );
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
    for (const [slug, query] of [
      ["kamea", "planet=saturn"],
      ["kamea-sigil", "planet=saturn&text=א"],
    ])
      expect(await files(slug, query)).toEqual([
        ...base,
        "NotoSerif-Italic-latin1.ttf",
      ]);
    expect(await files("angel-sigil", "angel=vehuiah")).toEqual([
      ...base,
      "NotoSerif-Regular-latin1.ttf",
      "FrankRuhlLibre-Bold-letters.ttf",
    ]);
    expect(await files("enochian-tablet")).toEqual([
      ...base,
      "EnochianPlain.ttf",
    ]);
    // The symbols' Hebrew letters too, with or without symbols: the
    // fonts are the slug's.
    for (const query of ["", "symbols=outward"])
      expect(await files("enochian-tablet-pyramids", query)).toEqual([
        ...base,
        "EnochianPlain.ttf",
        "FrankRuhlLibre-Bold-letters.ttf",
      ]);
    expect(await files("table-of-shewbread")).toEqual([
      ...base,
      "NotoEmoji-Variable.ttf",
    ]);
  });

  // resvg falls back to the default family with only a log line when a font
  // is missing, and path counts do not change under that fallback. These
  // pins were taken after visual review of the rasterised output; a font or
  // engine change needs a new review before they move. Every pin moved, and
  // no drawing, when outlined coordinates were rounded to OUTLINE_PRECISION
  // (24 November 2026, COMPONENT_IMAGE_PROFILE v2 and the Tree's v5); each
  // line gives its value before.
  it.each([
    // 124,838 bytes, 5ed3a569…, and 223,771, 53514ca8…, until Air drew
    // the Golden Dawn's letters, with its O and A reversed (plan 061,
    // "Tablet versions"); then 127,724, 28267bac…, and 223,063, 1a637907…,
    // until its sigil was redrawn after the Equinox's Plate X in place of
    // two fonts' glyphs (plan 080, "The sigils' sources"); then 124,760,
    // 6bdff3d1…, and 220,099, 914fe5eb…, until its four Yods were refined
    // to the plate's slim lozenges (the same section); then 124,856,
    // 8313d75c…, and 220,195, e9c0aebe…, until the lozenges became the
    // plate's sinuous flames; then 124,884, 8952f44a…, and 220,223,
    // cf25c90c…, until the flames' left sides and lower ends were brought
    // closer to the plate. Reviewed again as rasterised.
    [
      "enochian-tablet",
      "id=air",
      119_538, // was 124_796, dcced8d1…
      "fbe055347de41ebccc97c4aecabdc8e679c47e5a74884bddac06426ce29688b7",
    ],
    [
      "enochian-tablet",
      "id=air&font=enochian",
      186_287, // was 220_135, 48c4507e…
      "6c3d5837511ed4a9b6bf0e5c59cc3c688f1859579ecbb034b6bd1016b42a47f4",
    ],
    // One tablet in each other version, reviewed as rasterised (plan 061,
    // "Tablet versions"): Regardie's sigil, the Equinox's in black, and
    // for Dee's and Raphael's tables the note where the sigil would be.
    // The Tablet of Union's own page (plan 090, stage 4), reviewed as
    // rasterised: its four lines in their elements' colours.
    [
      "enochian-tablet",
      "id=union",
      10_778, // was 11_406, 885d2e09…
      "3fb6dbcd6b09c1c90851dcbfa59ba99602c59fc9bc4e5ab6afe0291bdcfcab87",
    ],
    [
      "enochian-tablet",
      "id=fire&version=regardie",
      123_974, // was 129_479, 41657fe6…
      "99dd01e164eee1d5d6e34c1fb985593700935fd709e498ada370c3f73f2a1443",
    ],
    [
      "enochian-tablet",
      "id=fire&version=equinox",
      124_005, // was 129_492, 36552c46…
      "8d3afa6bb27c0afa073b446f8871547238729b7e830031d501aefae85a80fdd4",
    ],
    [
      "enochian-tablet",
      "id=fire&version=dee",
      176_844, // was 196_786, 54f3e8a9…
      "70b84a492a1c967a137895eb55169871cec6de7a37d04a9e474b1f0216e62e21",
    ],
    [
      "enochian-tablet",
      "id=fire&version=raphael",
      181_528, // was 201_612, 7996e027…
      "d67b8963e0bdc8f9f7a13494e3f6c66acdbebc8fc50de201ef179b5e6493f303",
    ],
    // 136,294 bytes and df3c3791… until Manasseh's Hebrew name stopped being
    // Benjamin's; the Gemini branch is one glyph shorter and one wider.
    // 136,643 bytes and 34e0fce1… until Cancer's and Sagittarius'
    // permutations of the Name were corrected (magick-data 0.2.1), those
    // two labels alone; 136,683 bytes and c6555c78… until the archangels
    // were named in Hebrew rather than by their lower-case ids.
    [
      "table-of-shewbread",
      "",
      94_793, // was 126_699, 5226c936…
      "86bee00e2e55b5d9decb3ef75f0b12de570408b35bf1cd1f2f62d888f7a58009",
    ],
    // The Equinox's figure of 1909, the default since 14 November 2026
    // (plan 080, "The rose's and the candlestick's versions"), reviewed
    // as rasterised. The modern drawing, the default before, keeps its
    // bytes under `version=modern`.
    [
      "seven-branched-candlestick",
      "",
      68_598, // was 87_746, f20b1474…
      "f0ad70f031eff7e50961236e0659a66273333233d221cc67a1def2a026db2cc3",
    ],
    [
      "seven-branched-candlestick",
      "version=modern",
      39_934, // was 52_363, 5d8b637f…
      "4642bb2940c4f12fe4ca7c43d5e8709aaa535710001383b87d03963139e1b2e2",
    ],
    [
      "astro-geomancy-chart",
      "",
      45_104, // was 52_476, eb2f1b6f…
      "5e2246a8a50a25d530b0b89711edc9b0a9c360e0c4fa6b7c0355659b667b1f58",
    ],
    // Pinned before the outliner learned to keep the halls' paint servers
    // (plan 062), so all six slugs prove that change left them alone.
    [
      "tree-of-life",
      "",
      38_117, // was 44_251, a6f69235…
      "c95c465ded71a527d18fefdc744412f64d43e133ee874e8c158b775a656eb071",
    ],
  ] as const)(
    "pins the reviewed bytes of %s?%s so a silent font fallback fails",
    async (slug, query, byteSize, sha256) => {
      const image = await render(slug, query);
      expect(image.byteSize).toBe(byteSize);
      expect(image.sha256).toBe(sha256);
    },
  );

  // The rose sigil's reviewed bytes, by the image profile they were
  // reviewed under. Its identity reads no table, so the profile is all
  // that tells an image drawn by one engine from another's: bytes that
  // change must come with a new profile and a new set here. A profile's
  // set never changes once the profile has shipped.
  const ROSE_SIGIL_PINS: Record<
    string,
    readonly (readonly [query: string, byteSize: number, sha256: string])[]
  > = {
    "magickli-rose-sigil-image-v1": [
      // Placed by rule (plan 088), each word its own sigil, every mark
      // clear of other ink, each word's bar its own path. Reviewed as
      // rasterised.
      [
        "text=גדי",
        12_640,
        "1d88b4f13ccfdecc093c69df7cc6bca8fa116220f44888f14a17eded3997d051",
      ],
      [
        "text=שלום&rose=false",
        565,
        "ea40b3f05b58d8ebc825d38cbe85bffd37269807bcecf2f2a0b3c3d1f6056f58",
      ],
      // Shabbathai on Regardie's rose of 1939, through Tau where Kaph is
      // on the default rose (plan 080, "The rose's and the candlestick's
      // versions").
      [
        "text=שבתאי&version=regardie1939",
        12_795,
        "ab82d970a69cb2ce9ae79a86bb74740e604fe105b1e06d8a3eff30bfb055d5c2",
      ],
      // Two words, two sigils, right to left (R2).
      [
        "text=יהוה אלהים",
        26_089,
        "5fa3648ec5ce8299b372cecd626e7bdab9e0ab155a5bf7b1dd6ee5e2f765979d",
      ],
    ],
    "magickli-rose-sigil-image-v2": [
      // v1's bytes for each of v1's texts: two words have one rose to
      // share, which `reuse` leaves; it shares the rose from the second
      // word on, the first standing ungrouped on its own coordinates.
      [
        "text=גדי",
        12_640,
        "1d88b4f13ccfdecc093c69df7cc6bca8fa116220f44888f14a17eded3997d051",
      ],
      [
        "text=שלום&rose=false",
        565,
        "ea40b3f05b58d8ebc825d38cbe85bffd37269807bcecf2f2a0b3c3d1f6056f58",
      ],
      // Shabbathai on Regardie's rose of 1939, through Tau where Kaph is
      // on the default rose (plan 080, "The rose's and the candlestick's
      // versions").
      [
        "text=שבתאי&version=regardie1939",
        12_795,
        "ab82d970a69cb2ce9ae79a86bb74740e604fe105b1e06d8a3eff30bfb055d5c2",
      ],
      // Two words, two sigils, right to left (R2).
      [
        "text=יהוה אלהים",
        26_089,
        "5fa3648ec5ce8299b372cecd626e7bdab9e0ab155a5bf7b1dd6ee5e2f765979d",
      ],
      // Sixteen words: the rose under words 2 to 16 drawn once.
      [
        `text=${Array(16).fill("אב").join(" ")}`,
        36_595,
        "d4cd9209cdb8aabe7e8cea778e4db2ebe2ff78dcb493daa21ed789e3130af2ea",
      ],
    ],
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-rose-sigil-image-v3": [
      [
        "text=גדי",
        10_957,
        "11243a68995852af22ab42f14e6976c7bd3fcfdd2dc9511ac6c12eb118e276dd",
      ],
      [
        "text=שלום&rose=false",
        495,
        "c72c36fb8e366016fa7fe4c168c984219bcb3a1bafa4385f75cc3a679d348df5",
      ],
      [
        "text=שבתאי&version=regardie1939",
        11_124,
        "d6901d0a30f41296d13bd73ee2e62bc3d673a4b99d707c4707a9b07cb58216a1",
      ],
      [
        "text=יהוה אלהים",
        22_569,
        "c12c94969affb8e78d5c9e8384016683f2fc51386344faebc7b4e2a856105525",
      ],
      [
        `text=${Array(16).fill("אב").join(" ")}`,
        29_657,
        "c36bbbf3953d097d04b970e3116bfc3f56c8d54cffd7714e5f99e62a733181fe",
      ],
    ],
  };

  it("pins the rose sigil's reviewed bytes under its image profile", async () => {
    const pins = ROSE_SIGIL_PINS[ROSE_SIGIL_IMAGE_PROFILE];
    expect(
      pins,
      `no reviewed bytes for ${ROSE_SIGIL_IMAGE_PROFILE}: add its set to ROSE_SIGIL_PINS`,
    ).toBeDefined();
    for (const [query, byteSize, sha256] of pins) {
      const image = await render("rose-sigil", query);
      expect(
        [image.byteSize, image.sha256],
        `rose-sigil?${query} draws other bytes than ${ROSE_SIGIL_IMAGE_PROFILE} was reviewed with. ` +
          "If the drawing changed on purpose, bump ROSE_SIGIL_IMAGE_PROFILE in registry.tsx " +
          "and pin the reviewed bytes under the new profile; never re-pin a shipped profile.",
      ).toEqual([byteSize, sha256]);
    }
  });

  // A digest of the drawing itself, by the same profile: the path data
  // of the 72 names (as reviewed) and a fixed list of texts that use every mark and
  // placement rule, on both roses. A change to the engine that moves any
  // of them, even one the four pinned images above do not show, must come
  // with a new profile. The list is written out here, not taken from the
  // oracle's templates, so adding a template never moves the digest.
  // The 72 names as they stood when v1's drawings were reviewed (magick-data
  // at 28a7f9f1), written out so that a correction to the data (#69 became
  // ראהאל on 18 November) does not move the digest: an image is keyed by
  // its own text, so only a change to the drawing should.
  const ROSE_SIGIL_DIGEST_NAMES = [
    "והויה",
    "יליאל",
    "סיטאל",
    "עלמיה",
    "מהשיה",
    "ללהאל",
    "אכאיה",
    "כהתאל",
    "הזיאל",
    "אלדיה",
    "לאויה",
    "ההעיה",
    "יזלאל",
    "מבהאל",
    "הריאל",
    "הקמיה",
    "לאויה",
    "כליאל",
    "לוויה",
    "פהליה",
    "נלכאל",
    "יייאל",
    "מלהאל",
    "ההויה",
    "נתהיה",
    "האאיה",
    "ירתאל",
    "שאהיה",
    "רייאל",
    "ומאאל",
    "לכבאל",
    "ושריה",
    "יהויה",
    "לההיה",
    "כוקיה",
    "מנדאל",
    "אניאל",
    "העמיה",
    "רהעאל",
    "ייזאל",
    "הההאל",
    "מיכאל",
    "ווליה",
    "ילהיה",
    "סאליה",
    "עריאל",
    "עשליה",
    "מיהאל",
    "והואל",
    "דניאל",
    "ההשיה",
    "עממיה",
    "ננאאל",
    "ניתאל",
    "מבהיה",
    "פויאל",
    "נממיה",
    "יילאל",
    "הרהאל",
    "מצראל",
    "ומבאל",
    "יההאל",
    "ענואל",
    "מהיאל",
    "דמביה",
    "מנקאה",
    "איעאל",
    "חבויה",
    "ראחאל",
    "יבמיה",
    "הייאל",
    "מומיה",
  ];
  const ROSE_SIGIL_DIGEST_TEXTS = [
    "מטטרון", // a crook and a noose (Regardie, p. 58)
    "יהוה אלהים", // two words; a revisit beside its first visit
    "יוד הא ואו הא", // four words; one-stroke words; a return to the start
    "אגיאל", // a later recurrence
    "זאזל", // a wedge under the start circle
    "הההאל", // a run of three: two crooks
    "האאיה", // a doubled letter on a straight pass
    "במכק", // two nooses in a row
    "ההאדלה", // a return past a noose run
    "אבהאל", // a start letter passed again with a noose
    "אהא", // a word ending beside its start
    "מממדתב", // a crooked start the last stroke passes
    "פלפלפ", // A-B-A-B-A
    "עעע", // a lone crooked letter on the outer ring
    "א", // one letter
  ];
  const ROSE_SIGIL_DRAWING_DIGESTS: Record<string, string> = {
    "magickli-rose-sigil-image-v1":
      "3bb33e8655f61909a89ea3f9afad456c68a7f12a8553ceeda0a475ffc077a1ef",
    // v2 shares a repeated rose through <use>; the figures are v1's.
    "magickli-rose-sigil-image-v2":
      "3bb33e8655f61909a89ea3f9afad456c68a7f12a8553ceeda0a475ffc077a1ef",
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-rose-sigil-image-v3":
      "3bb33e8655f61909a89ea3f9afad456c68a7f12a8553ceeda0a475ffc077a1ef",
  };

  it("pins a digest of the rose sigil's drawings under its image profile", () => {
    const texts = [
      ...new Set([...ROSE_SIGIL_DIGEST_NAMES, ...ROSE_SIGIL_DIGEST_TEXTS]),
    ];
    const drawings = (["gd", "regardie1939"] as const).flatMap((version) =>
      texts.map(
        (text) =>
          `${version} ${text}\n${sigilFigure(text, roseSigilLayout(version), ROSE_SIGIL_PROFILE).paths.join("\n")}`,
      ),
    );
    expect(
      createHash("sha256").update(drawings.join("\n\n")).digest("hex"),
      `the rose sigil's drawings differ from those ${ROSE_SIGIL_IMAGE_PROFILE} was reviewed with. ` +
        "If the drawing changed on purpose, bump ROSE_SIGIL_IMAGE_PROFILE in registry.tsx " +
        "and record the new digest under the new profile; never re-pin a shipped profile.",
    ).toBe(ROSE_SIGIL_DRAWING_DIGESTS[ROSE_SIGIL_IMAGE_PROFILE]);
  });

  // The kameas' reviewed bytes, by the image profile they were reviewed
  // under, as the rose sigil's above: bytes that change come with a new
  // profile and a new set, and a shipped profile's set never changes. The
  // squares' numbers are inputs too, so a construction that moved a
  // number moves the inputs pin above as well.
  const KAMEA_PINS: Record<
    string,
    readonly (readonly [query: string, byteSize: number, sha256: string])[]
  > = {
    "magickli-kamea-image-v1": [
      // Saturn's three by three and the Moon's nine by nine, in Noto
      // Serif italic, as the halls draw them. Reviewed as rasterised.
      [
        "planet=saturn",
        12_346,
        "d3caa7dd9d9f2b4d55ba2d9891f69ddb2c5c4b40dad21b72489d1be68ffe2540",
      ],
      [
        "planet=luna",
        186_103,
        "e9c15fd6e676df65a569e12ea1a2d5ef1d0b0adb4752254bdbc7a6efcb04d2d9",
      ],
    ],
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-kamea-image-v2": [
      [
        "planet=saturn",
        9_578,
        "6f30a6c41f99ece3346dd34731dc440e8e5bfba8fb97dd9084089d0945a5f91d",
      ],
      [
        "planet=luna",
        145_019,
        "b996f7c482f6b15dc50c66a752b563e9e3e6089d661d3f0c9d48113e7443cf74",
      ],
    ],
  };
  const KAMEA_SIGIL_PINS: Record<
    string,
    readonly (readonly [query: string, byteSize: number, sha256: string])[]
  > = {
    "magickli-kamea-sigil-image-v1": [
      // Agiel on Saturn's square, the crook where Yod and Aleph both
      // fall on 1; the Bne Seraphim on Venus', two words; Elim on the
      // Moon's with finals (final Mem 600, so 60). Reviewed as rasterised.
      [
        "planet=saturn&text=אגיאל",
        13_378,
        "ea4fe040183d2d440ce1507cbf630f14228200747b024049e6bc7b8285c4b008",
      ],
      [
        "planet=venus&text=בני שרפים",
        235_171,
        "2fa68a8dd61a1fba373d80c025335696c1e2aa5beb08fc2b037152a38f9248a2",
      ],
      [
        "planet=luna&text=אלים&finals=true",
        188_096,
        "19d5943430e46ac4505173c71826c87771b1c54a4c29c722ddb8314a8af56e50",
      ],
    ],
    "magickli-kamea-sigil-image-v2": [
      // The square drawn once however many words stand on it (`reuse`):
      // one word's bytes are v1's, two words' about half, and 32
      // one-letter words on the Moon's, 6 MB as v1, about 0.2 MB.
      [
        "planet=saturn&text=אגיאל",
        13_378,
        "ea4fe040183d2d440ce1507cbf630f14228200747b024049e6bc7b8285c4b008",
      ],
      [
        "planet=venus&text=בני שרפים",
        118_423,
        "49c0ae6a2c55f01ed1b710259cf973ea4eeeb134ace168074af0e4cbb5f39283",
      ],
      [
        "planet=luna&text=אלים&finals=true",
        188_096,
        "19d5943430e46ac4505173c71826c87771b1c54a4c29c722ddb8314a8af56e50",
      ],
      [
        `planet=luna&text=${Array(32).fill("ת").join(" ")}`,
        203_668,
        "a525608e860e7d7111a632be04da670caf68548fbbbd5583621dd1e96bb7a97b",
      ],
    ],
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-kamea-sigil-image-v3": [
      [
        "planet=saturn&text=אגיאל",
        10_439,
        "6350e64ef0f71fd8999baf6b8282668916295c12fea7c9b3e02ff8daac81e2de",
      ],
      [
        "planet=venus&text=בני שרפים",
        87_475,
        "ccc6c844ed625a7b0eba5bec04ba9615c6d0817130901c5e3f53f2d7df74ff79",
      ],
      [
        "planet=luna&text=אלים&finals=true",
        146_820,
        "60332abcf5907d8475f87ad51840dc6464b1173ff03cac4a519b0bdd3233205c",
      ],
      [
        `planet=luna&text=${Array(32).fill("ת").join(" ")}`,
        142_635,
        "b9612c7c1f0e0b67d350b93a27d71ea1ae29cdb7227df98f5c93c16725d6faaa",
      ],
    ],
  };

  it.each([
    ["kamea", KAMEA_IMAGE_PROFILE, KAMEA_PINS],
    ["kamea-sigil", KAMEA_SIGIL_IMAGE_PROFILE, KAMEA_SIGIL_PINS],
  ] as const)(
    "pins %s's reviewed bytes under its image profile",
    async (slug, profile, sets) => {
      const pins = sets[profile];
      expect(
        pins,
        `no reviewed bytes for ${profile}: add its set`,
      ).toBeDefined();
      for (const [query, byteSize, sha256] of pins) {
        const image = await render(slug, query);
        expect(
          [image.byteSize, image.sha256],
          `${slug}?${query} draws other bytes than ${profile} was reviewed with. ` +
            "If the drawing changed on purpose, bump the profile in registry.tsx " +
            "and pin the reviewed bytes under the new profile; never re-pin a shipped profile.",
        ).toEqual([byteSize, sha256]);
      }
    },
  );

  // The tablets drawn as pyramids, by the profile they were reviewed
  // under, as the kameas' above: a Watchtower, the Union, and the glyphs.
  const TABLET_PYRAMIDS_PINS: Record<
    string,
    readonly (readonly [query: string, byteSize: number, sha256: string])[]
  > = {
    "magickli-tablet-pyramids-image-v1": [
      // Reviewed as rasterised, 24 November 2026: every square's four
      // sides in their elements' colours round a white top, half the
      // square, with its letter, under the flat tablet's sigil.
      [
        "id=air",
        255_309,
        "2e16e71be6e7a6b756f4a97782c2cffb2fbd3630e78eccad3f94ed996531a339",
      ],
      [
        "id=air&font=enochian",
        352_394,
        "0013c6734190eaa3225a76e5803044e801fffb579caa95fc575db8697274a093",
      ],
      [
        "id=union",
        25_886,
        "feff338f82551dc0380427fa7581f0a6f7b185053d6a76986d7d886654869830",
      ],
      // With their symbols (plan 095, "Symbols on the sides"), reviewed as
      // rasterised, 24 November 2026: each side's sign, planet, number,
      // Hebrew letter, figure or element facing out from a top a third of
      // the square, the Hebrew in Frank Ruhl Libre and the signs and
      // planets in Noto Sans Symbols and Symbols 2, U+FE0E drawing nothing.
      [
        "id=fire&symbols=outward",
        1_135_168,
        "6d41a1431e03a21e91d9b63779a97083f2e06efdb69d30b3d3e5f4c1d10130da",
      ],
      [
        "id=union&symbols=upright",
        159_476,
        "e4b5851954848e9a561de0029ddf1bf3a4198508dd7ab8dad1fb393baa2c4607",
      ],
    ],
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-tablet-pyramids-image-v2": [
      [
        "id=air",
        246_374,
        "5b75566aacb3fa661bb29af36cf1545129a4c5930c257b815ddde048fe3fe6cb",
      ],
      [
        "id=air&font=enochian",
        312_844,
        "47583452b3e0423792759cb85af937248e64ebcc1e459fe27dde2a24ac8a07a4",
      ],
      [
        "id=union",
        25_210,
        "1b045b10630a83fd356fcc656a9a6dd5b908cd7c5a5f52e1c041b7a1d3957004",
      ],
      [
        "id=fire&symbols=outward",
        1_020_768,
        "cb6c9c650a806b0bd81565159f22adefc4660c9ba11cfbe4b2fb15ce163037f6",
      ],
      [
        "id=union&symbols=upright",
        155_690,
        "158c10abcc067c78bb98a96618c4359dee9953336ab0a3c5fa32dd9a9b025e2d",
      ],
    ],
  };

  it("pins the tablets' pyramids' reviewed bytes under their image profile", async () => {
    const pins = TABLET_PYRAMIDS_PINS[TABLET_PYRAMIDS_IMAGE_PROFILE];
    expect(
      pins,
      `no reviewed bytes for ${TABLET_PYRAMIDS_IMAGE_PROFILE}: add its set`,
    ).toBeDefined();
    for (const [query, byteSize, sha256] of pins) {
      const image = await render("enochian-tablet-pyramids", query);
      expect(
        [image.byteSize, image.sha256],
        `enochian-tablet-pyramids?${query} draws other bytes than ${TABLET_PYRAMIDS_IMAGE_PROFILE} was reviewed with. ` +
          "If the drawing changed on purpose, bump the profile in registry.tsx " +
          "and pin the reviewed bytes under the new profile; never re-pin a shipped profile.",
      ).toEqual([byteSize, sha256]);
    }
  });

  // A digest of every tablet's drawing in every version, as the kamea
  // sigil's below: the byte pins above cover only Air and the Union, so a
  // fix to the rules confined to Earth, Water or Fire, or to one version's
  // bars, would change images without a bump. The source markup, before
  // outlining, at the default font; the letters are data, so a correction
  // to one moves this digest and the inputs hash together.
  const TABLET_PYRAMIDS_DRAWING_DIGESTS: Record<string, string> = {
    "magickli-tablet-pyramids-image-v1":
      "c9e913c0848356d6041ba5e2c76be3da06fe0a357260355c899c3e84bfd16946",
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-tablet-pyramids-image-v2":
      "c9e913c0848356d6041ba5e2c76be3da06fe0a357260355c899c3e84bfd16946",
  };

  it("pins a digest of every tablet's pyramids in every version under their image profile", async () => {
    const registration = COMPONENT_IMAGE_REGISTRY["enochian-tablet-pyramids"];
    const drawings: string[] = [];
    for (const version of TABLET_PYRAMID_IMAGE_VERSIONS)
      for (const id of TABLET_IDS) {
        const query = `id=${id}&version=${version}`;
        const markup = renderToStaticMarkup(
          (await registration.render(
            CONTRACTS["enochian-tablet-pyramids"].parse(
              new URLSearchParams(query),
            ),
          )) as ReactElement,
        );
        drawings.push(`${query}\n${registration.source?.(markup) ?? markup}`);
      }
    expect(drawings).toHaveLength(15);
    expect(
      createHash("sha256").update(drawings.join("\n\n")).digest("hex"),
      `the tablets' pyramids draw otherwise than ${TABLET_PYRAMIDS_IMAGE_PROFILE} was reviewed with. ` +
        "If the drawing changed on purpose, bump TABLET_PYRAMIDS_IMAGE_PROFILE in registry.tsx " +
        "and record the new digest under the new profile; never re-pin a shipped profile.",
    ).toBe(TABLET_PYRAMIDS_DRAWING_DIGESTS[TABLET_PYRAMIDS_IMAGE_PROFILE]);
  }, 60_000);

  // The same over the drawings with symbols (plan 095, "Symbols on the
  // sides"), facing out and upright, which came under the same profile:
  // the digest above holds every drawing without them unmoved.
  const TABLET_PYRAMIDS_SYMBOLS_DIGESTS: Record<string, string> = {
    "magickli-tablet-pyramids-image-v1":
      "59057dbbb22c9cd431c4aba876ba5b84234c879f7a1ff32a77a45d0d9202b229",
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-tablet-pyramids-image-v2":
      "59057dbbb22c9cd431c4aba876ba5b84234c879f7a1ff32a77a45d0d9202b229",
  };

  it("pins a digest of every tablet's pyramids with their symbols under their image profile", async () => {
    const registration = COMPONENT_IMAGE_REGISTRY["enochian-tablet-pyramids"];
    const drawings: string[] = [];
    for (const symbols of ["outward", "upright"])
      for (const version of TABLET_PYRAMID_IMAGE_VERSIONS)
        for (const id of TABLET_IDS) {
          const query = `id=${id}&version=${version}&symbols=${symbols}`;
          const markup = renderToStaticMarkup(
            (await registration.render(
              CONTRACTS["enochian-tablet-pyramids"].parse(
                new URLSearchParams(query),
              ),
            )) as ReactElement,
          );
          drawings.push(`${query}\n${registration.source?.(markup) ?? markup}`);
        }
    expect(drawings).toHaveLength(30);
    expect(
      createHash("sha256").update(drawings.join("\n\n")).digest("hex"),
      `the tablets' pyramids with their symbols draw otherwise than ${TABLET_PYRAMIDS_IMAGE_PROFILE} was reviewed with. ` +
        "If the drawing changed on purpose, bump TABLET_PYRAMIDS_IMAGE_PROFILE in registry.tsx " +
        "and record the new digests under the new profile; never re-pin a shipped profile.",
    ).toBe(TABLET_PYRAMIDS_SYMBOLS_DIGESTS[TABLET_PYRAMIDS_IMAGE_PROFILE]);
  }, 60_000);

  it("draws every tablet's squares as pyramids, which the flat image does not", async () => {
    const source = async (
      slug: "enochian-tablet" | "enochian-tablet-pyramids",
      query: string,
    ) => {
      const registration = COMPONENT_IMAGE_REGISTRY[slug];
      return renderToStaticMarkup(
        (await registration.render(
          CONTRACTS[slug].parse(new URLSearchParams(query)) as never,
        )) as ReactElement,
      );
    };
    for (const [id, squares] of [
      ["earth", 156],
      ["air", 156],
      ["water", 156],
      ["fire", 156],
      ["union", 20],
    ] as const) {
      const markup = await source("enochian-tablet-pyramids", `id=${id}`);
      expect(markup.match(/<g data-pyramid=/g), id).toHaveLength(squares);
      expect(markup.match(/<polygon data-side=/g), id).toHaveLength(
        squares * 4,
      );
      // Spirit on every square of the Union, and on a Watchtower's Great
      // Cross; each Watchtower's own element on its sides.
      expect(markup, id).toContain('data-element="spirit"');
      if (id !== "union") expect(markup, id).toContain(`data-element="${id}"`);
      expect(await source("enochian-tablet", `id=${id}`), id).not.toMatch(
        /data-pyramid/,
      );
      // The route's image and the flat one are not the same bytes.
      expect(
        (await render("enochian-tablet-pyramids", `id=${id}`)).sha256,
      ).not.toBe((await render("enochian-tablet", `id=${id}`)).sha256);
    }
  });

  it("reads the flat tablet's data and more, and leaves the flat tablet's alone", () => {
    const flat = COMPONENT_IMAGE_REGISTRY["enochian-tablet"].inputs;
    const pyramids =
      COMPONENT_IMAGE_REGISTRY["enochian-tablet-pyramids"].inputs;
    // The same letters, so a correction to one re-identifies both.
    expect(pyramids.slice(0, flat.length)).toEqual(flat);
    expect(pyramids.map((group) => group.table)).toEqual([
      "enochianTablet",
      "enochianTabletVersion",
      "enochianTablet",
      "zodiac",
      "planet",
      "element",
      "kerub",
      "sephirah",
      "treeOfLifePath",
      "gdGodForm",
      // The symbols, hashed ahead of the switch that would draw them.
      "zodiac",
      "planet",
      "hebrewLetter",
      "tetragram",
    ]);
    // The flat tablet still publishes under the shared profile and its
    // own inputs, pinned above, so its images keep their identity.
    expect(COMPONENT_IMAGE_REGISTRY["enochian-tablet"].profile).toBe(
      COMPONENT_IMAGE_PROFILE,
    );
    expect(componentInputsHash("enochian-tablet")).not.toBe(
      componentInputsHash("enochian-tablet-pyramids"),
    );
  });

  // A digest of the kamea sigil's drawings, as the rose's: every name the
  // planetary names table traces, in its traced spelling (Agrippa 1533's,
  // the spirit of spirits divided; plan 093, decisions 6 and 10), in both
  // finals modes, and texts that use the marks on the grid. Written out
  // as they stood when v1 was reviewed (magick-data at 7a9ad086), so that
  // a correction to the data does not move the digest.
  const KAMEA_SIGIL_DIGEST_TEXTS: readonly (readonly [
    KameaImagePlanet,
    string,
  ])[] = [
    ["saturn", "אב"],
    ["saturn", "הד"],
    ["saturn", "יה"],
    ["saturn", "הוד"],
    ["saturn", "יוד הא ואו הא"],
    ["saturn", "אגיאל"],
    ["saturn", "זאזל"],
    ["jupiter", "אבא"],
    ["jupiter", "הוה"],
    ["jupiter", "אהי"],
    ["jupiter", "אל אב"],
    ["jupiter", "יהפיאל"],
    ["jupiter", "יופיל"], // 777's Yophiel, another trace (decision 6)
    ["jupiter", "הסמאל"],
    ["mars", "ה"],
    ["mars", "יהי"],
    ["mars", "אדני"],
    ["mars", "גראפיאל"],
    ["mars", "ברצאבאל"],
    ["mars", "ברצבאל"], // 777's Bartzabel
    ["sol", "ו"],
    ["sol", "הא"],
    ["sol", "אלה"],
    ["sol", "נכיאל"],
    ["sol", "סורת"],
    ["venus", "אהא"],
    ["venus", "הגיאל"],
    ["venus", "קדמאל"],
    ["venus", "בני שרפים"],
    ["mercury", "אזבוגה"],
    ["mercury", "דין"],
    ["mercury", "דני"],
    ["mercury", "טיריאל"],
    ["mercury", "תפתרתרת"],
    ["luna", "הד"],
    ["luna", "אלים"],
    ["luna", "חשמודאי"],
    ["luna", "שדברשהמעת שרתתן"],
    ["luna", "מלכא בתרשיתים עד ברוח שחקים"],
    ["mercury", "בבבב"], // A-A-A-A: crooks in one cell
    ["sol", "אבאבא"], // A-B-A-B-A
    ["luna", "יכלמנסעפצ"], // a run down the Moon's column
  ];
  const KAMEA_SIGIL_DRAWING_DIGESTS: Record<string, string> = {
    "magickli-kamea-sigil-image-v1":
      "802fea6392e7d6a55d935f38093107a4df5de7a59c767d90ec9f26e45a056ba9",
    // v2 shares a repeated square through <use>; the figures are v1's.
    "magickli-kamea-sigil-image-v2":
      "802fea6392e7d6a55d935f38093107a4df5de7a59c767d90ec9f26e45a056ba9",
    // Coordinates rounded to OUTLINE_PRECISION (24 November 2026), drawing unchanged.
    "magickli-kamea-sigil-image-v3":
      "802fea6392e7d6a55d935f38093107a4df5de7a59c767d90ec9f26e45a056ba9",
  };

  it("pins a digest of the kamea sigil's drawings under its image profile", () => {
    const drawings = KAMEA_SIGIL_DIGEST_TEXTS.flatMap(([planet, text]) =>
      [false, true].map(
        (finals) =>
          `${planet} ${finals} ${text}\n${sigilFigure(text, kameaLayout(planet, { finals }), KAMEA_SIGIL_PROFILE).paths.join("\n")}`,
      ),
    );
    expect(
      createHash("sha256").update(drawings.join("\n\n")).digest("hex"),
      `the kamea sigil's drawings differ from those ${KAMEA_SIGIL_IMAGE_PROFILE} was reviewed with. ` +
        "If the drawing changed on purpose, bump KAMEA_SIGIL_IMAGE_PROFILE in registry.tsx " +
        "and record the new digest under the new profile; never re-pin a shipped profile.",
    ).toBe(KAMEA_SIGIL_DRAWING_DIGESTS[KAMEA_SIGIL_IMAGE_PROFILE]);
  }, 60_000);

  it("draws a sigil placement cannot clear, and says so in a header", async () => {
    // 777's spelling of the Moon's intelligence of intelligences, with
    // finals: the one name spelling the generator offers that does not
    // clear (plan 093, K3). Drawn best effort, the same kind of image,
    // with nothing in its bytes to say so; the header does.
    const query = `planet=luna&text=${encodeURIComponent("מלכא בתרשישים ועד ברוח שחקים")}&finals=true`;
    const failed = await componentImageResponse(
      "kamea-sigil",
      new Request(`https://magick.ly/api/render/kamea-sigil?${query}`),
    );
    expect(failed.status).toBe(200);
    expect(failed.headers.get(SIGIL_PLACEMENT_HEADER)).toBe("failed");
    expect(failed.headers.get("X-Robots-Tag")).toBe("noindex");
    const bytes = Buffer.from(await failed.arrayBuffer());
    expect(bytes.toString()).not.toContain("data-placement");
    expect(await validate(bytes)).toMatchObject({ status: "validated" });
    // A revalidation says so too.
    const revalidated = await componentImageResponse(
      "kamea-sigil",
      new Request(`https://magick.ly/api/render/kamea-sigil?${query}`, {
        headers: { "If-None-Match": failed.headers.get("ETag") ?? "" },
      }),
    );
    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get(SIGIL_PLACEMENT_HEADER)).toBe("failed");
    const clear = await componentImageResponse(
      "kamea-sigil",
      new Request(
        `https://magick.ly/api/render/kamea-sigil?planet=saturn&text=${encodeURIComponent("אגיאל")}`,
      ),
    );
    expect(clear.headers.get(SIGIL_PLACEMENT_HEADER)).toBeNull();
    const square = await componentImageResponse(
      "kamea",
      new Request("https://magick.ly/api/render/kamea?planet=luna"),
    );
    expect(square.headers.get(SIGIL_PLACEMENT_HEADER)).toBeNull();
    // The kamea pages' static files are the squares' copies to index (plan
    // 093, K4).
    expect(square.headers.get("X-Robots-Tag")).toBe("noindex");
    // Read from the markup, which no registration but the sigil's marks.
    const registration = COMPONENT_IMAGE_REGISTRY["kamea-sigil"];
    expect(
      registration.headers?.('<svg viewBox="0 0 1 1" data-placement="failed">'),
    ).toEqual({ [SIGIL_PLACEMENT_HEADER]: "failed" });
    expect(registration.headers?.('<svg viewBox="0 0 1 1">')).toEqual({});
  }, 60_000);

  it("draws a kamea sigil differently with finals, and the same without one", async () => {
    // Elim's Mem is final: 40 without finals, 600 (so 60) with.
    expect(
      (await render("kamea-sigil", "planet=luna&text=אלים&finals=true")).sha256,
    ).not.toBe((await render("kamea-sigil", "planet=luna&text=אלים")).sha256);
    // Agiel has no final letter.
    expect(
      (await render("kamea-sigil", "planet=saturn&text=אגיאל&finals=true"))
        .sha256,
    ).toBe((await render("kamea-sigil", "planet=saturn&text=אגיאל")).sha256);
  });

  it("draws different geomancy readings and sigils differently", async () => {
    const a = await render("astro-geomancy-chart", "m=1111111111111111");
    const b = await render("astro-geomancy-chart", "m=2222222222222222");
    expect(a.sha256).not.toBe(b.sha256);
    const rose = await render("rose-sigil", "text=אב");
    const bare = await render("rose-sigil", "text=אב&rose=false");
    expect(rose.byteSize).toBeGreaterThan(bare.byteSize);
    expect(hash(rose.bytes)).toBe(rose.sha256);
  });

  it("traces a sigil through Kaph or Tau differently on Regardie's rose", async () => {
    const regardie = "&version=regardie1939";
    // A name without either letter: the same sigil; the rose behind it
    // differs in those two letters' labels alone.
    for (const query of ["text=אדני&rose=false", "text=גדי&rose=false"])
      expect((await render("rose-sigil", query + regardie)).sha256).toBe(
        (await render("rose-sigil", query)).sha256,
      );
    expect((await render("rose-sigil", `text=גדי${regardie}`)).sha256).not.toBe(
      (await render("rose-sigil", "text=גדי")).sha256,
    );
    for (const query of ["text=שבתאי&rose=false", "text=כתר&rose=false"])
      expect((await render("rose-sigil", query + regardie)).sha256).not.toBe(
        (await render("rose-sigil", query)).sha256,
      );
    // The default, named or not, is one image.
    expect((await render("rose-sigil", "text=גדי&version=gd")).sha256).toBe(
      (await render("rose-sigil", "text=גדי")).sha256,
    );
  });
});
