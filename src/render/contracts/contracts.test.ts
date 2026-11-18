import { WATCHTOWER_VIEWBOX } from "magick-components/enochian/Tablet";
import RoseSigilImage from "magick-components/gd/RoseSigilImage";
import { ROSE_VERSIONS } from "magick-components/gd/roseSigilGeometry";
import { CANDLESTICK_VERSIONS } from "magick-components/gd/SevenBranchedCandlestick";
import { TABLET_VERSIONS } from "magick-data/enochian/tablets";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseComponentImageRequest } from "../componentImageRequest";
import { componentImageQuery } from "../componentImageUrl";
import {
  DEFAULT_MOTHERS,
  mothersFromString,
  mothersToString,
} from "./astroGeomancyChart";
import { TABLET_IMAGE_VERSIONS, TABLET_VIEWBOX } from "./enochianTablet";
import {
  COMPONENT_IMAGE_SLUGS,
  CONTRACTS,
  type ComponentImageSlug,
  InvalidComponentImageRequest,
  isComponentImageSlug,
} from "./index";
import {
  canonicalSigilText,
  ROSE_IMAGE_VERSIONS,
  rectifySigilText,
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
    // Sizes are PNG-only, so they round-trip in gdHall.test.ts.
    "gd-hall": ["", "hall=zelator-1", "hall=portal-2"],
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
    expect(rectifySigilText("שלום")).toBe("שלומ");
    expect(parse("rose-sigil", "text=שלום").text).toBe("שלומ");
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
    expect(CONTRACTS["astro-geomancy-chart"].personal).toBe(true);
    expect(CONTRACTS["tree-of-life"].personal).toBe(false);
    expect(
      CONTRACTS["rose-sigil"].filename(parse("rose-sigil", "text=גדי")),
    ).toBe("rose-sigil-גדי");
  });

  it("takes several words, each its own sigil (plan 088, R2)", () => {
    // Any whitespace between words, collapsed to one space and trimmed.
    expect(parse("rose-sigil", "text=יהוה  אלהים").text).toBe("יהוה אלהימ");
    expect(
      parse(
        "rose-sigil",
        `text=${encodeURIComponent(" יוד\tהא\nואו\u00a0הא ")}`,
      ).text,
    ).toBe("יוד הא ואו הא");
    expect(canonicalSigilText("יהוה אלהים")).toBe("יהוה אלהימ");
    expect(canonicalSigilText("  ")).toBeNull();
    // The bound counts letters, not spaces.
    const many = Array(SIGIL_MAX_LETTERS).fill("א").join(" ");
    expect(parse("rose-sigil", `text=${many}`).text).toBe(many);
    expect(
      componentImageQuery({
        slug: "rose-sigil",
        props: parse("rose-sigil", "text=יהוה  אלהים"),
      }).toString(),
    ).toBe(new URLSearchParams({ text: "יהוה אלהימ" }).toString());
    expect(
      CONTRACTS["rose-sigil"].filename(parse("rose-sigil", "text=יהוה אלהים")),
    ).toBe("rose-sigil-יהוה-אלהימ");
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
    for (const slug of COMPONENT_IMAGE_SLUGS) {
      const query = slug === "rose-sigil" ? "text=א&download=1" : "download=1";
      expect(() => parse(slug, query)).toThrow(InvalidComponentImageRequest);
    }
  });

  it("takes each request's viewBox from viewBoxOf, else the fixed one", () => {
    // The other contracts draw one shape and keep their fixed viewBox;
    // the halls and the sigil's words are not one shape.
    for (const slug of COMPONENT_IMAGE_SLUGS.filter(
      (slug) => slug !== "gd-hall" && slug !== "rose-sigil",
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

  it("draws the tablets on the page the component draws them on", () => {
    expect([...TABLET_VIEWBOX]).toEqual([...WATCHTOWER_VIEWBOX]);
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

  it("rejects unknown tablets and keys on the new slugs", () => {
    for (const [slug, query] of [
      ["enochian-tablet", "id=union"],
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
