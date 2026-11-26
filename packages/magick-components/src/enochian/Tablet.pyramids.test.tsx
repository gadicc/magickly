// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { tabletPyramids } from "magick-data/enochian/tabletPyramids";
import tablets, {
  TABLET_VERSIONS,
  tabletVersion,
} from "magick-data/enochian/tablets";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PYRAMID_SYMBOL_INKS,
  PYRAMID_SYMBOL_TURNS,
  type SideElement,
  sideSymbol,
} from "./pyramidMarks.tsx";
import Tablet, {
  PYRAMID_COLOURS,
  PYRAMID_TOP,
  PYRAMID_TOP_SYMBOLS,
  type TabletProps,
  type TabletSquare,
} from "./Tablet.tsx";

/** The drawing's markup, parsed. */
function drawn(props: TabletProps) {
  const markup = renderToStaticMarkup(<Tablet {...props} />);
  const page = document.createElement("div");
  page.innerHTML = markup;
  return { markup, page };
}

/** The letters drawn, in order, outside the sigils and the corner marks. */
const letters = (page: Element) =>
  [
    ...page.querySelectorAll(
      "svg[viewBox='0 0 244 264'] text, svg > text, svg > [data-pyramids] > text",
    ),
  ]
    .filter(
      (text) => !text.closest("[data-order]") && !text.hasAttribute("data-alt"),
    )
    .map((text) => text.textContent);

const PYRAMID_VERSIONS = ["gd", "regardie", "equinox"] as const;
const WATCHTOWERS = ["earth", "air", "water", "fire"] as const;

