import { readFileSync } from "node:fs";
import angels from "magick-data/kabbalah/seventyTwoAngels";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { wordInk } from "../sigil/ink.ts";
import {
  ababaTexts,
  CORPUS_ROSE_VERSIONS,
  collinearRunTexts,
  DOMAIN_EDGE_TEXTS,
  randomRoseTexts,
  roseTexts,
} from "../sigil/oracle/corpus.ts";
import { HAND_FIXTURES } from "../sigil/oracle/fixtures.ts";
import { sigilFigure } from "../sigil/SigilImage.tsx";
import type { Point } from "../sigil/types.ts";
import fontMetrics from "./hall/fontMetrics.json" with { type: "json" };
import { hebrewFont } from "./hall/labels.ts";
import type { RoseVersionId } from "./roseSigilInternals.ts";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "./roseSigilLayout.ts";
import {
  type DrawnSigilStyle,
  fitVerse,
  inkBounds,
  SIGIL_ROMAN_CAP_HEIGHT,
  SIGIL_STYLE_FONTS,
  SIGIL_STYLE_GEOMETRY,
  SIGIL_STYLE_NOTES,
  SIGIL_STYLES,
  StyledRoseSigilImage,
  type StyledRoseSigilLayout,
  type StyleGlyph,
  sigilStyleCapitals,
  sigilStyleLegend,
  styledRoseSigilLayout,
} from "./roseSigilStyles.tsx";

/**
 * Plan 096's sigil styles: the notes, the talisman's legend, the layout
 * and the order of every glyph, the fit of the 72 names in each field,
 * the ink's bounds against dense sampling, and the legibility floor.
 */

// A test that places a corpus allows 180 s, as the oracle's do.
const CORPUS_TIMEOUT = 180_000;

/**
 * Each genius's verse as the talisman letters it: `psalm.la`, and for the
 * seventieth, whose entry gives Genesis 1:1 only in French, the Vulgate's
 * Latin from the verse guard's file (plan 096, decision 8).
 */
const GENESIS = (() => {
  const file = readFileSync(
    new URL(
      "../../../magick-data/src/kabbalah/lenain/vulgate/verses.json5",
      import.meta.url,
    ),
    "utf8",
  );
  const entry = file.split(/\n {2}\{\n/).find((e) => /^ {4}no: 70,$/m.test(e));
  return entry?.match(/^ {4}text: '([^']+)',$/m)?.[1];
})();
const verseOf = (angel: (typeof angels)[number]) =>
  angel.psalm.la || (angel.no === 70 ? GENESIS : undefined);

const ANGELS = angels.map((angel) => ({
  no: angel.no,
  text: angel.name.he,
  roman: angel.name.en,
  verse: verseOf(angel) as string,
}));

const draw = (style: DrawnSigilStyle, angel: (typeof ANGELS)[number]) =>
  styledRoseSigilLayout({
    text: angel.text,
    sigilStyle: style,
    roman: angel.roman,
    legend: style === "talisman" ? angel.verse : undefined,
  });

/** Where a glyph is drawn: (x, y) turned by its rotation about the origin. */
function placed(glyph: StyleGlyph): Point {
  const a = (glyph.rotate * Math.PI) / 180;
  return {
    x: glyph.x * Math.cos(a) - glyph.y * Math.sin(a),
    y: glyph.x * Math.sin(a) + glyph.y * Math.cos(a),
  };
}

