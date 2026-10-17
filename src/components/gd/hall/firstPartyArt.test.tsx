import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultHallArt } from "./art";
import { TABLET_ELEMENTS, tabletArt } from "./art/symbols";
import { romanNumeral, TRUMPS } from "./art/tarotKey";
import { GdHall } from "./GdHall";
import type { HallArt, HallArtProps, HallNode } from "./types";
import { validateHall } from "./validate";

const draw = (art: HallArt, node: HallNode, id = "t") => {
  const box = typeof art.box === "function" ? art.box(node) : art.box;
  const props: HallArtProps = {
    node,
    box,
    unitsPerSquare: 50,
    labelSize: 0.43,
    defId: (name) => `${id}-${name}`,
  };
  return renderToStaticMarkup(
    <svg aria-hidden="true">
      <art.Component {...props} />
    </svg>,
  );
};
const art = (key: string) => defaultHallArt.get(key) as HallArt;
const hall = (...children: unknown[]): HallNode =>
  ({ type: "gdHall", children: [{ type: "floor", children }] }) as HallNode;

describe("the pantacle", () => {
  it("rings the Earth disc with SAPERE AUDE and the Earth's names", () => {
    const markup = draw(art("item:pantacle"), { type: "item" });
    expect(markup).toContain(">SAPERE AUDE</textPath>");
    // Hebrew is set in visual order with bidi overridden.
    for (const name of [
      "אדני",
      "אוריאל",
      "כרוב",
      "פרת",
      "צפון",
      "פורלאך",
      "ארץ",
    ])
      expect(markup).toContain(`>${[...name].reverse().join("")}</textPath>`);
    expect(markup).toContain('unicode-bidi="bidi-override"');
    for (const colour of ["#a9aa66", "#444f41", "#2c2b29", "#8f5642"])
      expect(markup).toContain(`fill="${colour}"`);
  });

  it("names its ring path from the hall's ids, so two can share a page", () => {
    const markup = renderToStaticMarkup(
      <div>
        <GdHall hall={hall({ type: "item", kind: "pantacle", x: 4, y: 4 })} />
        <GdHall hall={hall({ type: "item", kind: "pantacle", x: 4, y: 4 })} />
      </div>,
    );
    const ids = [...markup.matchAll(/<path id="([^"]+)"/g)].map(([, id]) => id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(markup).toContain(`href="#${id}"`);
  });
});

describe("the lightning flash", () => {
  it("is plain geometry, with no SVG marker", () => {
    const markup = draw(art("item:lightning"), { type: "item" });
    expect(markup).toContain("<polyline");
    expect(markup).toContain("<polygon");
    expect(markup).not.toMatch(/marker|href|\sid=/);
  });
});

describe("the tarot keys", () => {
  it("knows the 22 trumps by number", () => {
    expect([...TRUMPS.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 22 }, (_, n) => n),
    );
    expect(TRUMPS.get(0)).toEqual({
      numeral: "0",
      letter: "א",
      title: "The Fool",
    });
    expect(TRUMPS.get(21)).toEqual({
      numeral: "XXI",
      letter: "ת",
      title: "The Universe",
    });
    expect(TRUMPS.get(8)?.letter).toBe("ט");
  });

  it("writes Roman numerals as the cards do", () => {
    expect([0, 1, 4, 9, 14, 19, 21].map(romanNumeral)).toEqual([
      "0",
      "I",
      "IV",
      "IX",
      "XIV",
      "XIX",
      "XXI",
    ]);
  });

  it("draws the numeral, the letter and the title, wrapped", () => {
    const universe = draw(art("tarotKey"), { type: "tarotKey", n: 21 });
    expect(universe).toContain(">XXI</text>");
    expect(universe).toContain(">ת</text>");
    expect(universe).toContain(">The Universe</text>");
    const priestess = draw(art("tarotKey"), { type: "tarotKey", n: "2" });
    expect(priestess).toContain(">The High</text>");
    expect(priestess).toContain(">Priestess</text>");
  });

  it("draws a blank card for anything that is not a trump's number", () => {
    const blank = draw(art("tarotKey"), { type: "tarotKey" });
    expect(blank).not.toContain("<text");
    for (const n of [22, 2.5, -1, "abc"])
      expect(draw(art("tarotKey"), { type: "tarotKey", n }), String(n)).toBe(
        blank,
      );
  });

  it("validates n as a trump's number", () => {
    expect(
      validateHall(hall({ type: "tarotKey", n: 30 }), {
        art: defaultHallArt,
      }).map((d) => d.message),
    ).toEqual(["tarotKey: n=30 is outside 0–21 and is clamped"]);
  });
});

describe("the Enochian tablets", () => {
  it("draws Tablet on a board for each element with data", () => {
    for (const element of TABLET_ELEMENTS) {
      const markup = draw(art("tablet"), { type: "tablet", element });
      expect(markup, element).toContain('viewBox="-105 0 210 297"');
      expect(markup, element).not.toContain("border:");
    }
  });

  it("draws an empty board for an element without data", () => {
    for (const element of ["fire", "constructor", undefined]) {
      const markup = draw(art("tablet"), { type: "tablet", element });
      expect(markup, String(element)).toContain("<rect");
      expect(markup, String(element)).not.toContain("<svg xmlns");
    }
    expect(
      validateHall(hall({ type: "tablet", element: "fire" }), {
        art: defaultHallArt,
      }).map((d) => d.message),
    ).toEqual(['tablet: element="fire" is not one of earth, air']);
  });

  it("takes the Enochian font from the app, and the transliteration without", () => {
    const plain = draw(art("tablet"), { type: "tablet", element: "air" });
    expect(plain).not.toContain("Enochian");
    const styled = draw(tabletArt({ fontFamily: "Enochian" }), {
      type: "tablet",
      element: "air",
    });
    expect(styled).toContain("font-family:Enochian");
  });
});

describe("the Shewbread and the candlestick", () => {
  it("give each diagram a 100-unit viewport centred on the origin", () => {
    for (const key of ["shewbread", "candlestick"]) {
      const markup = draw(art(key), { type: key });
      expect(markup, key).toContain(
        '<svg x="-50" y="-50" width="100" height="100" viewBox="0 0 100 100">',
      );
      expect(markup, key).toContain('viewBox="-50 -50 100 100"');
    }
  });
});
