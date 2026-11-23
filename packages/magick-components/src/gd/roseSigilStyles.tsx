/**
 * The rose sigil's styles (plan 096): an angel's sigil drawn as a finished
 * figure rather than over the rose that makes it. Four styles, each after a
 * source, each with what is ours said in its note (`SIGIL_STYLE_NOTES`):
 *
 * - `band`: the sigil inside a ring, the Hebrew name at the top of the
 *   band and the roman name at the bottom, after the angels' names round a
 *   pentacle in Mathers's Key of Solomon (1889), Pl. IV Fig. 18;
 * - `bare`: the sigil alone with the name beneath, as the Golden Dawn's
 *   own sigils are printed (Regardie, vol. 4, p. 58);
 * - `rose`: the sigil over the rose, `RoseSigilImage`'s, which this module
 *   does not draw, so the rose keeps one code path;
 * - `talisman`: the sigil inside a ring lettered with the genius's verse,
 *   clockwise from a cross at the top, as Lenain describes the genii's
 *   talismans and letters the one on his title page, the Hebrew name
 *   inside, after Mathers's Fig. 21.
 *
 * Nothing here changes the engine. The sigil is the rose's (`sigilFigure`
 * on `roseSigilLayout`), its paths moved and scaled into the style's field
 * by a transform, its bounds read from `wordInk`'s commands. Every letter
 * of the lettering is its own `<text>`, placed and turned from the font's
 * measured advances (`fontMetrics.json`, as `gd/hall/labels.ts` measures
 * the halls' labels), so no renderer's text layout, bidi or `textPath`
 * decides where a glyph goes or in what order.
 */

import { archiveLeaf, type DrawingVersionNote } from "../drawingVersions.ts";
import { type InkCommand, wordInk } from "../sigil/ink.ts";
import { sigilFigure } from "../sigil/SigilImage.tsx";
import type { Point } from "../sigil/types.ts";
import { svgCoordinate } from "../svgCoordinate.ts";
import fontMetrics from "./hall/fontMetrics.json" with { type: "json" };
import { hebrewFont, type TextMeasure, textMeasure } from "./hall/labels.ts";
import type { RoseVersionId } from "./roseSigilInternals.ts";
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "./roseSigilLayout.ts";

const c = svgCoordinate;

/** The styles, in the order a menu lists them; `band` is the default. */
export const SIGIL_STYLES = ["band", "bare", "rose", "talisman"] as const;

/** One of `SIGIL_STYLES`. */
export type SigilStyle = (typeof SIGIL_STYLES)[number];

/**
 * The styles `StyledRoseSigilImage` draws. The rose is `RoseSigilImage`'s,
 * so that it has one code path.
 */
export type DrawnSigilStyle = Exclude<SigilStyle, "rose">;

/** One style: its name, where it comes from and what is ours, and its works. */
export type SigilStyleNote = DrawingVersionNote<SigilStyle>;

const MATHERS = "b24884431";
const REGARDIE_4 = "IsraelRegardie-TheGoldenDawn-Vol4-1940";
const LENAIN_MS = "BIUSante_ms05365";
const lenain1823 = (page: number) =>
  `https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PA${page}`;

const REGARDIE_RULES = {
  text:
    "Israel Regardie, The Golden Dawn, vol. 4 (Aries Press, Chicago, " +
    "1940), p. 57, the rules for tracing a sigil on the rose (archive.org " +
    "leaf n51)",
  url: archiveLeaf(REGARDIE_4, 51),
};
const REGARDIE_SIGILS = {
  text:
    "Israel Regardie, The Golden Dawn, vol. 4 (Aries Press, Chicago, " +
    "1940), p. 58, the sigils of Metatron and Elohim (archive.org leaf n52)",
  url: archiveLeaf(REGARDIE_4, 52),
};
const MATHERS_PLATE = {
  text:
    "S. Liddell MacGregor Mathers, The Key of Solomon the King (London, " +
    "1889), Plate IV (archive.org leaf n79)",
  url: archiveLeaf(MATHERS, 79),
};

/**
 * Each style's note, by its id, for the package's own users. Regardie's
 * volume is in copyright outside the US, so only facts are taken from it
 * and its pages are linked, never copied.
 */
