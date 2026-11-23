import Kamea from "magick-components/astrology/Kamea";
import { KameaSigilImage } from "magick-components/astrology/KameaSigil";
import {
  tabletViewBox,
  UNION_VIEWBOX,
  WATCHTOWER_VIEWBOX,
} from "magick-components/enochian/Tablet";
import RoseSigilImage from "magick-components/gd/RoseSigilImage";
import { ROSE_VERSIONS } from "magick-components/gd/roseSigilGeometry";
import { SIGIL_STYLES } from "magick-components/gd/roseSigilStyles";
import { CANDLESTICK_VERSIONS } from "magick-components/gd/SevenBranchedCandlestick";
import { KAMEA_PLANETS } from "magick-data/astrology/kameas";
import tablets, {
  TABLET_VERSIONS,
  tabletVersion,
} from "magick-data/enochian/tablets";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { angelSlug } from "@/lib/angelSlugs";
import { parseComponentImageRequest } from "../componentImageRequest";
import { componentImageQuery } from "../componentImageUrl";
import {
  ANGEL_SIGIL_GENESIS_VERSE,
  ANGEL_SIGIL_SLUGS,
  ANGEL_SIGIL_STYLES,
  angelSigilFileBase,
} from "./angelSigil";
import {
  DEFAULT_MOTHERS,
  mothersFromString,
  mothersToString,
} from "./astroGeomancyChart";
import {
  TABLET_IDS,
  TABLET_IMAGE_VERSIONS,
  TABLET_VIEWBOX,
  TABLET_VIEWBOXES,
  UNION_IMAGE_VERSIONS,
  UNION_TABLET_VIEWBOX,
} from "./enochianTablet";
import {
  COMPONENT_IMAGE_SLUGS,
  CONTRACTS,
  type ComponentImageSlug,
  InvalidComponentImageRequest,
  isComponentImageSlug,
} from "./index";
import { KAMEA_IMAGE_PLANETS, KAMEA_VIEWBOX } from "./kamea";
import {
  canonicalKameaSigilText,
  KAMEA_SIGIL_LETTERS,
  KAMEA_SIGIL_MAX_LETTERS,
} from "./kameaSigil";
import {
  canonicalSigilText,
  foldFinalForms,
  ROSE_IMAGE_VERSIONS,
  SIGIL_MAX_LETTERS,
  sigilRasterDefault,
  sigilViewBox,
} from "./roseSigil";
import { CANDLESTICK_IMAGE_VERSIONS } from "./sevenBranchedCandlestick";
import {
  type ComponentImageContract,
  contractRasterDefault,
  contractViewBox,
  DIMENSION_LIMITS,
  type ImageDimensions,
  parseDimensions,
} from "./types";

const parse = <S extends ComponentImageSlug>(slug: S, query = "") =>
  parseComponentImageRequest(slug, new URLSearchParams(query)).props;

