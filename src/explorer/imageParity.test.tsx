import Tablet from "magick-components/enochian/Tablet";
import SevenBranchedCandleStick from "magick-components/gd/SevenBranchedCandleStick";
import TableOfShewbread from "magick-components/gd/TableOfShewbread";
import TreeOfLife from "magick-components/kabbalah/TreeOfLife";
import { type ComponentType, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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
 * ids are stripped from the outlines), where the page's comes from `useId`.
 */
const CASES: [
  "TreeOfLife" | "Tablet" | "SevenBranchedCandleStick" | "TableOfShewbread",
  // biome-ignore lint/suspicious/noExplicitAny: each takes its examples' props
  ComponentType<any>,
  ComponentImageSlug,
][] = [
  ["TreeOfLife", TreeOfLife, "tree-of-life"],
  ["Tablet", Tablet, "enochian-tablet"],
  [
    "SevenBranchedCandleStick",
    SevenBranchedCandleStick,
    "seven-branched-candlestick",
  ],
  ["TableOfShewbread", TableOfShewbread, "table-of-shewbread"],
];

describe.each(CASES)("%s's image", (name, live, slug) => {
  const examples = COMPONENT_EXAMPLES[name].examples.filter(
    (example) =>
      componentImage(name, example.props as Record<string, unknown>) !== null,
  );

  it("is offered for some of its examples", () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples.map((example) => [example.title, example]))(
    "draws %s as the component does",
    async (_title, example) => {
      const { flip: _flip, ...props } = example.props as Record<
        string,
        unknown
      >;
      const path = componentImage(name, props) as string;
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
            ? { ...props, id: "TreeOfLife" }
            : props;
      expect(image).toBe(renderToStaticMarkup(createElement(live, own)));
    },
  );
});