export const SIGIL_STYLE_NOTES: Readonly<Record<SigilStyle, SigilStyleNote>> = {
  band: {
    id: "band",
    title: "In a ring with its name",
    text:
      "The sigil inside a ring, with the name in Hebrew at the top of the " +
      "band, as the angels' names are written round a pentacle in " +
      "Mathers's Key of Solomon (1889), Plate IV, Fig. 18: each a word in " +
      "the band, tops outward. Ours: one name instead of four, the name in " +
      "roman letters at the bottom, read upright, and the sigil inside, " +
      "centred and scaled to the ring.",
    sources: [
      MATHERS_PLATE,
      {
        text:
          "Mathers, The Key of Solomon the King (1889), p. 61, the note " +
          "on Fig. 18 (archive.org leaf n80)",
        url: archiveLeaf(MATHERS, 80),
      },
      REGARDIE_RULES,
    ],
  },
  bare: {
    id: "bare",
    title: "Alone, with its name",
    text:
      "The sigil drawn alone, with the name beneath in capitals, as the " +
      "Golden Dawn's own sigils of Metatron and Elohim are printed " +
      "(Regardie, The Golden Dawn, vol. 4, p. 58). Ours: giving the 72 " +
      "this form, the face and its size, and the sigil centred and scaled.",
    sources: [REGARDIE_SIGILS, REGARDIE_RULES],
  },
  rose: {
    id: "rose",
    title: "On the rose",
    text:
      "Traced through the letters of the Golden Dawn's rose by the Order's " +
      "rules (Regardie, The Golden Dawn, vol. 4, pp. 57–58). The rose shows " +
      "which letters the line passes through. `RoseSigilImage` draws it.",
    sources: [REGARDIE_RULES, REGARDIE_SIGILS],
  },
  talisman: {
    id: "talisman",
    title: "Talisman with its verse",
    text:
      "A talisman as Lenain describes the genii's, the genius's verse " +
      "written round it (La Science cabalistique, 1823, p. 45, and the note " +
      "on p. 70), lettered as the talisman on his title page is: capitals " +
      "running clockwise from a cross at the top, tops outward. The name " +
      "inside follows Mathers's Key of Solomon (1889), Plate IV, Fig. 21, " +
      "which has an angel's name inside its verse. Ours: Lenain says the " +
      "verses are written in Hebrew, and this letters his Latin; he draws " +
      "no genius's talisman; the sigil inside is the Golden Dawn's, a " +
      "method he never uses; and the lettering is fitted to each verse.",
    sources: [
      {
        text:
          "Lazare Lenain, La Science cabalistique (Amiens, 1823), p. 45 " +
          "(Google Books qt9SAAAAcAAJ)",
        url: lenain1823(45),
      },
      {
        text:
          "Lenain, La Science cabalistique (1823), p. 70, the note on the " +
          "verses round the talismans (Google Books qt9SAAAAcAAJ)",
        url: lenain1823(70),
      },
      {
        text:
          "The talisman of Lenain's title page, as Ms 5365 of the " +
          "Bibliothèque interuniversitaire de santé copies it (archive.org " +
          "leaf n2)",
        url: archiveLeaf(LENAIN_MS, 2),
      },
      MATHERS_PLATE,
      {
        text:
          "Mathers, The Key of Solomon the King (1889), pp. 61–62, the " +
          "notes on Figs. 20 and 21 (archive.org leaves n80 and n81)",
        url: archiveLeaf(MATHERS, 81),
      },
      REGARDIE_RULES,
    ],
  },
};

/**
 * The faces the lettering is measured in (`fontMetrics.json`'s `roman` and
 * `hebrew` tables), as `scripts/gd-hall-fonts/build.py` makes them: the
 * upright Noto Serif Regular subset and Frank Ruhl Libre Bold. The weight
 * and style are written into the markup, so that a renderer resolves the
 * face measured; the family is the font's own name (name ID 1), which is
 * what resvg matches. A weight-500 Frank Ruhl Libre is named "Frank Ruhl
 * Libre Medium", so asking for weight 500 of "Frank Ruhl Libre" would fall
 * back silently to another face (plan 096, Y1).
 */