describe("component image contracts", () => {
  it("keys the registry by each contract's own slug with a valid viewBox", () => {
    for (const slug of COMPONENT_IMAGE_SLUGS) {
      const contract = CONTRACTS[slug];
      expect(contract.slug).toBe(slug);
      expect(contract.viewBox).toHaveLength(4);
      expect(contract.viewBox[2]).toBeGreaterThan(0);
      expect(contract.viewBox[3]).toBeGreaterThan(0);
      expect(contract.keys).not.toContain("fmt");
      expect(contract.keys).not.toContain("width");
      expect(contract.keys).not.toContain("download");
      expect(isComponentImageSlug(slug)).toBe(true);
    }
    expect(isComponentImageSlug("toString")).toBe(false);
    expect(isComponentImageSlug("__proto__")).toBe(false);
  });

  const samples: Record<ComponentImageSlug, string[]> = {
    "tree-of-life": [
      "",
      "field=name.roman&topText=godName.name.he&bottomText=angelicOrder.name.he,index,archangel.name.he",
      "topText=&bottomText=name.en&colorScale=king&letterAttr=hebrew&flip=true",
      "showDaat=true&fontSize=10&active=daat&activePath=2_5&width=200",
      "fontSize=12.25&height=300",
    ],
    "astro-geomancy-chart": [
      "",
      "m=2222111122221111",
      "m=1111111111111111&width=512",
    ],
    "enochian-tablet": [
      "",
      "id=air",
      "id=earth&height=600",
      "font=enochian",
      "id=air&font=enochian&width=420",
      "id=fire&version=dee",
      "version=equinox&font=enochian",
      "id=union",
      "id=union&version=equinox&font=enochian",
      "id=union&width=2000",
      "id=union&height=104",
    ],
    "seven-branched-candlestick": [
      "",
      "width=300",
      "width=100&height=100",
      "version=modern",
      "version=equinox1909&width=300",
    ],
    "table-of-shewbread": ["", "width=300"],
    "rose-sigil": [
      "text=גדי",
      "text=אבג&rose=false",
      "text=שלום&width=50",
      "text=שבתאי&version=regardie1939",
      "text=כתר&rose=false&version=regardie1939&width=50",
      "text=יהוה אלהים",
      "text=יוד הא ואו הא&rose=false&height=100",
    ],
    kamea: ["planet=saturn", "planet=luna&width=300", "planet=sol&height=50"],
    "kamea-sigil": [
      "planet=saturn&text=אגיאל",
      "planet=venus&text=בני שרפים",
      "planet=luna&text=אלים&finals=true",
      "planet=luna&text=מלכא בתרשיתים עד ברוח שחקים&finals=true&width=400",
      "planet=mercury&text=תפתרתרת&height=100",
      "planet=venus&text=בני שרפים&columns=1",
      "planet=luna&text=מלכא בתרשיתים עד ברוח שחקים&columns=2&width=880",
    ],
    // Sizes are PNG-only, so they round-trip in gdHall.test.ts.
    "gd-hall": ["", "hall=zelator-1", "hall=portal-2"],
    "angel-sigil": [
      "angel=vehuiah",
      "angel=vehuiah&style=band",
      "angel=lauviah-17&style=bare",
      "angel=nith-haiah&style=rose",
      "angel=jabamiah&style=talisman&width=300",
      "style=talisman&angel=asaliah&height=512",
    ],
  };

  it.each(Object.entries(samples))(
    "round-trips %s props through canonical queries",
    (slug, queries) => {
      for (const query of queries) {
        const props = parse(slug as ComponentImageSlug, query);
        for (const format of ["svg", "png"] as const) {
          const canonical = componentImageQuery(
            { slug: slug as ComponentImageSlug, props } as never,
            { format },
          );
          const again = parseComponentImageRequest(slug, canonical);
          expect(again.props).toEqual(props);
          expect(again.format).toBe(format);
          expect(JSON.stringify(again.props)).toBe(JSON.stringify(props));
          for (const key of canonical.keys())
            expect([
              "fmt",
              "width",
              "height",
              ...CONTRACTS[slug].keys,
            ]).toContain(key);
        }
      }
    },
  );

  it("omits defaults so equivalent requests share one URL", () => {
    expect(
      componentImageQuery({
        slug: "tree-of-life",
        props: parse("tree-of-life"),
      }).toString(),
    ).toBe("");
    expect(
      componentImageQuery({
        slug: "tree-of-life",
        props: parse(
          "tree-of-life",
          "field=index&topText=index&bottomText=&flip=false",
        ),
      }).toString(),
    ).toBe("");
    expect(
      componentImageQuery({
        slug: "tree-of-life",
        props: parse("tree-of-life", "topText="),
      }).toString(),
    ).toBe("topText=");
    expect(
      componentImageQuery({
        slug: "astro-geomancy-chart",
        props: parse("astro-geomancy-chart", `m=${DEFAULT_MOTHERS}`),
      }).toString(),
    ).toBe("");
    expect(
      componentImageQuery({
        slug: "enochian-tablet",
        props: parse("enochian-tablet", "id=earth&font=latin"),
      }).toString(),
    ).toBe("");
    expect(
      componentImageQuery({
        slug: "enochian-tablet",
        props: parse("enochian-tablet", "font=enochian"),
      }).toString(),
    ).toBe("font=enochian");
    expect(
      componentImageQuery(
        { slug: "seven-branched-candlestick", props: {} },
        { format: "png", download: true },
      ).toString(),
    ).toBe("fmt=png&download=1");
  });

  it("decodes and encodes the geomancy mothers exactly", () => {
    expect(mothersFromString(DEFAULT_MOTHERS)).toEqual([
      [1, 2, 1, 1],
      [1, 1, 1, 2],
      [2, 1, 1, 1],
      [1, 2, 1, 2],
    ]);
    expect(mothersToString(mothersFromString("2121212121212121"))).toBe(
      "2121212121212121",
    );
    for (const bad of ["", "121", "1211111221111213", "12111112211112120"])
      expect(() => mothersFromString(bad)).toThrow(
        InvalidComponentImageRequest,
      );
  });

  it("canonicalises sigil final letters and bounds the text", () => {
    expect(foldFinalForms("מטטרון שלום")).toBe("מטטרונ שלומ");
    // Spelled as Hebrew writes it, however it was typed: a final form at
    // the end of a word of two letters or more, and nowhere else.
    for (const typed of ["שלום", "שלומ", "שםלום"])
      expect(parse("rose-sigil", `text=${typed}`).text).toBe(
        typed === "שםלום" ? "שמלום" : "שלום",
      );
    expect(parse("rose-sigil", "text=מטטרונ  יהוה").text).toBe("מטטרון יהוה");
    expect(parse("rose-sigil", "text=ץ ם").text).toBe("צ מ");
    expect(
      parse("rose-sigil", "text=" + "א".repeat(SIGIL_MAX_LETTERS)).text,
    ).toHaveLength(SIGIL_MAX_LETTERS);
    for (const query of [
      "",
      "text=",
      "text= ",
      "text=abc",
      "text=א,ב",
      "text=א-ב",
      "text=א־ב",
      `text=${"א".repeat(SIGIL_MAX_LETTERS + 1)}`,
      `text=${"א ".repeat(SIGIL_MAX_LETTERS + 1)}`,
      `text=${"א".repeat(SIGIL_MAX_LETTERS)} ב`,
      "text=א&rose=0",
      "text=א&debug=true",
      "text=א&animate=true",
    ])
      expect(() => parse("rose-sigil", query)).toThrow(
        InvalidComponentImageRequest,
      );
    expect(CONTRACTS["rose-sigil"].personal).toBe(true);
    // The angels' sigils are indexed as static files (plan 088, S4).
    expect(CONTRACTS["rose-sigil"].indexed).toBe(false);
    expect(CONTRACTS["astro-geomancy-chart"].personal).toBe(true);
    expect(CONTRACTS["tree-of-life"].personal).toBe(false);
    expect(
      CONTRACTS["rose-sigil"].filename(parse("rose-sigil", "text=גדי")),
    ).toBe("rose-sigil-גדי");
  });

  it("takes several words, each its own sigil (plan 088, R2)", () => {
    // Any whitespace between words, collapsed to one space and trimmed.
    expect(parse("rose-sigil", "text=יהוה  אלהים").text).toBe("יהוה אלהים");
    expect(
      parse(
        "rose-sigil",
        `text=${encodeURIComponent(" יוד\tהא\nואו\u00a0הא ")}`,
      ).text,
    ).toBe("יוד הא ואו הא");
    expect(canonicalSigilText("יהוה אלהים")).toBe("יהוה אלהים");
    expect(canonicalSigilText("  ")).toBeNull();
    // The bound counts letters, not spaces.
    const many = Array(SIGIL_MAX_LETTERS).fill("א").join(" ");
    expect(parse("rose-sigil", `text=${many}`).text).toBe(many);
    expect(
      componentImageQuery({
        slug: "rose-sigil",
        props: parse("rose-sigil", "text=יהוה  אלהים"),
      }).toString(),
    ).toBe(new URLSearchParams({ text: "יהוה אלהים" }).toString());
    expect(
      CONTRACTS["rose-sigil"].filename(parse("rose-sigil", "text=יהוה אלהים")),
    ).toBe("rose-sigil-יהוה-אלהים");
  });

  it("frames each word as the package draws it, right to left", () => {
    const contract = CONTRACTS[
      "rose-sigil"
    ] as unknown as ComponentImageContract<ImageDimensions & { text: string }>;
    for (const [text, viewBox] of [
      ["גדי", [-50, -50, 100, 100]],
      ["יהוה אלהים", [-150, -50, 200, 100]],
      ["יוד הא ואו הא", [-350, -50, 400, 100]],
    ] as const) {
      const props = parse("rose-sigil", `text=${text}`);
      expect(contractViewBox(contract, props)).toEqual(viewBox);
      // The contract writes the package's frame out; they must agree.
      expect(
        renderToStaticMarkup(
          createElement(RoseSigilImage, { text: props.text }),
        ),
      ).toContain(`viewBox="${viewBox.join(" ")}"`);
    }
    expect(sigilViewBox(1)).toEqual([-50, -50, 100, 100]);
    // A size's other axis follows the words' aspect.
    expect(
      parse("rose-sigil", "text=יהוה אלהים&width=400").height,
    ).toBeUndefined();
    expect(() =>
      parse("rose-sigil", `text=${"א ".repeat(8).trim()}&height=1024`),
    ).toThrow(InvalidComponentImageRequest);
    // The PNG's default: 1,024 a word, inside 4,096 a side.
    expect(sigilRasterDefault(1)).toEqual({ width: 1024, height: 1024 });
    expect(sigilRasterDefault(4)).toEqual({ width: 4096, height: 1024 });
    expect(sigilRasterDefault(8)).toEqual({ width: 4096, height: 512 });
    expect(sigilRasterDefault(32)).toEqual({ width: 4096, height: 128 });
    expect(
      contractRasterDefault(contract, parse("rose-sigil", "text=א ב")),
    ).toEqual({ width: 2048, height: 1024 });
  });

  it("never accepts download as a render key, so saved references cannot carry it", () => {
    // Each slug's least valid query, which parses without `download`.
    const least: Partial<Record<ComponentImageSlug, string>> = {
      "rose-sigil": "text=א",
      kamea: "planet=saturn",
      "kamea-sigil": "planet=saturn&text=א",
      "angel-sigil": "angel=vehuiah",
    };
    for (const slug of COMPONENT_IMAGE_SLUGS) {
      const query = least[slug] ?? "";
      expect(() => parse(slug, query)).not.toThrow();
      expect(() =>
        parse(slug, `${query}${query ? "&" : ""}download=1`),
      ).toThrow(InvalidComponentImageRequest);
    }
  });

  it("takes each request's viewBox from viewBoxOf, else the fixed one", () => {
    // The other contracts draw one shape and keep their fixed viewBox;
    // the halls, the sigil's words and the tablets (the Union's page is
    // its own, below) are not one shape.
    for (const slug of COMPONENT_IMAGE_SLUGS.filter(
      (slug) =>
        slug !== "gd-hall" &&
        slug !== "rose-sigil" &&
        slug !== "kamea-sigil" &&
        slug !== "enochian-tablet",
    )) {
      const contract = CONTRACTS[
        slug
      ] as unknown as ComponentImageContract<ImageDimensions>;
      for (const query of samples[slug])
        expect(contractViewBox(contract, parse(slug, query))).toBe(
          contract.viewBox,
        );
    }
    type Wide = ImageDimensions & { wide: boolean };
    const sized: ComponentImageContract<Wide> = {
      ...(CONTRACTS[
        "seven-branched-candlestick"
      ] as unknown as ComponentImageContract<Wide>),
      viewBoxOf: (props) => (props.wide ? [0, 0, 20, 10] : [0, 0, 10, 20]),
    };
    expect(contractViewBox(sized, { wide: true })).toEqual([0, 0, 20, 10]);
    expect(contractViewBox(sized, { wide: false })).toEqual([0, 0, 10, 20]);
  });

  it("draws each tablet on the page the component draws it on", () => {
    expect([...TABLET_VIEWBOX]).toEqual([...WATCHTOWER_VIEWBOX]);
    expect([...UNION_TABLET_VIEWBOX]).toEqual([...UNION_VIEWBOX]);
    expect(Object.keys(TABLET_VIEWBOXES)).toEqual([...TABLET_IDS]);
    const contract = CONTRACTS["enochian-tablet"];
    for (const id of TABLET_IDS) {
      expect([...TABLET_VIEWBOXES[id]], id).toEqual([...tabletViewBox(id)]);
      expect(
        contractViewBox(contract, parse("enochian-tablet", `id=${id}`)),
      ).toEqual(TABLET_VIEWBOXES[id]);
    }
  });

  it("rasterises each tablet at its own shape, 4 pixels a unit", () => {
    const contract = CONTRACTS["enochian-tablet"];
    const raster = (query: string) =>
      contractRasterDefault(contract, parse("enochian-tablet", query));
    // The Watchtowers' size, which their images have always had.
    for (const id of ["earth", "air", "water", "fire"])
      expect(raster(`id=${id}`)).toEqual({ width: 840, height: 1188 });
    // 840 × 1188 would crop the Union's 124 × 104 page.
    expect(raster("id=union")).toEqual({ width: 496, height: 416 });
    for (const id of TABLET_IDS) {
      const [, , width, height] = TABLET_VIEWBOXES[id];
      expect(raster(`id=${id}`)).toEqual({
        width: width * 4,
        height: height * 4,
      });
    }
  });

  it("parses a tablet's dimensions against its own page", () => {
    // 2,000 wide: 1,678 tall for the Union, inside the pixel limit; 2,829
    // tall for a Watchtower, over it.
    expect(parse("enochian-tablet", "id=union&width=2000")).toMatchObject({
      width: 2000,
    });
    expect(() => parse("enochian-tablet", "id=earth&width=2000")).toThrow(
      InvalidComponentImageRequest,
    );
  });

  it("offers the Tablet of Union only in the versions that have it", () => {
    expect([...UNION_IMAGE_VERSIONS]).toEqual(
      TABLET_VERSIONS.filter((version) =>
        Boolean(tabletVersion(tablets.union, version)),
      ),
    );
    for (const version of UNION_IMAGE_VERSIONS)
      expect(
        parse("enochian-tablet", `id=union&version=${version}`).version,
      ).toBe(version);
    for (const version of ["dee", "raphael"])
      expect(() =>
        parse("enochian-tablet", `id=union&version=${version}`),
      ).toThrow(InvalidComponentImageRequest);
    expect(
      CONTRACTS["enochian-tablet"].filename(
        parse("enochian-tablet", "id=union&version=equinox&font=enochian"),
      ),
    ).toBe("enochian-union-tablet-equinox-glyphs");
  });

  it("offers the tablets' versions, the Golden Dawn's by default", () => {
    expect([...TABLET_IMAGE_VERSIONS]).toEqual([...TABLET_VERSIONS]);
    expect(parse("enochian-tablet", "").version).toBe("gd");
    expect(
      componentImageQuery({
        slug: "enochian-tablet",
        props: parse("enochian-tablet", "version=gd"),
      }).toString(),
    ).toBe("");
    expect(
      CONTRACTS["enochian-tablet"].filename(
        parse("enochian-tablet", "id=fire&version=dee&font=enochian"),
      ),
    ).toBe("enochian-fire-tablet-dee-glyphs");
  });

  it("offers the candlestick's versions, the 1909 figure by default", () => {
    expect([...CANDLESTICK_IMAGE_VERSIONS]).toEqual([...CANDLESTICK_VERSIONS]);
    expect(parse("seven-branched-candlestick").version).toBe("equinox1909");
    expect(
      componentImageQuery({
        slug: "seven-branched-candlestick",
        props: parse("seven-branched-candlestick", "version=equinox1909"),
      }).toString(),
    ).toBe("");
    expect(
      CONTRACTS["seven-branched-candlestick"].filename(
        parse("seven-branched-candlestick", "version=modern"),
      ),
    ).toBe("seven-branched-candlestick-modern");
    expect(
      CONTRACTS["seven-branched-candlestick"].filename(
        parse("seven-branched-candlestick"),
      ),
    ).toBe("seven-branched-candlestick");
    for (const query of ["version=Modern", "version=equinox", "version=gd"])
      expect(() => parse("seven-branched-candlestick", query)).toThrow(
        InvalidComponentImageRequest,
      );
  });

  it("names the seven kameas by the planet table's ids, and no default", () => {
    // Written out so that the contracts do not import the squares.
    expect([...KAMEA_IMAGE_PLANETS]).toEqual([...KAMEA_PLANETS]);
    for (const slug of ["kamea", "kamea-sigil"] as const)
      for (const query of [
        "",
        "planet=",
        "planet=Saturn",
        "planet=sun",
        "planet=earth",
        "planet=constructor",
        "planet=saturn&planet=luna",
      ])
        expect(() =>
          parse(slug, `${query}${slug === "kamea-sigil" ? "&text=א" : ""}`),
        ).toThrow(InvalidComponentImageRequest);
    expect(
      componentImageQuery({
        slug: "kamea",
        props: parse("kamea", "planet=sol"),
      }).toString(),
    ).toBe("planet=sol");
    expect(CONTRACTS.kamea.filename(parse("kamea", "planet=luna"))).toBe(
      "kamea-luna",
    );
    expect(CONTRACTS.kamea.personal).toBe(false);
    // The kameas' pages publish the squares as static files (plan 093, K4).
    expect(CONTRACTS.kamea.indexed).toBe(false);
    expect(() => parse("kamea", "planet=saturn&text=א")).toThrow(
      InvalidComponentImageRequest,
    );
  });

  it("draws each kamea on Kamea's own page, 1,024 pixels square", () => {
    const contract = CONTRACTS.kamea as unknown as ComponentImageContract<
      ImageDimensions & { planet: string }
    >;
    for (const planet of KAMEA_IMAGE_PLANETS) {
      const props = parse("kamea", `planet=${planet}`);
      expect(contractViewBox(contract, props)).toEqual(KAMEA_VIEWBOX);
      expect(renderToStaticMarkup(createElement(Kamea, { planet }))).toContain(
        `viewBox="${KAMEA_VIEWBOX.join(" ")}"`,
      );
    }
    expect(
      contractRasterDefault(contract, parse("kamea", "planet=sol")),
    ).toEqual({ width: 1024, height: 1024 });
  });

  it("keeps a kamea sigil's letters as typed, finals its own key", () => {
    // The 22 letters and the five finals, each once.
    expect([...KAMEA_SIGIL_LETTERS]).toHaveLength(27);
    expect(new Set(KAMEA_SIGIL_LETTERS).size).toBe(27);
    // Whitespace collapses; the forms stay, since with finals a form is
    // a value of its own.
    expect(parse("kamea-sigil", "planet=luna&text= אלים  חשמודאי ").text).toBe(
      "אלים חשמודאי",
    );
    expect(parse("kamea-sigil", "planet=luna&text=אלימ").text).toBe("אלימ");
    expect(canonicalKameaSigilText("ם")).toBe("ם");
    expect(canonicalKameaSigilText("  ")).toBeNull();
    expect(parse("kamea-sigil", "planet=saturn&text=זאזל").finals).toBe(false);
    expect(
      parse("kamea-sigil", "planet=saturn&text=זאזל&finals=true").finals,
    ).toBe(true);
    // A default is left out of the link, a set flag kept.
    expect(
      componentImageQuery({
        slug: "kamea-sigil",
        props: parse("kamea-sigil", "planet=saturn&text=זאזל&finals=false"),
      }).toString(),
    ).toBe(new URLSearchParams({ planet: "saturn", text: "זאזל" }).toString());
    expect(
      componentImageQuery({
        slug: "kamea-sigil",
        props: parse("kamea-sigil", "planet=luna&text=אלים  עד&finals=true"),
      }).toString(),
    ).toBe(
      new URLSearchParams({
        planet: "luna",
        text: "אלים עד",
        finals: "true",
      }).toString(),
    );
    expect(
      parse(
        "kamea-sigil",
        `planet=luna&text=${"א".repeat(KAMEA_SIGIL_MAX_LETTERS)}`,
      ).text,
    ).toHaveLength(KAMEA_SIGIL_MAX_LETTERS);
    for (const query of [
      "planet=saturn",
      "planet=saturn&text=",
      "planet=saturn&text= ",
      "planet=saturn&text=abc",
      "planet=saturn&text=אגיאל1",
      "planet=saturn&text=א־ב",
      "planet=saturn&text=אָ",
      `planet=saturn&text=${"א".repeat(KAMEA_SIGIL_MAX_LETTERS + 1)}`,
      `planet=saturn&text=${"א ".repeat(KAMEA_SIGIL_MAX_LETTERS + 1)}`,
      "planet=saturn&text=א&finals=1",
      "planet=saturn&text=א&finals=",
      "planet=saturn&text=א&rose=false",
      "planet=saturn&text=א&version=gd",
      // Words a row: fewer than the words, as a whole number.
      "planet=saturn&text=א&columns=1",
      "planet=venus&text=בני שרפים&columns=2",
      "planet=venus&text=בני שרפים&columns=0",
      "planet=venus&text=בני שרפים&columns=01",
      "planet=venus&text=בני שרפים&columns=1.5",
      "planet=venus&text=בני שרפים&columns=",
    ])
      expect(() => parse("kamea-sigil", query)).toThrow(
        InvalidComponentImageRequest,
      );
    expect(CONTRACTS["kamea-sigil"].personal).toBe(true);
    expect(CONTRACTS["kamea-sigil"].indexed).toBe(false);
    for (const [query, name] of [
      ["planet=saturn&text=אגיאל", "kamea-sigil-saturn-אגיאל"],
      ["planet=venus&text=בני שרפים", "kamea-sigil-venus-בני-שרפים"],
      ["planet=luna&text=אלים&finals=true", "kamea-sigil-luna-אלים-finals"],
    ])
      expect(
        CONTRACTS["kamea-sigil"].filename(parse("kamea-sigil", query)),
      ).toBe(name);
  });

  it("frames a kamea sigil's words as the package draws them", () => {
    const contract = CONTRACTS[
      "kamea-sigil"
    ] as unknown as ComponentImageContract<
      ImageDimensions & { planet: string; text: string }
    >;
    for (const [planet, text, viewBox] of [
      ["saturn", "אגיאל", [-50, -50, 100, 100]],
      ["venus", "בני שרפים", [-150, -50, 200, 100]],
      ["luna", "מלכא בתרשיתים עד ברוח שחקים", [-450, -50, 500, 100]],
    ] as const) {
      const props = parse("kamea-sigil", `planet=${planet}&text=${text}`);
      expect(contractViewBox(contract, props)).toEqual(viewBox);
      expect(
        renderToStaticMarkup(
          createElement(KameaSigilImage, { planet, text: props.text }),
        ),
      ).toContain(`viewBox="${viewBox.join(" ")}"`);
    }
    // In rows: a full row's width, a square's height a row.
    for (const [planet, text, columns, viewBox] of [
      ["venus", "בני שרפים", 1, [-50, -50, 100, 200]],
      ["luna", "מלכא בתרשיתים עד ברוח שחקים", 2, [-150, -50, 200, 300]],
      ["luna", "מלכא בתרשיתים עד ברוח שחקים", 3, [-250, -50, 300, 200]],
    ] as const) {
      const props = parse(
        "kamea-sigil",
        `planet=${planet}&text=${text}&columns=${columns}`,
      );
      expect(contractViewBox(contract, props)).toEqual(viewBox);
      expect(
        renderToStaticMarkup(
          createElement(KameaSigilImage, {
            planet,
            text: props.text,
            columns,
          }),
        ),
      ).toContain(`viewBox="${viewBox.join(" ")}"`);
    }
    expect(
      contractRasterDefault(
        contract,
        parse("kamea-sigil", "planet=venus&text=בני שרפים"),
      ),
    ).toEqual({ width: 2048, height: 1024 });
  });

  it("offers the rose's versions, the Golden Dawn's by default", () => {
    expect([...ROSE_IMAGE_VERSIONS]).toEqual([...ROSE_VERSIONS]);
    expect(parse("rose-sigil", "text=גדי").version).toBe("gd");
    expect(
      componentImageQuery({
        slug: "rose-sigil",
        props: parse("rose-sigil", "text=גדי&version=gd"),
      }).toString(),
    ).toBe(new URLSearchParams({ text: "גדי" }).toString());
    expect(
      CONTRACTS["rose-sigil"].filename(
        parse("rose-sigil", "text=כתר&version=regardie1939"),
      ),
    ).toBe("rose-sigil-כתר-regardie1939");
    for (const query of [
      "text=א&version=regardie",
      "text=א&version=Regardie1939",
      "text=א&version=equinox1910",
    ])
      expect(() => parse("rose-sigil", query)).toThrow(
        InvalidComponentImageRequest,
      );
  });

  it("names the 72 angels by their pages' slugs, and the styles as the package does", () => {
    // Written out so that the contracts do not import the angels.
    expect([...ANGEL_SIGIL_SLUGS]).toEqual(
      angels.map((angel) => angelSlug(angel.no)),
    );
    expect(new Set(ANGEL_SIGIL_SLUGS).size).toBe(72);
    expect([...ANGEL_SIGIL_STYLES]).toEqual([...SIGIL_STYLES]);
    // Lenain cites no psalm for Jabamiah alone (#70), whose talisman
    // letters Genesis 1:1 (plan 096, decision 8).
    expect([...ANGEL_SIGIL_GENESIS_VERSE]).toEqual(
      angels
        .filter((angel) => angel.psalm.psalm === 0 || !angel.psalm.la)
        .map((angel) => angelSlug(angel.no)),
    );
    expect([...ANGEL_SIGIL_GENESIS_VERSE]).toEqual(["jabamiah"]);
  });

  it("draws an angel's sigil from its slug and style alone, the band by default", () => {
    expect(parse("angel-sigil", "angel=vehuiah")).toEqual({
      angel: "vehuiah",
      style: "band",
    });
    expect(parse("angel-sigil", "angel=mumiah&style=")).toEqual({
      angel: "mumiah",
      style: "band",
    });
    expect(
      componentImageQuery({
        slug: "angel-sigil",
        props: parse("angel-sigil", "style=band&angel=vehuiah"),
      }).toString(),
    ).toBe("angel=vehuiah");
    expect(
      componentImageQuery(
        {
          slug: "angel-sigil",
          props: parse("angel-sigil", "width=512&style=talisman&angel=ariel"),
        },
        { format: "png" },
      ).toString(),
    ).toBe("fmt=png&angel=ariel&style=talisman&width=512");
    for (const query of [
      "",
      "angel=",
      "style=bare",
      "angel=Vehuiah",
      "angel=lauviah",
      "angel=lauviah-12",
      "angel=constructor",
      "angel=__proto__",
      "angel=vehuiah&angel=jeliel",
      "angel=vehuiah&style=Band",
      "angel=vehuiah&style=lamen",
      "angel=vehuiah&style=band&style=bare",
      "angel=vehuiah&text=%D7%90",
      "angel=vehuiah&legend=x",
      "angel=vehuiah&roman=x",
      "angel=vehuiah&version=regardie1939",
      "angel=vehuiah&rose=false",
      "angel=vehuiah&width=4097",
    ])
      expect(() => parse("angel-sigil", query), query).toThrow(
        InvalidComponentImageRequest,
      );
    const contract = CONTRACTS["angel-sigil"];
    expect(contract.personal).toBe(false);
    // The files under the angels' pages are the copies to index.
    expect(contract.indexed).toBe(false);
    expect(contract.keys).toEqual(["angel", "style"]);
    expect(contract.viewBox).toEqual(sigilViewBox(1));
    expect(contract.rasterDefault).toEqual({ width: 1024, height: 1024 });
    expect(
      ANGEL_SIGIL_STYLES.map((style) =>
        contract.filename(parse("angel-sigil", `angel=sitael&style=${style}`)),
      ),
    ).toEqual([
      "sitael-rose-cross-sigil-band",
      "sitael-rose-cross-sigil-bare",
      // The rose's file, as plan 088 named it.
      "sitael-rose-cross-sigil",
      "sitael-rose-cross-sigil-talisman",
    ]);
    expect(angelSigilFileBase("lauviah-11", "band")).toBe(
      "lauviah-11-rose-cross-sigil-band",
    );
  });

  it("rejects unknown tablets and keys on the new slugs", () => {
    for (const [slug, query] of [
      ["enochian-tablet", "id=Union"],
      ["enochian-tablet", "id=union&version=dee"],
      ["enochian-tablet", "id=Earth"],
      ["enochian-tablet", "font=Enochian"],
      ["enochian-tablet", "font=hebrew"],
      ["enochian-tablet", "version=Dee"],
      ["enochian-tablet", "version=golden"],
      ["table-of-shewbread", "font=enochian"],
      ["seven-branched-candlestick", "id=earth"],
      ["astro-geomancy-chart", "m=1211111221111212&m=1211111221111212"],
      ["astro-geomancy-chart", "mothers=1211111221111212"],
    ] as const)
      expect(() => parse(slug, query)).toThrow(InvalidComponentImageRequest);
  });

  it("derives the missing raster axis from each viewBox inside the pixel limit", () => {
    const box = [-50, -50, 100, 100] as const;
    expect(parseDimensions(new URLSearchParams("width=300"), box)).toEqual({
      width: 300,
    });
    expect(parseDimensions(new URLSearchParams(""), box)).toEqual({});
    expect(
      parseDimensions(new URLSearchParams("width=2048&height=2048"), box),
    ).toEqual({ width: 2048, height: 2048 });
    expect(() =>
      parseDimensions(new URLSearchParams("width=2049&height=2049"), box),
    ).toThrow(InvalidComponentImageRequest);
    // A square box derives the same size for the other axis.
    expect(() =>
      parseDimensions(new URLSearchParams("width=2049"), box),
    ).toThrow(InvalidComponentImageRequest);
    // A tall box derives a narrow width: 1024 by 4096 is exactly the pixel limit.
    expect(
      parseDimensions(new URLSearchParams("height=4096"), [0, 0, 1, 4]),
    ).toEqual({ height: 4096 });
    expect(() =>
      parseDimensions(new URLSearchParams("height=4096"), [0, 0, 1, 2]),
    ).toThrow(InvalidComponentImageRequest);
    expect(() =>
      parseDimensions(new URLSearchParams("width=4096"), [0, 0, 1, 2]),
    ).toThrow(InvalidComponentImageRequest);
    expect(DIMENSION_LIMITS).toEqual({ axis: 4096, pixels: 4_194_304 });
  });
});
