import Kamea from "magick-components/astrology/Kamea";
import { KameaSigilImage } from "magick-components/astrology/KameaSigil";
import Tablet from "magick-components/enochian/Tablet";
import SevenBranchedCandlestick from "magick-components/gd/SevenBranchedCandlestick";
import TableOfShewbread from "magick-components/gd/TableOfShewbread";
import TreeOfLife from "magick-components/kabbalah/TreeOfLife";
import { type ComponentType, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { pathHref, sephirahHref } from "@/app/kabbalah/treeLinks";
import { CONTRACTS, type ComponentImageSlug } from "@/render/contracts";
import { COMPONENT_IMAGE_REGISTRY } from "@/render/registry";
import { COMPONENT_EXAMPLES } from "./components";
import { componentImage } from "./images";

/**
 * The image the explorer links must draw what the explorer draws: each
 * example's props, through the contract's query, rendered by the image
 * route's registry, give the markup the component gives the props
 * themselves. The Tree's flip is left out of both (the route mirrors the
 * outlined image instead), and the tablet's frame and label, a CSS border
 * and an accessible name that no image carries, are set as the route sets
 * them; the Tree takes the fixed root id the route gives it (its other
 * ids are stripped from the outlines), where the page's comes from `useId`,
 * and the links the route's source SVG carries, which outlining drops.
 * The kameas' numbers are set in the bundled Noto Serif the route
 * resolves, where the page's are in the browser's serif; and a kamea
 * sigil's image is the one-row `KameaSigilImage` of the figures the
 * explorer's `KameaSigil` wraps. A tablet's image is the flat one's or,
 * drawn as pyramids, the pyramids' own (plan 095, decision 5).
 */
const CASES: [
  (
    | "TreeOfLife"
    | "Tablet"
    | "SevenBranchedCandlestick"
    | "TableOfShewbread"
    | "Kamea"
    | "KameaSigil"
  ),
  // biome-ignore lint/suspicious/noExplicitAny: each takes its examples' props
  ComponentType<any>,
  readonly ComponentImageSlug[],
][] = [
  ["TreeOfLife", TreeOfLife, ["tree-of-life"]],
  ["Tablet", Tablet, ["enochian-tablet", "enochian-tablet-pyramids"]],
  [
    "SevenBranchedCandlestick",
    SevenBranchedCandlestick,
    ["seven-branched-candlestick"],
  ],
  ["TableOfShewbread", TableOfShewbread, ["table-of-shewbread"]],
  ["Kamea", Kamea, ["kamea"]],
  ["KameaSigil", KameaSigilImage, ["kamea-sigil"]],
];

describe.each(CASES)("%s's image", (name, live, slugs) => {
  const examples = COMPONENT_EXAMPLES[name].examples.filter(
    (example) =>
      componentImage(name, example.props as Record<string, unknown>) !== null,
  );
  const slugOf = (path: string) =>
    new URL(path, "https://magick.ly").pathname.replace("/api/render/", "");

  it("is offered for some of its examples, under each of its slugs", () => {
    expect(examples.length).toBeGreaterThan(0);
    expect(
      new Set(
        examples.map((example) =>
          slugOf(
            componentImage(
              name,
              example.props as Record<string, unknown>,
            ) as string,
          ),
        ),
      ),
    ).toEqual(new Set(slugs));
  });

  it.each(examples.map((example) => [example.title, example]))(
    "draws %s as the component does",
    async (_title, example) => {
      const { flip: _flip, ...props } = example.props as Record<
        string,
        unknown
      >;
      const path = componentImage(name, props) as string;
      const slug = slugOf(path) as ComponentImageSlug;
      expect(slugs).toContain(slug);
      const query = new URL(path, "https://magick.ly").searchParams;
      const parsed = CONTRACTS[slug].parse(query);
      const registered = COMPONENT_IMAGE_REGISTRY[slug] as {
        render(props: unknown): unknown;
      };
      const image = renderToStaticMarkup(
        (await registered.render({ ...parsed, flip: false })) as never,
      );
      const own =
        name === "Tablet"
          ? { ...props, frame: false, label: false }
          : name === "TreeOfLife"
            ? { ...props, id: "TreeOfLife", sephirahHref, pathHref }
            : name === "Kamea" || name === "KameaSigil"
              ? { ...props, fontFamily: "Noto Serif" }
              : props;
      expect(image).toBe(renderToStaticMarkup(createElement(live, own)));
    },
  );
});
