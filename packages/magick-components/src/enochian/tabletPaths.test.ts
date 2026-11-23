import { tabletNames } from "magick-data/enochian/tabletNames";
import { tabletRegion } from "magick-data/enochian/tabletPyramids";
import tablets, {
  tabletVersion,
  WATCHTOWER_IDS,
} from "magick-data/enochian/tablets";
import { describe, expect, it } from "vitest";
import {
  elementFromPosition,
  isCrossFromPosition,
  regionFromPosition,
} from "./tabletSvg.tsx";

// The drawing finds its crosses and quarters by position; the names
// (magick-data's tabletNames) read the same squares along their paths. The
// two must agree, or a highlighted name would cross the drawn colours.
describe("the drawing's crosses and quarters", () => {
  for (const id of WATCHTOWER_IDS)
    it(`agree with ${id}'s names`, () => {
      const view = tabletVersion(tablets[id]);
      if (!view) throw new Error(`no ${id}`);
      const cross = new Set<string>();
      const element = new Map<string, string>();
      for (const name of tabletNames(view))
        for (const { row, column } of name.squares) {
          const key = `${column},${row}`;
          if (
            !name.quarter ||
            name.kind === "crossColumn" ||
            name.kind === "crossRow"
          )
            cross.add(key);
          element.set(
            key,
            name.quarter ? (name.attribution?.element ?? "?") : "",
          );
        }
      expect(element.size).toBe(13 * 12);
      for (let y = 0; y < 13; y++)
        for (let x = 0; x < 12; x++) {
          const key = `${x},${y}`;
          expect(isCrossFromPosition(x, y), key).toBe(cross.has(key));
          expect(elementFromPosition(x, y), key).toBe(element.get(key));
        }
    });
});

// The regions the drawing tints are magick-data's (plan 095, decision 1),
// which calls the top row's squares Kerubic; the drawing's name for them,
// `topRow`, is its own, kept for its `data-region` and its callers.
describe("the drawing's regions", () => {
  it("are magick-data's region rule, square by square", () => {
    const named = { topRow: "kerubic" } as const;
    for (let row = 0; row < 13; row++)
      for (let column = 0; column < 12; column++) {
        const drawn = regionFromPosition(row, column);
        expect(
          drawn === "topRow" ? named[drawn] : drawn,
          `${row},${column}`,
        ).toBe(tabletRegion(row, column));
      }
  });
});
