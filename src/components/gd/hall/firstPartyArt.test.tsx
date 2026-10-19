import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defaultHallArt } from "./art";
import { TABLET_ELEMENTS, tabletArt } from "./art/symbols";
import { romanNumeral, TRUMPS } from "./art/tarotKey";
import { resolveHall } from "./layout";
import type { HallArt, HallArtProps, HallNode } from "./types";
import { validateHall } from "./validate";

const draw = (art: HallArt, node: HallNode, id = "t") => {
  const box = typeof art.box === "function" ? art.box(node) : art.box;
  const props: HallArtProps = {
    node,
    box,
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

  it("draws a blank card without a number", () => {
    const blank = draw(art("tarotKey"), { type: "tarotKey" });
    expect(blank).not.toContain("<text");
    for (const n of ["abc", Number.NaN, "1e999"])
      expect(draw(art("tarotKey"), { type: "tarotKey", n }), String(n)).toBe(
        blank,
      );
  });

  it("clamps and rounds n as the validator warns", () => {
    const key = (n: number | string) =>
      draw(art("tarotKey"), { type: "tarotKey", n });
    expect(key(22)).toBe(key(21));
    expect(key(-1)).toBe(key(0));
    expect(key(2.5)).toBe(key(3));
    expect(key("2.4")).toBe(key(2));
    expect(key(2.5)).toContain(">The Empress</text>");
    expect(
      validateHall(
        hall(
          { type: "tarotKey", n: 30 },
          { type: "tarotKey", n: 2.5 },
          { type: "tarotKey", n: -0.5 },
          { type: "tarotKey", n: 21 },
        ),
        { art: defaultHallArt },
      ).map((d) => [d.severity, d.message]),
    ).toEqual([
      ["warning", "tarotKey: n=30 is outside 0–21 and is clamped"],
      ["warning", "tarotKey: n=2.5 is not a whole number and is rounded"],
      ["warning", "tarotKey: n=-0.5 is outside 0–21 and is clamped"],
      ["warning", "tarotKey: n=-0.5 is not a whole number and is rounded"],
    ]);
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

describe("the boards", () => {
  it("draw the Tree for the Flaming Sword and the Minutum Mundum", () => {
    const sword = draw(art("board"), { type: "board", kind: "flamingSword" });
    const mundum = draw(art("board"), { type: "board", kind: "minutumMundum" });
    for (const markup of [sword, mundum]) {
      // Ten spheres (Malkuth in quarters) and the 22 Hermetic paths.
      expect((markup.match(/<circle /g) ?? []).length).toBe(10);
      expect((markup.match(/<path /g) ?? []).length).toBe(22 + 4);
      expect(markup).not.toMatch(/<text|href|\sid=|<style|<title|https?:/);
    }
    // The Lightning Flash, Kether to Malkuth, only on the Flaming Sword.
    expect(sword).toContain("<polyline");
    expect(mundum).not.toContain("<polyline");
    expect(mundum).toContain('fill="#0066ff"');
  });

  it("name the diagrams not drawn yet", () => {
    const eden = draw(art("board"), { type: "board", kind: "gardenOfEden" });
    expect(eden).toMatch(/>The Garden<\/text><text [^>]*>of Eden<\/text>/);
    expect(draw(art("board"), { type: "board", kind: "theFall" })).toContain(
      ">The Fall</text>",
    );
    expect(draw(art("board"), { type: "board" })).not.toContain("<text");
  });

  it("keep a diagram's proportions, and size a plain board by w and h", () => {
    const box = (node: HallNode) => {
      const { box } = art("board");
      return typeof box === "function" ? box(node) : box;
    };
    expect(box({ type: "board", kind: "theFall", w: 5, h: 1 })).toEqual({
      width: 2,
      height: 3,
    });
    expect(box({ type: "board", w: 5, h: 1 })).toEqual({ width: 5, height: 1 });
    expect(box({ type: "board", kind: "unicorn", w: 5 })).toEqual({
      width: 5,
      height: 3,
    });
  });

  it("validate a kind and say what w and h do", () => {
    const found = validateHall(
      hall(
        { type: "board", kind: "theFall", x: 3, y: 3, w: 4 },
        { type: "board", kind: "eden", x: 9, y: 3 },
        { type: "board", w: 4, h: 2, x: 12, y: 9 },
        // Not a diagram it knows: a plain board, which takes w.
        { type: "board", kind: "eden", w: 3, x: 3, y: 12 },
        { type: "board", kind: "null", x: 9, y: 12 },
      ),
      { art: defaultHallArt },
    ).map((d) => [d.severity, d.message]);
    expect(found).toEqual([
      [
        "warning",
        "board: w is ignored for a board with a diagram; scale sizes it",
      ],
      [
        "error",
        'board: kind="eden" is not one of flamingSword, minutumMundum, gardenOfEden, theFall',
      ],
      [
        "error",
        'board: kind="eden" is not one of flamingSword, minutumMundum, gardenOfEden, theFall',
      ],
      [
        "error",
        'board: kind="null" is not one of flamingSword, minutumMundum, gardenOfEden, theFall',
      ],
    ]);
    // The unknown kind's board is drawn at its w.
    const { objects } = resolveHall(
      hall({ type: "board", kind: "eden", w: 3, x: 3, y: 12 }),
      { art: defaultHallArt },
    );
    expect(objects[0].width).toBeCloseTo(3, 6);
  });
});

describe("the kameas and seals", () => {
  const numbers = (markup: string) =>
    [...markup.matchAll(/<text [^>]*>(\d+)<\/text>/g)].map(([, n]) =>
      Number(n),
    );

  it("draws each planet's square with its numbers in their cells", () => {
    const moon = draw(art("kamea"), { type: "kamea", planet: "moon" });
    expect([...numbers(moon)].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 81 }, (_, i) => i + 1),
    );
    // Row by row: the Moon's first row first.
    expect(numbers(moon).slice(0, 9)).toEqual([
      37, 78, 29, 70, 21, 62, 13, 54, 5,
    ]);
    expect(
      numbers(draw(art("kamea"), { type: "kamea", planet: "saturn" })),
    ).toEqual([4, 9, 2, 3, 5, 7, 8, 1, 6]);
    expect(moon).not.toMatch(/href|\sid=|url\(/);
  });

  it("draws an empty frame without a planet, or with one it does not know", () => {
    const empty = draw(art("kamea"), { type: "kamea" });
    expect(numbers(empty)).toEqual([]);
    expect(draw(art("kamea"), { type: "kamea", planet: "pluto" })).toBe(empty);
    expect(art("kamea").variant({ type: "kamea", planet: "pluto" })).toBe(
      art("kamea").variant({ type: "kamea" }),
    );
  });

  it("marks the seals as a placeholder naming the planet", () => {
    const seal = draw(art("seal"), { type: "seal", planet: "moon" });
    expect(seal).toContain("stroke-dasharray");
    expect(seal).toMatch(/>Seals of<\/text><text [^>]*>Luna<\/text>/);
    expect(draw(art("seal"), { type: "seal", planet: "sun" })).toMatch(
      />Sol<\/text>/,
    );
    expect(draw(art("seal"), { type: "seal" })).not.toContain("<text");
  });

  it("validates a planet and warns of a missing one", () => {
    const found = validateHall(
      hall(
        { type: "kamea", planet: "venus", x: 3, y: 3 },
        { type: "kamea", x: 6, y: 3 },
        { type: "seal", planet: "pluto", x: 9, y: 3 },
        // The legacy path's spelling of null: read as absent, drawn empty.
        { type: "kamea", planet: "null", x: 12, y: 3 },
      ),
      { art: defaultHallArt },
    ).map((d) => [d.severity, d.message]);
    expect(found).toEqual([
      ["warning", "kamea: no planet; drawn as an empty square"],
      [
        "error",
        'seal: planet="pluto" is not one of saturn, jupiter, mars, sun, venus, mercury, moon',
      ],
      [
        "error",
        'kamea: planet="null" is not one of saturn, jupiter, mars, sun, venus, mercury, moon',
      ],
    ]);
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