/** A rotation as degrees in (−180, 180]. */
const signed = (degrees: number) => {
  const d = ((degrees % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
};

const run = (figure: StyledRoseSigilLayout, role: string) => {
  const found = figure.lettering.find((r) => r.role === role);
  if (!found) throw new Error(`no ${role} lettering`);
  return found;
};

const increasing = (values: number[]) =>
  values.every((v, i) => i === 0 || v > values[i - 1]);
const decreasing = (values: number[]) =>
  values.every((v, i) => i === 0 || v < values[i - 1]);

/** Points along a word's ink, sampled from its shapes, not its arcs' commands. */
function inkSamples(ink: ReturnType<typeof wordInk>, per = 200): Point[] {
  const out: Point[] = [];
  let pen: Point = { x: 0, y: 0 };
  for (const command of ink.commands) {
    if (command.type === "L")
      for (let i = 0; i <= per; i++)
        out.push({
          x: pen.x + ((command.to.x - pen.x) * i) / per,
          y: pen.y + ((command.to.y - pen.y) * i) / per,
        });
    else if (command.type === "C")
      for (let i = 0; i <= per; i++) {
        const t = i / per;
        const u = 1 - t;
        const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
        const { c1, c2, to } = command;
        out.push({
          x: w[0] * pen.x + w[1] * c1.x + w[2] * c2.x + w[3] * to.x,
          y: w[0] * pen.y + w[1] * c1.y + w[2] * c2.y + w[3] * to.y,
        });
      }
    else out.push(command.to);
    pen = command.to;
  }
  // The arcs are the start circle and the nooses: each loop whole.
  for (const loop of ink.loops)
    for (let i = 0; i < 4 * per; i++) {
      const a = (2 * Math.PI * i) / (4 * per);
      out.push({
        x: loop.center.x + loop.radius * Math.cos(a),
        y: loop.center.y + loop.radius * Math.sin(a),
      });
    }
  return out;
}

/** The sampled ink of a figure, moved into its field as drawn. */
function screenInk(figure: StyledRoseSigilLayout, text: string): Point[] {
  const layout = roseSigilLayout();
  const sigil = sigilFigure(text, layout, ROSE_SIGIL_PROFILE);
  const ink = wordInk(sigil.placed[0], 1, ROSE_SIGIL_PROFILE, sigil.frame);
  const { scale, center, at } = figure.ink.fit;
  return inkSamples(ink, 40).map((p) => ({
    x: at.x + scale * (p.x - center.x),
    y: at.y + scale * (p.y - center.y),
  }));
}

describe("the styles' notes", () => {
  it("has one per style, under its id, each with its works linked", () => {
    expect(Object.keys(SIGIL_STYLE_NOTES).sort()).toEqual(
      [...SIGIL_STYLES].sort(),
    );
    for (const style of SIGIL_STYLES) {
      const note = SIGIL_STYLE_NOTES[style];
      expect(note.id).toBe(style);
      expect(note.title).not.toBe("");
      expect(note.text).toMatch(/\.$/);
      expect(note.sources.length).toBeGreaterThan(0);
      for (const source of note.sources)
        expect(source.url, source.text).toMatch(/^https:\/\//);
    }
    // The band's witness is Mathers's Fig. 18 on Plate IV (leaf n79), not
    // Plate I (plan 096, B1).
    expect(SIGIL_STYLE_NOTES.band.sources[0].url).toBe(
      "https://archive.org/details/b24884431/page/n79",
    );
  });

  it("says what is ours in every style the package draws", () => {
    for (const style of ["band", "bare", "talisman"] as const)
      expect(SIGIL_STYLE_NOTES[style].text, style).toContain("Ours:");
  });
});

describe("the talisman's legend", () => {
  it("sets the verse in capitals by a fixed table, keeping accents and ligatures", () => {
    expect(
      sigilStyleLegend(
        "Quàm magnificata sunt opera tua Domine! omnia in sapientia fecisti : impleta est terra possessione tua.",
      ),
    ).toBe(
      "QUÀM MAGNIFICATA SUNT OPERA TUA DOMINE! OMNIA IN SAPIENTIA FECISTI : IMPLETA EST TERRA POSSESSIONE TUA",
    );
    expect(sigilStyleLegend("Dominus in cælo paravit sedem suam.")).toBe(
      "DOMINUS IN CÆLO PARAVIT SEDEM SUAM",
    );
    expect(sigilStyleCapitals("longè æternum Sitaël")).toBe(
      "LONGÈ ÆTERNUM SITAËL",
    );
    expect(sigilStyleCapitals("Séheiah, Eïael, Nith-Haiah")).toBe(
      "SÉHEIAH, EÏAEL, NITH-HAIAH",
    );
  });

  it("keeps Lenain's punctuation, his spaced colons, and drops only a final full stop", () => {
    expect(
      sigilStyleLegend("  Et  ego ad te Domine clamavi :\tet manè.  "),
    ).toBe("ET EGO AD TE DOMINE CLAMAVI : ET MANÈ");
    expect(sigilStyleLegend("Ut quid Domine recessisti longè?")).toBe(
      "UT QUID DOMINE RECESSISTI LONGÈ?",
    );
    expect(sigilStyleLegend("A. b.")).toBe("A. B");
  });

  it("letters every capital of its table from the subset's measured glyphs", () => {
    // Each mapped capital is checked against the metrics as it is lettered,
    // so the whole table at once proves that none is missing.
    const lower = "abcdefghijklmnopqrstuvwxyzàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ";
    expect(sigilStyleCapitals(lower)).toBe(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ",
    );
  });

  it("refuses a letter it has no capital for, or a character the subset lacks", () => {
    // Œ and œ left the verses in Y0, and the subset is Latin-1.
    expect(() => sigilStyleCapitals("cœlo")).toThrow(/No capital/);
    expect(() => sigilStyleCapitals("CŒLO")).toThrow(/not in the roman subset/);
    expect(() => sigilStyleCapitals("straße")).toThrow(/No capital/);
    expect(() => sigilStyleCapitals("ÿ")).toThrow(/No capital/);
    expect(() => sigilStyleCapitals("יה")).toThrow(/not in the roman subset/);
  });

  it("adds and drops nothing in any genius's verse but spaces and the final stop", () => {
    expect(GENESIS).toBe("In principio creavit Deus cælum et terram.");
    // Character by character against an independent capital: Unicode's
    // upper case, which agrees with the table for every letter the
    // verses use (ß and ÿ, where they part, are refused above).
    for (const angel of ANGELS) {
      const where = `genius ${angel.no}`;
      const legend = sigilStyleLegend(angel.verse);
      const expected = [
        ...angel.verse.trim().replace(/\s+/g, " ").replace(/ ?\.$/, ""),
      ].map((ch) => ch.toUpperCase());
      expect([...legend], where).toEqual(expected);
      expect(legend, where).not.toMatch(/\.$|\s{2}|^\s|\s$/);
    }
  });
});

describe("the layout", () => {
  const vehuiah = ANGELS[0];

  it("draws every style in the rose's viewBox", () => {
    for (const style of ["band", "bare", "talisman"] as const) {
      expect(draw(style, vehuiah).viewBox).toEqual([-50, -50, 100, 100]);
      const svg = renderToStaticMarkup(
        <StyledRoseSigilImage
          text={vehuiah.text}
          sigilStyle={style}
          roman={vehuiah.roman}
          legend={vehuiah.verse}
        />,
      );
      expect(svg).toContain('viewBox="-50 -50 100 100"');
    }
  });

  it("writes each face's family, weight and style into the markup", () => {
    const svg = renderToStaticMarkup(
      <StyledRoseSigilImage
        text={vehuiah.text}
        sigilStyle="talisman"
        legend={vehuiah.verse}
        aria-label="A talisman"
      />,
    );
    expect(svg).toContain(
      '<g font-family="Noto Serif" font-weight="400" font-style="normal"',
    );
    expect(svg).toContain(
      '<g font-family="Frank Ruhl Libre" font-weight="700" font-style="normal"',
    );
    expect(svg).toContain('role="img" aria-label="A talisman"');
    expect(SIGIL_STYLE_FONTS).toEqual({
      roman: { family: "Noto Serif", weight: 400, style: "normal" },
      hebrew: { family: "Frank Ruhl Libre", weight: 700, style: "normal" },
    });
    const plain = renderToStaticMarkup(
      <StyledRoseSigilImage text={vehuiah.text} sigilStyle="bare" />,
    );
    expect(plain).toContain('aria-hidden="true"');
  });

  it("letters each glyph as its own <text>, in reading order", () => {
    for (const style of ["band", "bare", "talisman"] as const) {
      const figure = draw(style, vehuiah);
      const svg = renderToStaticMarkup(
        <StyledRoseSigilImage
          text={vehuiah.text}
          sigilStyle={style}
          roman={vehuiah.roman}
          legend={vehuiah.verse}
        />,
      );
      const drawn = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(
        (m) => m[1],
      );
      expect(drawn.every((t) => [...t].length === 1)).toBe(true);
      expect(drawn.join(""), style).toBe(
        figure.lettering.map((r) => r.text.replace(/ /g, "")).join(""),
      );
    }
  });

  it("refuses the rose, a second word, other letters and a talisman with no verse", () => {
    expect(() =>
      styledRoseSigilLayout({
        text: "והויה",
        sigilStyle: "rose" as DrawnSigilStyle,
      }),
    ).toThrow(/RoseSigilImage/);
    expect(() =>
      styledRoseSigilLayout({ text: "והו יה", sigilStyle: "band" }),
    ).toThrow();
    expect(() =>
      styledRoseSigilLayout({ text: "וְהו", sigilStyle: "band" }),
    ).toThrow(/Hebrew letters/);
    expect(() =>
      styledRoseSigilLayout({ text: "והויה", sigilStyle: "talisman" }),
    ).toThrow(/verse/);
  });

  it("runs the band's Hebrew right to left across the top, tops outward, and its roman name upright left to right at the bottom", () => {
    for (const angel of ANGELS) {
      const figure = draw("band", angel);
      const he = run(figure, "hebrew").glyphs;
      const ro = run(figure, "roman").glyphs;
      const where = `genius ${angel.no}`;
      expect(he.map((g) => g.char).join(""), where).toBe(angel.text);
      expect(decreasing(he.map((g) => placed(g).x)), where).toBe(true);
      for (const g of he) {
        expect(placed(g).y, where).toBeLessThan(0);
        // Tops outward: the glyph's up is away from the centre.
        expect(g.y, where).toBeLessThan(0);
        expect(Math.abs(signed(g.rotate)), where).toBeLessThan(75);
      }
      expect(increasing(ro.map((g) => placed(g).x)), where).toBe(true);
      for (const g of ro) {
        expect(placed(g).y, where).toBeGreaterThan(0);
        // Upright: drawn below the centre and barely turned.
        expect(g.y, where).toBeGreaterThan(0);
        expect(Math.abs(signed(g.rotate)), where).toBeLessThan(75);
      }
    }
  });

  it("runs the verse clockwise from the cross, tops outward, and the name inside right to left", () => {
    const g = SIGIL_STYLE_GEOMETRY.talisman;
    for (const angel of ANGELS) {
      const figure = draw("talisman", angel);
      const where = `genius ${angel.no}`;
      // The cross and the arc left clear on either side of it.
      const baseline = figure.verse?.baseline as number;
      const gapDegrees =
        (((g.cross / 2 + g.crossGap) / baseline) * 180) / Math.PI;
      const verse = run(figure, "verse").glyphs;
      // The clockwise angle from the top of each glyph's middle.
      const fromTop = verse.map((v) => ((v.rotate % 360) + 360) % 360);
      expect(increasing(fromTop), where).toBe(true);
      expect(fromTop[0], where).toBeGreaterThan(gapDegrees);
      expect(fromTop[fromTop.length - 1], where).toBeLessThan(360 - gapDegrees);
      for (const v of verse) expect(v.y, where).toBeLessThan(0);
      const name = run(figure, "name").glyphs;
      expect(name.map((n) => n.char).join(""), where).toBe(angel.text);
      expect(decreasing(name.map((n) => n.x)), where).toBe(true);
      expect(figure.cross?.at).toEqual({ x: 0, y: -g.verseMiddle });
    }
  });

  it("runs the bare name left to right beneath the sigil", () => {
    for (const angel of ANGELS) {
      const name = run(draw("bare", angel), "roman");
      expect(name.text).toBe(sigilStyleCapitals(angel.roman));
      expect(increasing(name.glyphs.map((n) => n.x))).toBe(true);
      expect(name.glyphs.every((n) => n.rotate === 0)).toBe(true);
    }
  });
});

describe("the fit (plan 096, decision 11)", () => {
  const { ring } = SIGIL_STYLE_GEOMETRY;
  const innerEdge = ring.inner - ring.stroke / 2;
  const outerEdge = ring.outer - ring.stroke / 2;

  it("keeps every name's ink clear of the band's ring and the talisman's verse ring, start circles and bars included", () => {
    for (const style of ["band", "talisman"] as const) {
      let closest = Infinity;
      for (const angel of ANGELS) {
        const figure = draw(style, angel);
        // Half the line, which is 1 unit wide on screen.
        const reach = Math.max(
          ...screenInk(figure, angel.text).map((p) => Math.hypot(p.x, p.y)),
        );
        closest = Math.min(closest, innerEdge - (reach + 0.5));
        expect(figure.ink.strokeWidth * figure.ink.fit.scale).toBeCloseTo(1, 2);
      }
      // Y1: 2.2 units at the closest in the band, 2.7 in the talisman.
      expect(closest, style).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps every name's ink inside its box, and the talisman's box inside its verse ring", () => {
    for (const style of ["talisman", "bare"] as const) {
      const field = SIGIL_STYLE_GEOMETRY[style].field;
      for (const angel of ANGELS) {
        for (const p of screenInk(draw(style, angel), angel.text)) {
          expect(Math.abs(p.x - field.cx) + 0.5).toBeLessThanOrEqual(
            field.w / 2 + 1e-6,
          );
          expect(Math.abs(p.y - field.cy) + 0.5).toBeLessThanOrEqual(
            field.h / 2 + 1e-6,
          );
        }
      }
    }
    const box = SIGIL_STYLE_GEOMETRY.talisman.field;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        expect(
          Math.hypot(box.cx + (sx * box.w) / 2, box.cy + (sy * box.h) / 2),
        ).toBeLessThan(innerEdge);
  });

  it("keeps the lettering inside its band, and the names clear of the ink", () => {
    const roman = fontMetrics.roman;
    const ascent = roman.ascender / roman.upem;
    const descent = -roman.descender / roman.upem;
    const t = SIGIL_STYLE_GEOMETRY.talisman;
    const rimEdge = t.rim - t.rimStroke / 2;
    for (const angel of ANGELS) {
      const where = `genius ${angel.no}`;
      const band = draw("band", angel);
      const he = run(band, "hebrew");
      const heBase = -he.glyphs[0].y;
      expect(heBase + hebrewFont.top * he.size, where).toBeLessThan(outerEdge);
      expect(heBase - hebrewFont.bottom * he.size, where).toBeGreaterThan(
        innerEdge,
      );
      // Upright at the bottom: the baseline is the outer side.
      const ro = run(band, "roman");
      const roBase = ro.glyphs[0].y;
      expect(roBase + descent * ro.size, where).toBeLessThan(outerEdge);
      expect(roBase - ascent * ro.size, where).toBeGreaterThan(innerEdge);

      const talisman = draw("talisman", angel);
      const verse = talisman.verse as NonNullable<typeof talisman.verse>;
      expect(verse.baseline + ascent * verse.size, where).toBeLessThan(rimEdge);
      expect(verse.baseline - descent * verse.size, where).toBeGreaterThan(
        innerEdge,
      );
      // The name inside: below the sigil's box, inside the verse ring.
      const name = run(talisman, "name");
      const half = hebrewFont.width(name.text, name.size) / 2;
      const top = t.nameBaseline - hebrewFont.top * name.size;
      const bottom = t.nameBaseline + hebrewFont.bottom * name.size;
      expect(top, where).toBeGreaterThan(t.field.cy + t.field.h / 2 + 2);
      expect(Math.hypot(half, bottom), where).toBeLessThan(innerEdge - 1);

      const bare = draw("bare", angel);
      const capTop =
        SIGIL_STYLE_GEOMETRY.bare.nameBaseline -
        SIGIL_ROMAN_CAP_HEIGHT * SIGIL_STYLE_GEOMETRY.bare.nameSize;
      const inkBottom = Math.max(
        ...screenInk(bare, angel.text).map((p) => p.y),
      );
      expect(capTop - (inkBottom + 0.5), where).toBeGreaterThan(5);
      const width = Math.max(...run(bare, "roman").glyphs.map((g) => g.x));
      expect(width, where).toBeLessThan(45);
    }
  });

  it("sets the band's two names apart, each within its own half", () => {
    for (const angel of ANGELS) {
      const band = draw("band", angel);
      const he = run(band, "hebrew").glyphs.map((g) => signed(g.rotate));
      const ro = run(band, "roman").glyphs.map((g) => signed(g.rotate));
      expect(Math.max(...he.map(Math.abs))).toBeLessThan(60);
      expect(Math.max(...ro.map(Math.abs))).toBeLessThan(60);
    }
  });
});

describe("the ink's bounds", () => {
  /** Every text's words on `version`, and how far its bounds miss its samples. */
  function check(texts: readonly string[], version: RoseVersionId) {
    const layout = roseSigilLayout(version);
    let words = 0;
    let cubics = 0;
    let outside = 0;
    let gap = 0;
    for (const text of texts) {
      const figure = sigilFigure(text, layout, ROSE_SIGIL_PROFILE);
      for (const word of figure.placed) {
        const ink = wordInk(
          word,
          layout.unit,
          ROSE_SIGIL_PROFILE,
          figure.frame,
        );
        const b = inkBounds(ink.commands);
        const samples = inkSamples(ink);
        words++;
        cubics += ink.commands.filter((c) => c.type === "C").length;
        const tolerance = 1e-9;
        for (const p of samples)
          if (
            p.x < b.minX - tolerance ||
            p.x > b.maxX + tolerance ||
            p.y < b.minY - tolerance ||
            p.y > b.maxY + tolerance
          )
            outside++;
        const xs = samples.map((p) => p.x);
        const ys = samples.map((p) => p.y);
        gap = Math.max(
          gap,
          Math.min(...xs) - b.minX,
          b.maxX - Math.max(...xs),
          Math.min(...ys) - b.minY,
          b.maxY - Math.max(...ys),
        );
      }
    }
    return { words, cubics, outside, gap };
  }

  it(
    "holds the 72 names' bounds to dense samples of their ink, crooks' cubics included",
    () => {
      for (const version of CORPUS_ROSE_VERSIONS) {
        const result = check(
          ANGELS.map((a) => a.text),
          version,
        );
        expect(result.words).toBe(72);
        expect(result.cubics).toBeGreaterThan(0);
        expect(result.outside).toBe(0);
        expect(result.gap).toBeLessThan(0.5);
      }
    },
    CORPUS_TIMEOUT,
  );

  it(
    "holds the oracle's corpus too: the hand fixtures, every pair, the random words, A-B-A-B-A and the collinear runs",
    () => {
      for (const version of CORPUS_ROSE_VERSIONS) {
        const texts = [
          ...HAND_FIXTURES.map((f) => f.text),
          ...roseTexts(2, version),
          ...randomRoseTexts(),
          ...ababaTexts(version),
          ...DOMAIN_EDGE_TEXTS,
          ...(version === "gd" ? collinearRunTexts() : []),
        ];
        const result = check(texts, version);
        expect(result.words).toBeGreaterThan(texts.length - 1);
        expect(result.cubics).toBeGreaterThan(1000);
        expect(result.outside).toBe(0);
        expect(result.gap).toBeLessThan(0.5);
      }
    },
    CORPUS_TIMEOUT,
  );
});

describe("the talisman's legibility floor (plan 096, decision 9)", () => {
  it("sets every verse's capitals at 8.5 CSS px or more on a 288 px figure", () => {
    const pxPerUnit = 288 / 100;
    const heights = ANGELS.map((angel) => ({
      no: angel.no,
      px: fitVerse(sigilStyleLegend(angel.verse)).capHeight * pxPerUnit,
    }));
    const low = heights.filter((h) => h.px < 8.5);
    expect(low).toEqual([]);
    // Y1: 10.3 px for most, 8.7 px for #31 at the least.
    const least = heights.reduce((a, b) => (b.px < a.px ? b : a));
    expect(least.no).toBe(31);
    expect(least.px).toBeCloseTo(8.7, 1);
    expect(Math.max(...heights.map((h) => h.px))).toBeCloseTo(
      SIGIL_STYLE_GEOMETRY.talisman.verseCap *
        SIGIL_ROMAN_CAP_HEIGHT *
        pxPerUnit,
      6,
    );
  });

  it("fills the ring: a capped verse is tracked, a long one fits exactly", () => {
    const g = SIGIL_STYLE_GEOMETRY.talisman;
    for (const angel of ANGELS) {
      const legend = sigilStyleLegend(angel.verse);
      const fit = fitVerse(legend);
      const figure = draw("talisman", angel);
      const glyphs = run(figure, "verse").glyphs;
      expect(glyphs.length).toBe(legend.replace(/ /g, "").length);
      if (fit.size < g.verseCap) expect(fit.track).toBeCloseTo(0, 9);
      else expect(fit.track).toBeGreaterThanOrEqual(0);
    }
  });
});