export const SIGIL_STYLE_FONTS = {
  roman: { family: "Noto Serif", weight: 400, style: "normal" },
  hebrew: { family: "Frank Ruhl Libre", weight: 700, style: "normal" },
} as const;

/** The upright Noto Serif subset's measurer. */
export const sigilRomanFont: TextMeasure = textMeasure(fontMetrics.roman);
/** Capital height of the upright Noto Serif, as a fraction of the size. */
export const SIGIL_ROMAN_CAP_HEIGHT =
  fontMetrics.roman.capHeight / fontMetrics.roman.upem;

const romanCodepoints = new Set(
  fontMetrics.roman.advances.filter((_, i) => i % 2 === 0),
);

/** A field the ink is fitted into: a disc, or a box, about its centre. */
export type SigilStyleField =
  | { kind: "disc"; cx: number; cy: number; r: number }
  | { kind: "box"; cx: number; cy: number; w: number; h: number };

/**
 * Each style's geometry, in the rose's 100-unit box about the origin
 * (Y1's figures, plan 096): the rings, the field the sigil is fitted into
 * and the lettering's sizes, in units; a track is per letter, as a fraction
 * of its size.
 */
export const SIGIL_STYLE_GEOMETRY = {
  /** The band and the talisman share the outer and inner rings. */
  ring: { outer: 48.6, inner: 39, stroke: 0.6 },
  band: {
    field: { kind: "disc", cx: 0, cy: 0, r: 36.5 },
    hebrewSize: 8,
    hebrewTrack: 0.08,
    romanSize: 5.2,
    romanTrack: 0.18,
  },
  talisman: {
    /** A fine second ring just inside the outer one. */
    rim: 47.3,
    rimStroke: 0.25,
    /** Where the verse's capitals are centred. */
    verseMiddle: 43.1,
    /** The largest the verse is set: its size, not its capitals' height. */
    verseCap: 5,
    /** The cross's arm, and the arc left clear on each side of it. */
    cross: 3.6,
    crossGap: 1.6,
    crossStroke: 0.45,
    field: { kind: "box", cx: 0, cy: -6, w: 46, h: 44 },
    nameSize: 9.5,
    nameBaseline: 29,
  },
  bare: {
    field: { kind: "box", cx: 0, cy: -9, w: 80, h: 68 },
    nameSize: 6,
    nameTrack: 0.2,
    nameBaseline: 40,
  },
} as const satisfies {
  ring: object;
} & Record<DrawnSigilStyle, { field: SigilStyleField; [k: string]: unknown }>;

/** The ink's half width on screen: every style draws the line 1 unit wide. */
const HALF_STROKE = 0.5;

// ---------------------------------------------------------------- the text

/**
 * The capitals of the lower-case letters in the upright subset (Latin-1),
 * written out so that no locale's `toUpperCase` decides a letter: ß and ÿ
 * have no capital there, and are refused.
 */
const LOWER = "abcdefghijklmnopqrstuvwxyzàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ";
const CAPITALS = new Map([...LOWER].map((ch, i) => [ch, [...UPPER][i]]));

/**
 * `text` in capitals by a fixed table, accents and ligatures kept ("quàm"
 * QUÀM, "cælo" CÆLO, "Sitaël" SITAËL); every other character as it is.
 * Throws on a lower-case letter the table has no capital for, and on a
 * character the upright subset has no glyph for, which a renderer would
 * otherwise draw from another font.
 */
export function sigilStyleCapitals(text: string): string {
  return [...text]
    .map((ch) => {
      const capital = CAPITALS.get(ch);
      if (capital) return capital;
      if (ch !== ch.toUpperCase())
        throw new Error(`No capital for “${ch}” in ${JSON.stringify(text)}`);
      if (!romanCodepoints.has(ch.codePointAt(0) as number))
        throw new Error(
          `“${ch}” (U+${(ch.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, "0")}) is not in the roman subset: ${JSON.stringify(text)}`,
        );
      return ch;
    })
    .join("");
}

