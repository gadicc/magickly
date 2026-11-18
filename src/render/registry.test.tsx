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
import { sigilFigure } from "magick-components/sigil/SigilImage";
import type { ReactElement } from "react";
import { createRitualSvgValidator } from "@/files/validateRitualSvg";
import { SEVENTY_TWO_NAMES } from "../../packages/magick-components/src/sigil/oracle/corpus";
import { PLAN_TEMPLATES } from "../../packages/magick-components/src/sigil/oracle/templates";
import { renderComponentImage } from "./componentImage";
import { COMPONENT_IMAGE_SLUGS, CONTRACTS } from "./contracts";
import { contractViewBox } from "./contracts/types";
import { IMAGE_INPUTS_PROFILE } from "./dataInputs";
import {
  COMPONENT_IMAGE_PROFILE,
  TREE_IMAGE_PROFILE,
} from "./outlineTreeImage";
import {
  COMPONENT_IMAGE_REGISTRY,
  componentInputsHash,
  ROSE_SIGIL_IMAGE_PROFILE,
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
    expect(ROSE_SIGIL_IMAGE_PROFILE).toBe("magickli-rose-sigil-image-v1");
    expect(COMPONENT_IMAGE_REGISTRY["rose-sigil"].profile).toBe(
      ROSE_SIGIL_IMAGE_PROFILE,
    );
    expect(ROSE_SIGIL_IMAGE_PROFILE).not.toBe(COMPONENT_IMAGE_PROFILE);
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
    // below.
    [
      "enochian-tablet",
      "1212086a363070af3b7b2eed54a28c9f2b967c8ccfefb1c8c152d2cdfd2327d8",
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
    // the bytes together under the same profile.
    expect(image.byteSize).toBe(150_785);
    expect(image.sha256).toBe(
      "a1fe82b8007671767c635763bbe47ad0a15ac4663c78650386d6bc803233176f",
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
      expect(text).not.toMatch(/<text|<style|href=|font-family|<image/);
      expect((text.match(/<path/g) ?? []).length).toBeGreaterThanOrEqual(
        minimumPaths,
      );
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
      124_796,
      "dcced8d14f168184211314c9226a675b997a755abe8606eade54acd3f2054253",
    ],
    [
      "enochian-tablet",
      "id=air&font=enochian",
      220_135,
      "48c4507e88fd7567bc76be2727fac48cafa74edc39fa4d58896d151d01b33b26",
    ],
    // One tablet in each other version, reviewed as rasterised (plan 061,
    // "Tablet versions"): Regardie's sigil, the Equinox's in black, and
    // for Dee's and Raphael's tables the note where the sigil would be.
    [
      "enochian-tablet",
      "id=fire&version=regardie",
      129_479,
      "41657fe69438e1b3d39045e6a8e106d6b33163ac8c656943eed667f7bfd422e8",
    ],
    [
      "enochian-tablet",
      "id=fire&version=equinox",
      129_492,
      "36552c46496b0c69fa208559bb6cae0bd587cd2263ff33cb5fbd4b2b7e034315",
    ],
    [
      "enochian-tablet",
      "id=fire&version=dee",
      196_786,
      "54f3e8a9a8adb89898a5767995cdf88b995e161cbdfbbfa5bd8a564474b6dae0",
    ],
    [
      "enochian-tablet",
      "id=fire&version=raphael",
      201_612,
      "7996e0277aa287e480ac1aa396c1e75c86c2e200b57e84885df9808490b0a56b",
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
      126_699,
      "5226c936496d6417ff0890865e1ce489d07f9d11b3f7ab553c5bad3df97574ee",
    ],
    // The Equinox's figure of 1909, the default since 14 November 2026
    // (plan 080, "The rose's and the candlestick's versions"), reviewed
    // as rasterised. The modern drawing, the default before, keeps its
    // bytes under `version=modern`.
    [
      "seven-branched-candlestick",
      "",
      87_746,
      "f20b1474e88bacdfdd0a221af664a60858a90fadf1f65c81abfd4025a294a5a7",
    ],
    [
      "seven-branched-candlestick",
      "version=modern",
      52_363,
      "5d8b637f7ceb159014b1bf7322b51456a8bd2b730bdb699883288ed6bf063331",
    ],
    [
      "astro-geomancy-chart",
      "",
      52_476,
      "eb2f1b6fe2fef2f563ee164de6e403ca9f398ec4706c9ad331195bc34286bffa",
    ],
    // Pinned before the outliner learned to keep the halls' paint servers
    // (plan 062), so all six slugs prove that change left them alone.
    [
      "tree-of-life",
      "",
      44_251,
      "a6f69235cd10092063a5a24572819d6bb7fecc489560f6f6b8a2b99ed91fa557",
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
  // of the 72 names and every template, on both roses. A change to the
  // engine that moves any of them, even one the four pinned images above
  // do not show, must come with a new profile.
  const ROSE_SIGIL_DRAWING_DIGESTS: Record<string, string> = {
    "magickli-rose-sigil-image-v1":
      "7c970cc0f61526531e8d428b9f2d2d905bd7c6fc65ff871bb6d30136b77d9f37",
  };

  it("pins a digest of the rose sigil's drawings under its image profile", () => {
    const texts = [
      ...new Set([
        ...SEVENTY_TWO_NAMES.map((n) => n.text),
        ...PLAN_TEMPLATES.map((t) => t.text),
      ]),
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
