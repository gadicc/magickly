import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultHallArt } from "./art";
import { TABLET_ELEMENTS, tabletArt } from "./art/symbols";
import { romanNumeral, TRUMPS } from "./art/tarotKey";
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
  /** The ring's letters in the markup, each with its rotation. */
  const ring = (markup: string) =>
    [
      ...markup.matchAll(
        /<text y="-42.6" transform="rotate\(([-\d.]+)\)">([^<]+)<\/text>/g,
      ),
    ].map(([, angle, char]) => ({ angle: Number(angle) - 90, char }));

  it("rings the Earth disc with SAPERE AUDE and the Earth's names", () => {
    const markup = draw(art("item:pantacle"), { type: "item" });
    // Clockwise from a gap just past the bottom of the ring.
    const clockwise = ring(markup)
      .map((glyph) => ({ ...glyph, angle: (glyph.angle - 112.5 + 720) % 360 }))
      .sort((a, b) => a.angle - b.angle)
      .map((glyph) => glyph.char)
      .join("");
    // SAPERE AUDE reads clockwise at the top; the names read on from it
    // anticlockwise, the Hebrew direction, each letter after the last.
    const anticlockwise = [...clockwise].reverse().join("");
    expect(clockwise).toContain("SAPEREAUDE");
    expect(anticlockwise).toBe("פרתצפוןפורלאךארץEDUAEREPASאדניאוריאלכרוב");
    for (const colour of ["#a9aa66", "#444f41", "#2c2b29", "#8f5642"])
      expect(markup).toContain(`fill="${colour}"`);
  });

  it("draws each letter alone, so every renderer keeps their order", () => {
    // resvg reverses Hebrew laid along a path, rsvg draws no textPath:
    // no path, no bidi override and no ids to share.
    const markup = draw(art("item:pantacle"), { type: "item" });
    expect(markup).not.toMatch(/textPath|unicode-bidi|direction=|\sid=|href/);
    const glyphs = ring(markup);
    expect(glyphs).toHaveLength(40);
    for (const glyph of glyphs) expect([...glyph.char]).toHaveLength(1);
    // Neighbours stand an advance apart, never on top of each other.
    const sorted = glyphs.map((glyph) => glyph.angle).sort((a, b) => a - b);
    for (const [index, angle] of sorted.slice(1).entries())
      expect(angle - sorted[index]).toBeGreaterThan(2.5);
  });
});

describe("the lightning flash", () => {
  it("is plain geometry, with no SVG marker", () => {
    const markup = draw(art("item:lightning"), { type: "item" });
    expect(markup).toContain("<polyline");
    expect(markup).toContain("<polygon");
    expect(markup).not.toMatch(/marker|href|\sid=/);
  });

  it("takes a named colour, so it shows on the black altar", () => {
    const yellow = draw(art("item:lightning"), {
      type: "item",
      stroke: "yellow",
    });
    expect(yellow).toContain('stroke="#ffe000"');
    expect(yellow).toContain('fill="#ffe000"');
    expect(
      draw(art("item:lightning"), { type: "item", stroke: "url(#x)" }),
    ).toBe(draw(art("item:lightning"), { type: "item" }));
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