describe("Tablet's pyramids (plan 095, decision 4)", () => {
  it("is off by default", () => {
    for (const tablet of [...WATCHTOWERS, "union"]) {
      const plain = drawn({ tablet }).markup;
      expect(plain).not.toContain("data-pyramid");
      expect(drawn({ tablet, pyramids: false }).markup).toBe(plain);
      // A top size alone draws nothing different.
      expect(drawn({ tablet, pyramidTop: 0.3 }).markup).toBe(plain);
    }
  });

  it("colours every side of every square by its element, in each version that has them", () => {
    for (const version of PYRAMID_VERSIONS)
      for (const tablet of [...WATCHTOWERS, "union"] as const) {
        const view = tabletVersion(tablets[tablet], version);
        if (!view) throw new Error(`${tablet} ${version}`);
        const { page } = drawn({ tablet, version, pyramids: true });
        const squares = page.querySelectorAll("[data-pyramid]");
        // One lookup by square, rather than a selector each.
        const byKey = new Map(
          [...squares].map((square) => [
            square.getAttribute("data-pyramid"),
            square,
          ]),
        );
        const expected = tabletPyramids(view);
        expect(squares.length, `${tablet} ${version}`).toBe(
          tablet === "union" ? 20 : 156,
        );
        for (const pyramid of expected) {
          const square = byKey.get(`${pyramid.row},${pyramid.column}`);
          const sides = [...(square?.children ?? [])].filter(
            (child) => child.tagName === "polygon",
          );
          expect(sides.map((side) => side.getAttribute("data-side"))).toEqual([
            "1",
            "2",
            "3",
            "4",
          ]);
          sides.forEach((polygon, index) => {
            const element = pyramid.sides[index]?.elementId ?? "none";
            expect(polygon.getAttribute("data-element")).toBe(element);
            expect(polygon.getAttribute("style")).toContain(
              `fill:${PYRAMID_COLOURS[element as keyof typeof PYRAMID_COLOURS]}`,
            );
          });
        }
      }
  });

  it("draws the same letters, mirrored where the flat drawing mirrors them", () => {
    for (const tablet of [...WATCHTOWERS, "union"]) {
      const flat = drawn({ tablet }).page;
      const pyramids = drawn({ tablet, pyramids: true }).page;
      expect(letters(pyramids)).toEqual(letters(flat));
      const mirrored = (page: Element) =>
        [...page.querySelectorAll("text[transform]")].map(
          (text) => text.textContent,
        );
      expect(mirrored(pyramids)).toEqual(mirrored(flat));
      // The Tablet of Union reverses none.
      if (tablet !== "union") expect(mirrored(flat).length).toBeGreaterThan(0);
    }
  });

  it("draws Dee's and Raphael's tables flat, which carry no elements", () => {
    for (const version of TABLET_VERSIONS.filter(
      (each) => !(PYRAMID_VERSIONS as readonly string[]).includes(each),
    ))
      for (const tablet of [...WATCHTOWERS, "union"])
        expect(drawn({ tablet, version, pyramids: true }).markup).toBe(
          drawn({ tablet, version }).markup,
        );
  });

  it("draws no second letters on pyramids", () => {
    const flat = drawn({ tablet: "water", showSecondLetters: true }).markup;
    expect(flat).toContain("data-alt");
    expect(
      drawn({ tablet: "water", showSecondLetters: true, pyramids: true })
        .markup,
    ).not.toContain("data-alt");
  });

  it("sizes the flat top by pyramidTop, a half by default, within its range", () => {
    const topOf = (pyramidTop?: number) =>
      Number(
        drawn({ tablet: "air", pyramids: true, pyramidTop })
          .page.querySelector("[data-top]")
          ?.getAttribute("width"),
      );
    expect(PYRAMID_TOP).toBe(0.5);
    expect(topOf()).toBe(10);
    expect(topOf(0.25)).toBe(5);
    expect(topOf(0.05)).toBe(4);
    expect(topOf(2)).toBe(16);
    expect(topOf(Number.NaN)).toBe(10);
  });

  it("rings a previewed name and outlines squares over pyramids", () => {
    const { page } = drawn({
      tablet: "air",
      pyramids: true,
      highlights: {
        squares: [{ row: 2, column: 3 }],
        selected: { row: 2, column: 3 },
        preview: { squares: [{ row: 0, column: 0 }] },
      },
    });
    expect(page.querySelector('[data-highlight="preview"]')).not.toBeNull();
    expect(page.querySelector('[data-square="2,3"]')).not.toBeNull();
  });

  it("leaves the rules out of the drawing the halls' art shares", () => {
    // The entry passes `tabletPyramids` in; the drawing imports only its
    // type, so the halls, which draw no pyramids, load none of it.
    const drawing = readFileSync(
      // From the repository's root, as the import boundary's test reads.
      path.resolve("packages/magick-components/src/enochian/tabletSvg.tsx"),
      "utf8",
    );
    const imports = [
      ...drawing.matchAll(/^import (type )?[^;]*?from "([^"]+)";/gms),
    ];
    expect(
      imports
        .filter(([, , from]) => from === "magick-data/enochian/tabletPyramids")
        .map(([, type]) => type),
    ).toEqual(["type "]);
    // Nor the symbols' marks, nor the data they read: the entry passes
    // the marks in too.
    expect(
      imports
        .map(([, , from]) => from)
        .filter(
          (from) =>
            from.includes("pyramidMarks") ||
            (from.startsWith("magick-data/") &&
              from !== "magick-data/enochian/tabletPyramids" &&
              from !== "magick-data/enochian/tablets"),
        ),
    ).toEqual([]);
  });

  it("keeps the symbols' turns, which the drawing imports, free of imports", () => {
    // `tabletSvg.tsx` reads `PYRAMID_SYMBOL_TURNS` from its own module so
    // that the halls' art loads none of the marks' data; an import there
    // would bring some back.
    const turns = readFileSync(
      path.resolve(
        "packages/magick-components/src/enochian/pyramidSymbolTurns.ts",
      ),
      "utf8",
    );
    expect(turns).toContain("export const PYRAMID_SYMBOL_TURNS");
    expect(turns).not.toMatch(/^\s*import\b/m);
    expect(turns).not.toMatch(/\bimport\s*\(|\brequire\s*\(/);
    expect(turns).not.toMatch(/^\s*export\s[^;]*\bfrom\s/m);
  });

  it("tints the regions over pyramids, and keeps a chosen name's marks", () => {
    const { page } = drawn({
      tablet: "fire",
      pyramids: true,
      highlights: {
        squares: [],
        regions: true,
        name: { squares: [{ row: 6, column: 0 }], numbers: [1] },
      },
    });
    expect(page.querySelector('[data-region="greatCross"]')).not.toBeNull();
    expect(page.querySelector('[data-region="topRow"]')).not.toBeNull();
    expect(page.querySelector('[data-highlight="name"]')).not.toBeNull();
    expect(page.querySelector("[data-start]")).not.toBeNull();
    expect(page.querySelector('[data-order="1"]')).not.toBeNull();
  });
});

describe("Tablet's pyramids with their symbols (plan 095, Symbols on the sides)", () => {
  /** The marks drawn, by square and side, with their transforms. */
  const marks = (page: Element) => [...page.querySelectorAll("[data-symbol]")];

  it("draws nothing different without pyramids, or without the prop", () => {
    for (const tablet of [...WATCHTOWERS, "union"]) {
      const plain = drawn({ tablet }).markup;
      for (const pyramidSymbols of ["outward", "upright"] as const)
        expect(drawn({ tablet, pyramidSymbols }).markup).toBe(plain);
      expect(drawn({ tablet, pyramids: true }).markup).not.toContain(
        "data-symbol",
      );
    }
  });

  it("draws Dee's and Raphael's tables flat, symbols or not", () => {
    for (const version of ["dee", "raphael"])
      expect(
        drawn({
          tablet: "fire",
          version,
          pyramids: true,
          pyramidSymbols: "outward",
        }).markup,
      ).toBe(drawn({ tablet: "fire", version }).markup);
  });

  it("draws every side's own symbol in its inks, in each version", () => {
    for (const version of PYRAMID_VERSIONS)
      for (const tablet of [...WATCHTOWERS, "union"] as const) {
        const view = tabletVersion(tablets[tablet], version);
        if (!view) throw new Error(`${tablet} ${version}`);
        const { page } = drawn({
          tablet,
          version,
          pyramids: true,
          pyramidSymbols: "upright",
        });
        const squares = tablet === "union" ? 20 : 156;
        expect(marks(page), `${tablet} ${version}`).toHaveLength(squares * 4);
        // One lookup by square and side, rather than a selector each.
        const byKey = new Map(
          marks(page).map((mark) => [
            `${mark.parentElement?.getAttribute("data-pyramid")}/${mark.getAttribute("data-symbol")}`,
            mark,
          ]),
        );
        for (const pyramid of tabletPyramids(view)) {
          pyramid.sides.forEach((side, index) => {
            const mark = byKey.get(
              `${pyramid.row},${pyramid.column}/${side.side}`,
            );
            const where = `${tablet} ${version} ${pyramid.row},${pyramid.column} ${index + 1}`;
            expect(mark, where).toBeTruthy();
            const symbol = sideSymbol(side);
            const inks =
              PYRAMID_SYMBOL_INKS[
                (side.elementId as SideElement | undefined) ?? "none"
              ];
            if (symbol.kind === "text")
              expect(mark?.querySelector("text")?.textContent, where).toBe(
                symbol.text,
              );
            else if (symbol.kind === "figure")
              expect(mark?.querySelectorAll("circle").length, where).toBe(
                symbol.rows.reduce((sum, count) => sum + count, 0),
              );
            else
              expect(mark?.querySelector("path, circle"), where).not.toBeNull();
            expect(mark?.innerHTML.includes(inks.ink), where).toBe(true);
          });
        }
      }
  });

  it("puts each in the middle of its band, on its outer edge unless upright", () => {
    const transforms = (pyramidSymbols: "outward" | "upright") =>
      marks(drawn({ tablet: "air", pyramids: true, pyramidSymbols }).page)
        .slice(0, 4)
        .map((mark) => mark.getAttribute("transform"));
    // The first square's, at the top third's default: its band 6.667 deep
    // from the square's edge (2, 2 on the grid), the mark's 34 units
    // scaled to 78% of it.
    expect(transforms("outward")).toEqual([
      "translate(5.333 12) scale(0.153) rotate(90)",
      "translate(12 5.333) scale(0.153) rotate(180)",
      "translate(18.667 12) scale(0.153) rotate(-90)",
      "translate(12 18.667) scale(0.153) rotate(0)",
    ]);
    expect(transforms("upright")).toEqual([
      "translate(5.333 12) scale(0.153)",
      "translate(12 5.333) scale(0.153)",
      "translate(18.667 12) scale(0.153)",
      "translate(12 18.667) scale(0.153)",
    ]);
  });

  // Regardie's drawings stand each symbol on its side's outer edge, its
  // head toward the flat top (vol. 4, pp.294 and 296, leaves n286 and
  // n288): the mark's up, (0, -1), turned as SVG turns it in its y-down
  // frame, must point from the mark toward the square's centre.
  it("stands each outward mark on its side's outer edge, head toward the top", () => {
    expect(Object.isFrozen(PYRAMID_SYMBOL_TURNS)).toBe(true);
    expect(PYRAMID_SYMBOL_TURNS).toEqual([90, 180, -90, 0]);
    /** An upright mark's up, (0, -1), as `rotate(degrees)` turns it. */
    const head = (degrees: number) => {
      const r = (degrees * Math.PI) / 180;
      // rotate(a) maps (x, y) to (x cos a - y sin a, x sin a + y cos a).
      // `|| 0` folds -0 into 0, which toEqual tells apart.
      return [Math.round(Math.sin(r)) || 0, Math.round(-Math.cos(r)) || 0];
    };
    const { page } = drawn({
      tablet: "air",
      pyramids: true,
      pyramidSymbols: "outward",
    });
    const squares = [...page.querySelectorAll("[data-pyramid]")];
    expect(squares).toHaveLength(156);
    for (const square of squares) {
      const sides = [...square.querySelectorAll("[data-side]")];
      // The square's centre, from its four corners' outlines.
      const corners = sides.flatMap((side) =>
        (side.getAttribute("points") ?? "")
          .split(" ")
          .map((point) => point.split(",").map(Number)),
      );
      const xs = corners.map(([x]) => x);
      const ys = corners.map(([, y]) => y);
      const centre = [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ];
      const marks = [...square.querySelectorAll("[data-symbol]")];
      expect(marks).toHaveLength(4);
      marks.forEach((mark, index) => {
        const transform = mark.getAttribute("transform") ?? "";
        const [, x, y] =
          /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(transform)?.map(Number) ??
          [];
        const turn = Number(/rotate\((-?\d+)\)/.exec(transform)?.[1]);
        expect(turn).toBe(PYRAMID_SYMBOL_TURNS[index]);
        const toCentre = [
          Math.sign(Math.round((centre[0] - x) * 1000)) || 0,
          Math.sign(Math.round((centre[1] - y) * 1000)) || 0,
        ];
        expect(
          head(turn),
          `${square.getAttribute("data-pyramid")} side ${index + 1}`,
        ).toEqual(toCentre);
      });
    }
  });

  it("draws them over the sides and under the tops, borders and letters", () => {
    const { markup } = drawn({
      tablet: "earth",
      pyramids: true,
      pyramidSymbols: "outward",
      highlights: { squares: [], regions: true },
    });
    const lastMark = markup.lastIndexOf("data-symbol=");
    expect(lastMark).toBeGreaterThan(markup.lastIndexOf("<polygon"));
    expect(lastMark).toBeLessThan(markup.indexOf("data-top"));
    expect(lastMark).toBeLessThan(markup.indexOf("data-region="));
  });

  it("makes the top a third by default with symbols, unless pyramidTop says", () => {
    const topOf = (props: Partial<TabletProps>) =>
      Number(
        drawn({ tablet: "air", pyramids: true, ...props })
          .page.querySelector("[data-top]")
          ?.getAttribute("width"),
      );
    expect(PYRAMID_TOP_SYMBOLS).toBe(1 / 3);
    expect(topOf({ pyramidSymbols: "outward" })).toBe(6.667);
    expect(topOf({ pyramidSymbols: "upright" })).toBe(6.667);
    expect(topOf({ pyramidSymbols: "upright", pyramidTop: 0.25 })).toBe(5);
    expect(topOf({})).toBe(10);
  });
});

let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

function mount(element: React.ReactElement) {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  const created = createRoot(container);
  root = created;
  act(() => created.render(element));
  return container;
}

const click = (element: Element | null | undefined) =>
  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

describe("Tablet's pyramids chosen by pointer", () => {
  it("calls onSelect from a square's border or its top", () => {
    for (const tablet of ["earth", "union"]) {
      const onSelect = vi.fn<(square: TabletSquare) => void>();
      const page = mount(
        <Tablet
          tablet={tablet}
          pyramids
          highlights={{ squares: [], anySquare: true, onSelect }}
        />,
      );
      const square = page.querySelector('[data-pyramid="2,3"]');
      expect(square, tablet).not.toBeNull();
      // The sides take no click of their own: the border drawn over them
      // takes it for the whole square.
      const border = [...page.querySelectorAll('rect[width="20"]')].find(
        (rect) => (rect as SVGElement).style.pointerEvents === "all",
      );
      const top =
        page.querySelectorAll("[data-top]")[
          2 * (tablet === "union" ? 5 : 12) + 3
        ];
      click(border);
      click(top);
      expect(onSelect.mock.calls.map(([each]) => each)).toEqual([
        { row: 0, column: 0 },
        { row: 2, column: 3 },
      ]);
      act(() => root?.unmount());
      container?.remove();
      root = undefined;
    }
  });
});