/**
 * What the talisman's ring letters, given a verse as the data holds it
 * (plan 096, decision 7): one space between words, the capitals of
 * `sigilStyleCapitals`, and the punctuation as Lenain prints it, his spaced
 * colons included, except a final full stop, whose place the cross at the
 * top takes. Nothing else is added or dropped.
 */
export function sigilStyleLegend(verse: string): string {
  const spaced = verse.replace(/\s+/g, " ").trim();
  return sigilStyleCapitals(spaced.replace(/\s*\.$/, ""));
}

/** The letters a Hebrew name is lettered with: the 22 and the final forms. */
const HEBREW_LETTER = /^[א-ת]$/;

function hebrewLetters(text: string): string {
  const letters = text.trim();
  for (const ch of letters)
    if (!HEBREW_LETTER.test(ch))
      throw new Error(
        `StyledRoseSigilImage letters only Hebrew letters (U+05D0–U+05EA), not “${ch}” in ${JSON.stringify(text)}`,
      );
  return letters;
}

// ---------------------------------------------------------------- the ink

/** A box, in the rose's coordinates. */
export interface InkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Where an arc's circle lies (SVG's endpoint-to-centre conversion, for a
 * circle with no rotation and the small arc, as `wordInk` draws its
 * quarters), and the angles it runs between, increasing with `sweep`.
 */
function arcCircle(from: Point, to: Point, r: number, sweep: boolean) {
  const hx = (from.x - to.x) / 2;
  const hy = (from.y - to.y) / 2;
  const half = hx * hx + hy * hy;
  // A radius too small for its chord is scaled up, as SVG does.
  const radius = Math.max(r, Math.sqrt(half));
  const k =
    (sweep ? 1 : -1) *
    Math.sqrt(Math.max(0, (radius * radius - half) / Math.max(half, 1e-300)));
  const center = {
    x: k * hy + (from.x + to.x) / 2,
    y: -k * hx + (from.y + to.y) / 2,
  };
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  let a1 = Math.atan2(to.y - center.y, to.x - center.x);
  if (sweep && a1 < a0) a1 += 2 * Math.PI;
  if (!sweep && a1 > a0) a1 -= 2 * Math.PI;
  return { center, radius, a0, a1 };
}

/**
 * The exact bounds of a word's ink from its path commands (`wordInk`):
 * every end point, each arc at its circle's extremes where it passes them,
 * and each cubic (a crook's cups) at its own extremes, where its derivative
 * is zero. The stroke's width is not included.
 */
export function inkBounds(commands: readonly InkCommand[]): InkBounds {
  const b = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  const grow = (p: Point) => {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  };
  let pen: Point = { x: 0, y: 0 };
  for (const command of commands) {
    grow(command.to);
    if (command.type === "C") {
      const { c1, c2, to } = command;
      for (const axis of ["x", "y"] as const) {
        const [p0, p1, p2, p3] = [pen[axis], c1[axis], c2[axis], to[axis]];
        // B'(t)/3 = a t² + b t + c.
        const a = -p0 + 3 * p1 - 3 * p2 + p3;
        const bq = 2 * (p0 - 2 * p1 + p2);
        const cq = p1 - p0;
        const roots: number[] = [];
        if (Math.abs(a) < 1e-12) {
          if (Math.abs(bq) > 1e-12) roots.push(-cq / bq);
        } else {
          const disc = bq * bq - 4 * a * cq;
          if (disc >= 0) {
            const s = Math.sqrt(disc);
            roots.push((-bq + s) / (2 * a), (-bq - s) / (2 * a));
          }
        }
        for (const t of roots)
          if (t > 0 && t < 1) {
            const u = 1 - t;
            const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
            grow({
              x: w[0] * pen.x + w[1] * c1.x + w[2] * c2.x + w[3] * to.x,
              y: w[0] * pen.y + w[1] * c1.y + w[2] * c2.y + w[3] * to.y,
            });
          }
      }
    } else if (command.type === "A") {
      const { center, radius, a0, a1 } = arcCircle(
        pen,
        command.to,
        command.r,
        command.sweep,
      );
      const lo = Math.min(a0, a1);
      const hi = Math.max(a0, a1);
      for (let k = -4; k <= 4; k++) {
        const angle = (k * Math.PI) / 2;
        if (angle > lo && angle < hi)
          grow({
            x: center.x + radius * Math.cos(angle),
            y: center.y + radius * Math.sin(angle),
          });
      }
    }
    pen = command.to;
  }
  return b;
}

