// @vitest-environment jsdom
import { createHash } from "node:crypto";
import { PYRAMID_SYMBOL_TURNS } from "magick-components/enochian/pyramidMarks";
import { tabletPyramids } from "magick-data/enochian/tabletPyramids";
import tablets, { tabletVersion } from "magick-data/enochian/tablets";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PyramidDrawing from "./PyramidDrawing";

const VERSIONS = ["gd", "regardie", "equinox"] as const;
const TABLETS = ["earth", "air", "water", "fire", "union"] as const;

describe("the Squares tab's large pyramid", () => {
  /** A digest of every square of every tablet in each version. */
  const digest = (upright: boolean) => {
    const hash = createHash("sha256");
    let drawn = 0;
    for (const version of VERSIONS)
      for (const id of TABLETS) {
        const view = tabletVersion(tablets[id], version);
        if (!view) throw new Error(`${id} ${version}`);
        for (const pyramid of tabletPyramids(view)) {
          const letter = view.grid[pyramid.row]?.[pyramid.column] ?? "";
          hash.update(
            renderToStaticMarkup(
              <PyramidDrawing
                pyramid={pyramid}
                letter={letter}
                upright={upright}
              />,
            ),
          );
          drawn++;
        }
      }
    expect(drawn).toBe(3 * (4 * 156 + 20));
    return hash.digest("hex");
  };

  // Every square upright: the drawing as reviewed on 23 November 2026
  // (plan 095, stage 2). Its marks moved into magick-components for the
  // whole tablet's symbols (the follow-up "Symbols on the sides") without
  // moving a byte here, and standing the outward symbols on their bases
  // (26 November 2026) moved none either. Until then one digest covered
  // both drawings, 82c4348b…129a6.
  it("draws every square upright as it was reviewed", () => {
    expect(digest(true)).toBe(
      "bb3e7bd1fe8f12f2ba8b35f812d6ef93ebf52180820a6dad51e38c26d74aef60",
    );
  });

  // Every square outward, each symbol on its side's outer edge, head
  // toward the top, as Regardie's drawings have them (vol. 4, pp.294 and
  // 296): the correction of 26 November 2026 (plan 095, "Symbols on the
  // sides"), which turned each side's mark half round and moved nothing
  // else. A change on purpose records a new digest.
  it("draws every square outward as it was corrected", () => {
    expect(digest(false)).toBe(
      "8dbb30c502abb58e75771fc6c5a3ffb3c471efb87dbfaabc08934ce2df65884c",
    );
  });

  it("stands each outward symbol on its side's outer edge, head toward the top", () => {
    const view = tabletVersion(tablets.air, "gd");
    if (!view) throw new Error("air gd");
    const [pyramid] = tabletPyramids(view);
    const page = document.createElement("div");
    page.innerHTML = renderToStaticMarkup(
      <PyramidDrawing pyramid={pyramid} letter="r" />,
    );
    const groups = [...page.querySelectorAll("[data-side] > g")];
    expect(groups).toHaveLength(4);
    // The square's centre is 120, 120; each mark's up, (0, -1), turned
    // by SVG's rotate in its y-down frame, points there from the mark.
    const heads = groups.map((group) => {
      const transform = group.getAttribute("transform") ?? "";
      const [, x, y] =
        /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(transform)?.map(Number) ?? [];
      const turn = Number(/rotate\((-?\d+)\)/.exec(transform)?.[1]);
      const r = (turn * Math.PI) / 180;
      const head = [
        Math.round(Math.sin(r)) || 0,
        Math.round(-Math.cos(r)) || 0,
      ];
      const toCentre = [Math.sign(120 - x) || 0, Math.sign(120 - y) || 0];
      return { turn, head, toCentre };
    });
    expect(heads.map(({ turn }) => turn)).toEqual([...PYRAMID_SYMBOL_TURNS]);
    for (const { head, toCentre } of heads) expect(head).toEqual(toCentre);
  });
});
