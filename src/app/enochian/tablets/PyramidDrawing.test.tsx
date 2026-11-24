import { createHash } from "node:crypto";
import { tabletPyramids } from "magick-data/enochian/tabletPyramids";
import tablets, { tabletVersion } from "magick-data/enochian/tablets";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PyramidDrawing from "./PyramidDrawing";

const VERSIONS = ["gd", "regardie", "equinox"] as const;
const TABLETS = ["earth", "air", "water", "fire", "union"] as const;

describe("the Squares tab's large pyramid", () => {
  // Every square of every tablet in each version with pyramids, upright
  // and facing out: the drawing as reviewed on 23 November 2026 (plan
  // 095, stage 2). Its marks moved into magick-components for the whole
  // tablet's symbols (the follow-up "Symbols on the sides") without
  // moving a byte here; a change on purpose records a new digest.
  it("draws every square as it was reviewed", () => {
    const hash = createHash("sha256");
    let drawn = 0;
    for (const version of VERSIONS)
      for (const id of TABLETS) {
        const view = tabletVersion(tablets[id], version);
        if (!view) throw new Error(`${id} ${version}`);
        for (const pyramid of tabletPyramids(view))
          for (const outward of [false, true]) {
            const letter = view.grid[pyramid.row]?.[pyramid.column] ?? "";
            hash.update(
              renderToStaticMarkup(
                <PyramidDrawing
                  pyramid={pyramid}
                  letter={letter}
                  outward={outward}
                />,
              ),
            );
            drawn++;
          }
      }
    expect(drawn).toBe(3 * (4 * 156 + 20) * 2);
    expect(hash.digest("hex")).toBe(
      "82c4348b4eabfab20f2b7f10522aa5764ed98d7262ece1cdd9cee4f43b9129a6",
    );
  });
});