/** How the ink is moved into its field: `translate(at) scale(scale) translate(−center)`. */
export interface InkFit {
  scale: number;
  /** The ink's bounds' centre, in the rose's coordinates. */
  center: Point;
  /** The field's centre, where `center` is drawn. */
  at: Point;
}

/**
 * The ink centred on its bounds and scaled to fill its field (plan 096,
 * decision 11), its line kept 1 unit wide on screen: a box's sides, or a
 * disc's radius by the bounds' half diagonal, so every corner of the
 * bounds stays inside it.
 */
export function fitInk(bounds: InkBounds, field: SigilStyleField): InkFit {
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const scale =
    field.kind === "disc"
      ? (field.r - HALF_STROKE) / (Math.hypot(w, h) / 2)
      : Math.min(
          (field.w - 2 * HALF_STROKE) / w,
          (field.h - 2 * HALF_STROKE) / h,
        );
  return {
    scale,
    center: {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    },
    at: { x: field.cx, y: field.cy },
  };
}

// ---------------------------------------------------------------- lettering

/**
 * One glyph, drawn as `<text x y transform="rotate(rotate)">` with its
 * anchor in the middle: a ring's glyph stands at (0, y) and is turned
 * about the centre; a row's has no turn.
 */
export interface StyleGlyph {
  char: string;
  /** Its place in the text it letters, spaces counted. */
  index: number;
  x: number;
  y: number;
  /** Degrees clockwise about the figure's centre. */
  rotate: number;
}

/** One run of lettering, in one face and size. */
export interface StyleLettering {
  /** What it letters. */
  role: "hebrew" | "roman" | "verse" | "name";
  font: keyof typeof SIGIL_STYLE_FONTS;
  size: number;
  /** The text lettered, as it is spelt: spaces are not glyphs. */
  text: string;
  /** In reading order. */
  glyphs: StyleGlyph[];
}

/**
 * Each character's distance along a run, to its middle, and the run's
 * length: advances with kerning, each character `track` further on.
 */
function runPlaces(
  chars: readonly string[],
  font: TextMeasure,
  size: number,
  track: number,
) {
  const along: number[] = [];
  let prefix = 0;
  for (let i = 0; i < chars.length; i++) {
    prefix = font.width(chars.slice(0, i + 1).join(""), size);
    along.push(prefix - font.width(chars[i], size) / 2 + track * (i + 0.5));
  }
  return { along, length: prefix + track * chars.length };
}

/**
 * `text` round a circle of `radius`, centred on the angle `middle` (SVG
 * degrees: 270 is the top, 90 the bottom), glyph by glyph: `direction` 1
 * runs clockwise, −1 anticlockwise. Tops outward, a glyph stands at
 * (0, −y) and turns by its angle plus 90; upright at the bottom, at
 * (0, y) and its angle less 90.
 */
function ringGlyphs(
  text: string,
  font: TextMeasure,
  size: number,
  track: number,
  radius: number,
  middle: number,
  direction: 1 | -1,
  baseline: number,
  outward: boolean,
): StyleGlyph[] {
  const chars = [...text];
  const { along, length } = runPlaces(chars, font, size, track);
  return chars.flatMap((char, index) => {
    if (char === " ") return [];
    const angle =
      middle +
      (direction * ((along[index] - length / 2) / radius) * 180) / Math.PI;
    const turn = (((outward ? angle + 90 : angle - 90) % 360) + 360) % 360;
    return [
      {
        char,
        index,
        x: 0,
        y: c(outward ? -baseline : baseline),
        rotate: c(turn),
      },
    ];
  });
}

