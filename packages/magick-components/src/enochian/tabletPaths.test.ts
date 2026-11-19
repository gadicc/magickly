import { tabletNames } from "magick-data/enochian/tabletNames";
import tablets, {
  tabletVersion,
  WATCHTOWER_IDS,
} from "magick-data/enochian/tablets";
import { describe, expect, it } from "vitest";
import { elementFromPosition, isCrossFromPosition } from "./tabletSvg.tsx";

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
