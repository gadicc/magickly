import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KameaFigure } from "../../astrology/Kamea";
import { defaultHallArt } from "./art";
import { PALETTE } from "./art/shared";
import { TABLET_ELEMENTS, tabletArt } from "./art/symbols";
import { romanNumeral, TRUMPS } from "./art/tarotKey";
import { GD_HALL_FONT_STACKS } from "./fonts";
import { resolveHall } from "./layout";
import { KAMEA_PLANET_IDS, PLANETS } from "./planets";
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
      const page = element === "union" ? "0 0 124 104" : "-105 0 210 297";
      expect(markup, element).toContain(`viewBox="${page}"`);
      expect(markup, element).not.toContain("border:");
    }
  });

  it("stands each tablet on a board of its own shape", () => {
    const { box } = art("tablet");
    const boxOf = (element?: string) =>
      typeof box === "function" ? box({ type: "tablet", element }) : box;
    for (const element of [
      "earth",
      "air",
      "water",
      "fire",
      "spirit",
      undefined,
    ])
      expect(boxOf(element), String(element)).toEqual({
        width: 210,
        height: 297,
      });
    expect(boxOf("union")).toEqual({ width: 124, height: 104 });
    const union = draw(art("tablet"), { type: "tablet", element: "union" });
    expect(union).toContain('<rect x="-62" y="-52" width="124" height="104"');
    expect(union).toContain('viewBox="0 0 124 104" width="124" height="104"');
  });

  it("draws an empty board for an element without data", () => {
    for (const element of ["spirit", "constructor", undefined]) {
      const markup = draw(art("tablet"), { type: "tablet", element });
      expect(markup, String(element)).toContain("<rect");
      expect(markup, String(element)).not.toContain("<svg xmlns");
    }
    expect(
      validateHall(hall({ type: "tablet", element: "spirit" }), {
        art: defaultHallArt,
      }).map((d) => d.message),
    ).toEqual([
      'tablet: element="spirit" is not one of earth, air, water, fire, union',
    ]);
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

describe("the altars, the veil and the furnishings", () => {
  it("draws a white altar beside the black one", () => {
    const black = draw(art("altar"), { type: "altar" });
    const white = draw(art("altar"), { type: "altar", kind: "white" });
    expect(black).toContain('fill="#000000"');
    expect(white).toContain('fill="#ffffff"');
    expect(draw(art("altar"), { type: "altar", kind: "red" })).toBe(black);
    expect(art("altar").variant({ type: "altar", kind: "red" })).toBe(
      art("altar").variant({ type: "altar" }),
    );
    // A kind it does not know, the legacy "null" included, is an error.
    expect(
      validateHall(
        hall(
          { type: "altar", kind: "white", x: 3, y: 3 },
          { type: "altar", kind: "red", x: 8, y: 3 },
          { type: "altar", kind: "null", x: 13, y: 3 },
        ),
        { art: defaultHallArt },
      ).map((d) => d.message),
    ).toEqual([
      'altar: kind="red" is not one of black, white',
      'altar: kind="null" is not one of black, white',
    ]);
  });

  it("draws the veil the hall's width, pleated, sized by scale", () => {
    const veil = draw(art("veil"), { type: "veil", w: 3 });
    expect(art("veil").box).toEqual({ width: 16, height: 0.4 });
    expect(art("veil").fit).toBe("squares");
    // A pleat every half square: 31 lines across a 16-square band.
    expect((veil.match(/M[-\d.]+,-0\.2v0\.4/g) ?? []).length).toBe(31);
  });

  it("draws the gong, the brazier and the candle from geometry", () => {
    for (const kind of ["gong", "brazier", "candle"]) {
      const markup = draw(art(`item:${kind}`), { type: "item", kind });
      expect(markup, kind).toMatch(/<(path|circle|rect)/);
      expect(markup, kind).not.toMatch(/href|\sid=|url\(|<text|<image/);
    }
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

  it("draws the shared Kamea's figure, in the hall's font and palette", () => {
    const figure = (planet?: (typeof PLANETS)[number]) =>
      renderToStaticMarkup(
        <svg aria-hidden="true">
          <KameaFigure
            planet={planet && KAMEA_PLANET_IDS.get(planet)}
            fontFamily={GD_HALL_FONT_STACKS.serif}
            paper={PALETTE.paper}
            ink={PALETTE.ink}
          />
        </svg>,
      );
    for (const planet of PLANETS)
      expect(draw(art("kamea"), { type: "kamea", planet }), planet).toBe(
        figure(planet),
      );
    expect(draw(art("kamea"), { type: "kamea" })).toBe(figure());
    // The hall's "moon" is magick-data's "luna".
    expect(draw(art("kamea"), { type: "kamea", planet: "moon" })).toContain(
      `font-family="${GD_HALL_FONT_STACKS.serif.replaceAll('"', "&quot;")}"`,
    );
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

describe("the kamea art's bytes", () => {
  it("are what they were before the shared Kamea (33ad461)", async () => {
    // Seven planets, no planet and one the vocabulary does not know.
    const markup = [
      "saturn",
      "jupiter",
      "mars",
      "sun",
      "venus",
      "mercury",
      "moon",
      undefined,
      "pluto",
    ]
      .map((planet) => draw(art("kamea"), { type: "kamea", planet }))
      .join("\n");
    await expect(`${markup}\n`).toMatchFileSnapshot(
      "./__snapshots__/kameaArt.html",
    );
  });
});

describe("the items redrawn in stage H", () => {
  /**
   * The boxes the drawings' items had: part of the layout contract
   * (plan 061, decision 4), so saved halls and presets keep their places.
   */
  const BOXES: ReadonlyMap<string, [number, number]> = new Map([
    ["cup", [76.67, 100]],
    ["chalice", [56.17, 100]],
    ["censer", [73.69, 100]],
    ["lamp", [60.09, 100]],
    ["lantern", [60.09, 100]],
  ]);

  it("keep the boxes and the scales the drawings' items had", () => {
    for (const [kind, [width, height]] of BOXES) {
      expect(art(`item:${kind}`).box, kind).toEqual({ width, height });
      expect(art(`item:${kind}`).inset, kind).toBeUndefined();
    }
  });

  it("are flat shapes with the one outline, and nothing to load", () => {
    for (const kind of BOXES.keys()) {
      const markup = draw(art(`item:${kind}`), { type: "item", kind });
      expect(markup, kind).toContain(
        '<g stroke="#000000" stroke-width="3.6" stroke-linejoin="round"',
      );
      expect(markup, kind).not.toMatch(
        /href|\sid=|url\(|<text|<image|Gradient|opacity/,
      );
      expect(art(`item:${kind}`).provenance.origin, kind).toBe("original");
    }
  });

  it("draw each vessel alike, whatever the node says", () => {
    for (const kind of ["cup", "chalice", "censer"])
      expect(art(`item:${kind}`).variant({ type: "item", fill: "red" })).toBe(
        "",
      );
  });

  it("light a lamp red and a lantern yellow, or as `light` says", () => {
    const glass = (node: Record<string, unknown>) => {
      const markup = draw(art(`item:${node.kind}`), {
        type: "item",
        ...node,
      } as HallNode);
      return markup.match(/<path d="M-11,-18[^"]*" fill="([^"]+)"/)?.[1];
    };
    expect(glass({ kind: "lamp" })).toBe(PALETTE.glassRed);
    expect(glass({ kind: "lantern" })).toBe(PALETTE.glassYellow);
    expect(glass({ kind: "lamp", light: "yellow" })).toBe(PALETTE.glassYellow);
    expect(glass({ kind: "lantern", light: "red" })).toBe(PALETTE.glassRed);
    expect(glass({ kind: "lamp", light: "white" })).toBe(PALETTE.glassWhite);
    // Not a light's colour: the kind's own, never the raw value.
    const raw = draw(art("item:lamp"), {
      type: "item",
      kind: "lamp",
      light: "#123",
    });
    expect(raw).toContain(`fill="${PALETTE.glassRed}"`);
    expect(raw).not.toContain("#123");
    // A hall written before stage H named the glass with `fill`.
    expect(glass({ kind: "lamp", fill: "white" })).toBe(PALETTE.glassWhite);
    expect(glass({ kind: "lamp", fill: "blue" })).toBe(PALETTE.glassRed);
    expect(glass({ kind: "lamp", fill: "white", light: "red" })).toBe(
      PALETTE.glassRed,
    );
    // The variant is the colour it draws.
    const lamp = art("item:lamp");
    expect(lamp.variant({ type: "item", light: "nonsense" })).toBe("red");
    expect(lamp.variant({ type: "item", fill: "yellow" })).toBe("yellow");
    expect(art("item:lantern").variant({ type: "item" })).toBe("yellow");
  });

  it("check a light's colour, which only the lights take", () => {
    const diagnostics = (node: Record<string, unknown>) =>
      validateHall(hall({ type: "item", x: 4, y: 4, ...node }), {
        art: defaultHallArt,
      });
    expect(diagnostics({ kind: "lamp", light: "white" })).toEqual([]);
    expect(diagnostics({ kind: "lantern", light: "red" })).toEqual([]);
    for (const node of [
      { kind: "lamp", light: "blue" },
      { kind: "cup", light: "red" },
    ])
      expect(diagnostics(node), node.kind).toEqual([
        expect.objectContaining({ attribute: "light" }),
      ]);
    // A hall from before `light`: its fill still colours a light when it
    // is a light's colour and nothing else does; otherwise it is flagged.
    expect(diagnostics({ kind: "lamp", fill: "white" })).toEqual([]);
    expect(diagnostics({ kind: "cup", fill: "blue" })).toEqual([]);
    for (const node of [
      { kind: "lamp", fill: "blue" },
      { kind: "lantern", fill: "none" },
      { kind: "lamp", fill: "white", light: "red" },
    ])
      expect(diagnostics(node), JSON.stringify(node)).toEqual([
        expect.objectContaining({
          attribute: "fill",
          severity: "warning",
          message: `item: fill no longer colours a ${node.kind}; use light (red, yellow or white)`,
        }),
      ]);
  });

  it("give metal its one white highlight", () => {
    for (const kind of ["cup", "chalice", "censer", "lamp", "lantern"]) {
      const markup = draw(art(`item:${kind}`), { type: "item", kind });
      expect(markup.match(/fill="none" stroke="#ffffff"/g), kind).toHaveLength(
        1,
      );
    }
  });
});