/** `text` in a row centred on x = 0, left to right, or right to left. */
function rowGlyphs(
  text: string,
  font: TextMeasure,
  size: number,
  track: number,
  baseline: number,
  rightToLeft: boolean,
): StyleGlyph[] {
  const chars = [...text];
  const { along, length } = runPlaces(chars, font, size, track);
  return chars.flatMap((char, index) => {
    if (char === " ") return [];
    const x = along[index] - length / 2;
    return [
      { char, index, x: c(rightToLeft ? -x : x), y: c(baseline), rotate: 0 },
    ];
  });
}

/** How the talisman's verse is set round its ring. */
export interface VerseFit {
  /** The size it is set at: the cap, or less for a long verse. */
  size: number;
  /** Its capitals' height, in units. */
  capHeight: number;
  /** The radius of its baseline. */
  baseline: number;
  /** The space added after each character to fill the ring, in units. */
  track: number;
}

/**
 * The verse round one ring (plan 096, decisions 7 and 9): the largest size
 * up to the cap at which the text, the cross and its gaps fill the circle
 * at the baseline, the capitals centred on the ring's middle; any length
 * left over is shared out between the letters.
 */
export function fitVerse(legend: string): VerseFit {
  const g = SIGIL_STYLE_GEOMETRY.talisman;
  const gap = g.cross + 2 * g.crossGap;
  const cap = SIGIL_ROMAN_CAP_HEIGHT;
  // baseline = middle − cap·size/2, and the text is size × its width at 1.
  const fitted =
    (2 * Math.PI * g.verseMiddle - gap) /
    (sigilRomanFont.width(legend, 1) + Math.PI * cap);
  const size = Math.min(g.verseCap, fitted);
  const baseline = g.verseMiddle - (cap * size) / 2;
  const room = 2 * Math.PI * baseline - gap;
  const track = Math.max(
    0,
    (room - sigilRomanFont.width(legend, size)) / [...legend].length,
  );
  return { size, capHeight: cap * size, baseline, track };
}

// ---------------------------------------------------------------- the figure

/** What `StyledRoseSigilImage` draws, worked out without drawing. */
export interface StyledRoseSigilLayout {
  sigilStyle: DrawnSigilStyle;
  viewBox: [number, number, number, number];
  ink: {
    /** The sigil's path data in the rose's coordinates, in drawing order. */
    paths: string[];
    /** The bounds the fit is made from, in the rose's coordinates. */
    bounds: InkBounds;
    fit: InkFit;
    /** The stroke's width inside the transform: 1 unit on screen. */
    strokeWidth: number;
    transform: string;
  };
  /** Circles drawn round the figure's centre. */
  rings: { r: number; strokeWidth: number }[];
  /** The talisman's cross: its centre and arm. */
  cross?: { at: Point; arm: number; strokeWidth: number };
  /** The talisman's verse as set, and how. */
  verse?: VerseFit & { legend: string };
  lettering: StyleLettering[];
}

/** What a style is drawn from. */
export interface StyledRoseSigilInput {
  /** The Hebrew name: one word, its letters only (U+05D0–U+05EA). */
  text: string;
  sigilStyle: DrawnSigilStyle;
  /** The name in roman letters: the band's bottom, and beneath the bare sigil. */
  roman?: string;
  /** The talisman's verse, as the data holds it (`sigilStyleLegend` sets it). */
  legend?: string;
  /** Which rose the sigil is traced on (`gd` unless given). */
  version?: RoseVersionId;
}

/**
 * Lays out a style (`StyledRoseSigilImage` draws exactly this). Throws for
 * the rose, which is `RoseSigilImage`'s; for a text that is not one word
 * of Hebrew letters; for a talisman without a verse; and for lettering the
 * subsets have no glyph for.
 */
export function styledRoseSigilLayout({
  text,
  sigilStyle,
  roman,
  legend,
  version,
}: StyledRoseSigilInput): StyledRoseSigilLayout {
  if ((sigilStyle as SigilStyle) === "rose")
    throw new Error("The rose style is RoseSigilImage's");
  if (!(SIGIL_STYLES as readonly string[]).includes(sigilStyle))
    throw new Error(`Unknown sigil style ${JSON.stringify(sigilStyle)}`);
  const hebrew = hebrewLetters(text);
  const layout = roseSigilLayout(version);
  const figure = sigilFigure(hebrew, layout, ROSE_SIGIL_PROFILE);
  if (figure.placed.length !== 1)
    throw new Error(
      `StyledRoseSigilImage draws one word, not ${figure.placed.length}: ${JSON.stringify(text)}`,
    );
  const commands = wordInk(
    figure.placed[0],
    layout.unit,
    ROSE_SIGIL_PROFILE,
    figure.frame,
  ).commands;
  const bounds = inkBounds(commands);
  const geometry = SIGIL_STYLE_GEOMETRY;
  const fit = fitInk(bounds, geometry[sigilStyle].field);
  const line = ROSE_SIGIL_PROFILE.strokeWidth ?? layout.unit;
  const ink = {
    paths: figure.paths,
    bounds,
    fit,
    strokeWidth: c(line / fit.scale),
    transform:
      `translate(${c(fit.at.x)} ${c(fit.at.y)}) scale(${c(fit.scale)}) ` +
      `translate(${c(-fit.center.x)} ${c(-fit.center.y)})`,
  };
  const viewBox = figure.viewBox;
  const { ring } = geometry;
  const romanText = roman === undefined ? "" : sigilStyleCapitals(roman.trim());

  if (sigilStyle === "bare") {
    const g = geometry.bare;
    return {
      sigilStyle,
      viewBox,
      ink,
      rings: [],
      lettering: romanText
        ? [
            {
              role: "roman",
              font: "roman",
              size: g.nameSize,
              text: romanText,
              glyphs: rowGlyphs(
                romanText,
                sigilRomanFont,
                g.nameSize,
                g.nameTrack * g.nameSize,
                g.nameBaseline,
                false,
              ),
            },
          ]
        : [],
    };
  }

  const middle = (ring.outer + ring.inner) / 2;
  const rings = [
    { r: ring.outer, strokeWidth: ring.stroke },
    { r: ring.inner, strokeWidth: ring.stroke },
  ];

  if (sigilStyle === "band") {
    const g = geometry.band;
    // The Hebrew's letters centred on the band, right to left across the
    // top (anticlockwise), tops outward.
    const centre = (hebrewFont.top - hebrewFont.bottom) / 2;
    const heBaseline = middle - centre * g.hebrewSize;
    const lettering: StyleLettering[] = [
      {
        role: "hebrew",
        font: "hebrew",
        size: g.hebrewSize,
        text: hebrew,
        glyphs: ringGlyphs(
          hebrew,
          hebrewFont,
          g.hebrewSize,
          g.hebrewTrack * g.hebrewSize,
          heBaseline,
          270,
          -1,
          heBaseline,
          true,
        ),
      },
    ];
    if (romanText) {
      // Upright at the bottom (decision 10), left to right, which runs
      // anticlockwise there: the capitals centred on the band, their tops
      // towards the centre.
      const capHeight = SIGIL_ROMAN_CAP_HEIGHT * g.romanSize;
      lettering.push({
        role: "roman",
        font: "roman",
        size: g.romanSize,
        text: romanText,
        glyphs: ringGlyphs(
          romanText,
          sigilRomanFont,
          g.romanSize,
          g.romanTrack * g.romanSize,
          middle,
          90,
          -1,
          middle + capHeight / 2,
          false,
        ),
      });
    }
    return { sigilStyle, viewBox, ink, rings, lettering };
  }

  const g = geometry.talisman;
  if (legend === undefined || legend.trim() === "")
    throw new Error("A talisman needs its verse (`legend`)");
  const verseText = sigilStyleLegend(legend);
  const verse = fitVerse(verseText);
  const nameText = hebrew;
  return {
    sigilStyle,
    viewBox,
    ink,
    rings: [
      { r: ring.outer, strokeWidth: ring.stroke },
      { r: g.rim, strokeWidth: g.rimStroke },
      { r: ring.inner, strokeWidth: ring.stroke },
    ],
    cross: {
      at: { x: 0, y: -g.verseMiddle },
      arm: g.cross,
      strokeWidth: g.crossStroke,
    },
    verse: { ...verse, legend: verseText },
    lettering: [
      {
        role: "verse",
        font: "roman",
        size: verse.size,
        text: verseText,
        // Clockwise from the cross: the run's middle is opposite it.
        glyphs: ringGlyphs(
          verseText,
          sigilRomanFont,
          verse.size,
          verse.track,
          verse.baseline,
          90,
          1,
          verse.baseline,
          true,
        ),
      },
      {
        role: "name",
        font: "hebrew",
        size: g.nameSize,
        text: nameText,
        glyphs: rowGlyphs(
          nameText,
          hebrewFont,
          g.nameSize,
          0,
          g.nameBaseline,
          true,
        ),
      },
    ],
  };
}

/** `StyledRoseSigilImage`'s props. */
export interface StyledRoseSigilImageProps extends StyledRoseSigilInput {
  /**
   * The roman lettering's `font-family`: Noto Serif's own name unless
   * given, as the subset names itself; a stack may name the face first.
   */
  latinFamily?: string;
  /** The Hebrew lettering's `font-family`: "Frank Ruhl Libre" unless given. */
  hebrewFamily?: string;
  /** The rings', cross's and lettering's colour (default black). */
  ink?: string;
  /** The sigil's colour (default red, as the rose sigil's). */
  stroke?: string;
  /** The `<svg>`'s width (CSS pixels for a number); none unless given. */
  width?: number | string;
  /** The `<svg>`'s height; none unless given. */
  height?: number | string;
  /** The `<svg>`'s class. */
  className?: string;
  /** The drawing's accessible name; without one it is hidden as decorative. */
  "aria-label"?: string;
}

/**
 * An angel's sigil in one of the styles (plan 096), with no hooks, so a
 * server renderer draws it with React's server build. Its viewBox is the
 * rose's (100 units square for a word), so a style never changes the
 * figure's size or shape. The lettering's weights and style are written
 * into the markup (`SIGIL_STYLE_FONTS`); the caller supplies the faces.
 */
export function StyledRoseSigilImage({
  latinFamily = SIGIL_STYLE_FONTS.roman.family,
  hebrewFamily = SIGIL_STYLE_FONTS.hebrew.family,
  ink = "#000",
  stroke = "red",
  width,
  height,
  className,
  "aria-label": label,
  ...input
}: StyledRoseSigilImageProps) {
  const figure = styledRoseSigilLayout(input);
  const family = { roman: latinFamily, hebrew: hebrewFamily };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox={figure.viewBox.join(" ")}
      width={width}
      height={height}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {figure.rings.map((ring) => (
        <circle
          key={ring.r}
          r={c(ring.r)}
          fill="none"
          stroke={ink}
          strokeWidth={c(ring.strokeWidth)}
        />
      ))}
      {figure.cross && (
        <path
          d={crossPath(figure.cross.at, figure.cross.arm)}
          fill="none"
          stroke={ink}
          strokeWidth={c(figure.cross.strokeWidth)}
        />
      )}
      {figure.lettering.map((run) => (
        <g
          key={run.role}
          fontFamily={family[run.font]}
          fontWeight={SIGIL_STYLE_FONTS[run.font].weight}
          fontStyle={SIGIL_STYLE_FONTS[run.font].style}
          fontSize={c(run.size)}
          fill={ink}
          textAnchor="middle"
        >
          {run.glyphs.map((glyph) => (
            <text
              key={glyph.index}
              x={glyph.x || undefined}
              y={glyph.y}
              transform={glyph.rotate ? `rotate(${glyph.rotate})` : undefined}
            >
              {glyph.char}
            </text>
          ))}
        </g>
      ))}
      <g
        transform={figure.ink.transform}
        stroke={stroke}
        strokeWidth={figure.ink.strokeWidth}
        fill="none"
      >
        {figure.ink.paths.map((d, i) => (
          // Paths in drawing order, which the text fixes.
          // biome-ignore lint/suspicious/noArrayIndexKey: the order is the identity.
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}

function crossPath(at: Point, arm: number): string {
  const a = arm / 2;
  return (
    `M${c(at.x - a)},${c(at.y)}H${c(at.x + a)}` +
    `M${c(at.x)},${c(at.y - a)}V${c(at.y + a)}`
  );
}

export default StyledRoseSigilImage;
