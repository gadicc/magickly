/**
 * The symbols painted on the sides of the Golden Dawn's truncated
 * pyramids (Regardie, The Golden Dawn, vol. 4 (1940), pp.293–296): which
 * symbol a side shows, its inks, and its mark, drawn centred on 0, 0 in a
 * box of about 34 units. `enochian/Tablet` draws them on every square
 * with `pyramidSymbols`; a page may draw one square large with them, as
 * magick.ly's tablets page does.
 */

import planets from "magick-data/astrology/planets";
import zodiac from "magick-data/astrology/zodiac";
import type { TabletPyramidSide } from "magick-data/enochian/tabletPyramids";
import tetragrams from "magick-data/geomancy/tetragrams";
import hebrewLetters from "magick-data/hebrewLetters";
import sephirot from "magick-data/kabbalah/sephirot";

/** An element of a side: the four and Spirit. */
export type SideElement = "fire" | "water" | "air" | "earth" | "spirit";

/** What a side's symbol is, for the drawing. */
export type SideSymbol =
  | { kind: "text"; text: string; hebrew?: boolean }
  | { kind: "element"; element: SideElement }
  | { kind: "figure"; rows: readonly number[] };

/**
 * Text presentation for a symbol that may otherwise be drawn as an emoji:
 * the zodiac's carry U+FE0E in the data, the planets' and Spirit's wheel
 * do not.
 */
export const asText = (symbol: string) =>
  symbol.endsWith("\uFE0E") ? symbol : `${symbol}\uFE0E`;

/** A Hebrew letter's glyph, by its id. */
const letterOf = (id: string) =>
  (hebrewLetters as Record<string, { letter: { he: string } }>)[id]?.letter.he;

/**
 * The symbol painted on a side: its sign, planet, Sephirah's number,
 * Hebrew letter or geomantic figure, and where the side carries none of
 * these (Spirit, an element alone, a card or a trump), its element's.
 * Ours, not the sources': they paint a symbol of each kind, and the
 * drawing shows the one a reader is most likely to know.
 */
export function sideSymbol(side: TabletPyramidSide): SideSymbol {
  const { attribution: a } = side;
  if (a.zodiacId)
    return { kind: "text", text: asText(zodiac[a.zodiacId].symbol) };
  if (a.sephirahId)
    return { kind: "text", text: String(sephirot[a.sephirahId].index) };
  if (a.planetId)
    return { kind: "text", text: asText(planets[a.planetId].symbol) };
  if (a.hebrewLetterId)
    return {
      kind: "text",
      text: letterOf(a.hebrewLetterId) ?? "",
      hebrew: true,
    };
  if (a.tetragramId)
    return { kind: "figure", rows: tetragrams[a.tetragramId].rows };
  return {
    kind: "element",
    element: (a.elementId ?? side.elementId ?? "spirit") as SideElement,
  };
}

/** A symbol's inks: its colour, and the outline that sets it off its side. */
export interface MarkInks {
  ink: string;
  outline: string;
}

/**
 * The colour of a symbol painted on a side, its side's complement (vol.
 * 4, pp.294–295): green on Fire's red, orange on Water's blue, violet on
 * Air's yellow, white on Earth's black, black on Spirit's white, and
 * black on a Calvary square's white side with no element (`none`). The
 * sides' own colours are `PYRAMID_COLOURS`, by the same keys; the green
 * and orange are those the tablets' angles are lettered in. A complement
 * can be close to its ground in lightness (the green on red, the orange on
 * blue), so every symbol is drawn with a thin `outline`, dark on a light
 * ground and light on a dark one, which stands out from the ground by at
 * least 3:1.
 */
export const PYRAMID_SYMBOL_INKS: Readonly<
  Record<SideElement | "none", MarkInks>
> = Object.freeze({
  fire: { ink: "#22bb22", outline: "#000000" },
  water: { ink: "#ff8800", outline: "#000000" },
  air: { ink: "#7b1fa2", outline: "#000000" },
  earth: { ink: "#ffffff", outline: "#ffffff" },
  spirit: { ink: "#000000", outline: "#000000" },
  none: { ink: "#000000", outline: "#000000" },
});

/** A side's inks, by its element (`none` where it has none). */
export const inksOf = (side: TabletPyramidSide): MarkInks =>
  PYRAMID_SYMBOL_INKS[(side.elementId as SideElement | undefined) ?? "none"];

/**
 * How wide each mark's outline is drawn, in the mark's 34-unit box: under
 * an element's strokes (which are 3 wide), round a figure's dots, and
 * round a glyph.
 */
export interface MarkOutlines {
  element: number;
  figure: number;
  text: number;
}

/** The outlines of a mark drawn large, as one square's pyramid is. */
export const MARK_OUTLINES: Readonly<MarkOutlines> = Object.freeze({
  element: 6,
  figure: 1.5,
  text: 3,
});

/**
 * The outlines of a mark drawn small, on every square of a tablet: at
 * the large mark's widths, they fill Spirit's wheel.
 */
export const TABLET_MARK_OUTLINES: Readonly<MarkOutlines> = Object.freeze({
  element: 4.5,
  figure: 1,
  text: 1.5,
});

/** The fonts a sign's or planet's symbol is drawn in, as text. */
const SYMBOL_FONTS =
  '"Segoe UI Symbol", "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", sans-serif';

/** The fonts a Hebrew letter is drawn in. */
const HEBREW_FONTS = '"Frank Ruhl Libre", "Noto Sans Hebrew", serif';

/** An element's triangle's or Spirit's wheel's strokes, centred on 0, 0. */
function ElementStrokes({ element }: { element: SideElement }) {
  if (element === "spirit")
    return (
      <>
        <circle r={13} />
        {[0, 45, 90, 135].map((angle) => (
          <line key={angle} x1={-13} x2={13} transform={`rotate(${angle})`} />
        ))}
      </>
    );
  const up = element === "fire" || element === "air";
  const tip = up ? -15 : 15;
  const base = up ? 9 : -9;
  return (
    <>
      <path d={`M0 ${tip}L14 ${base}L-14 ${base}Z`} />
      {(element === "air" || element === "earth") && <line x1={-12} x2={12} />}
    </>
  );
}

/** An element's mark: its strokes over a wider stroke of the outline. */
function ElementMark({
  element,
  ink,
  outline,
  width,
}: { element: SideElement; width: number } & MarkInks) {
  const stroke = (colour: string, strokeWidth: number) => ({
    fill: "none",
    stroke: colour,
    strokeWidth,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  });
  return (
    <>
      <g style={stroke(outline, width)} data-outline="">
        <ElementStrokes element={element} />
      </g>
      <g style={stroke(ink, 3)}>
        <ElementStrokes element={element} />
      </g>
    </>
  );
}

/** A geomantic figure: a row of one or two dots for each of its four. */
function Figure({
  rows,
  ink,
  outline,
  width,
}: { rows: readonly number[]; width: number } & MarkInks) {
  const dots = rows.flatMap((count, row) =>
    (count === 1 ? [0] : [-6, 6]).map((cx) => ({ cx, cy: (row - 1.5) * 8 })),
  );
  return (
    <g
      style={{
        fill: ink,
        stroke: outline,
        strokeWidth: width,
        paintOrder: "stroke",
      }}
      data-outline=""
    >
      {dots.map(({ cx, cy }) => (
        <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={2.8} />
      ))}
    </g>
  );
}

/**
 * A side's symbol, centred on 0, 0 in a box of about 34 units, upright:
 * a glyph (a sign, a planet, a number or a Hebrew letter), a geomantic
 * figure's dots or an element's mark, in its ink over its outline.
 */
export function SideMark({
  symbol,
  ink,
  outline,
  outlines = MARK_OUTLINES,
}: {
  symbol: SideSymbol;
  /** The outlines' widths: `MARK_OUTLINES` unless given. */
  outlines?: MarkOutlines;
} & MarkInks) {
  if (symbol.kind === "element")
    return (
      <ElementMark
        element={symbol.element}
        ink={ink}
        outline={outline}
        width={outlines.element}
      />
    );
  if (symbol.kind === "figure")
    return (
      <Figure
        rows={symbol.rows}
        ink={ink}
        outline={outline}
        width={outlines.figure}
      />
    );
  return (
    <text
      y={11}
      data-outline=""
      style={{
        fill: ink,
        // The outline under the glyph, not over it.
        stroke: outline,
        strokeWidth: outlines.text,
        strokeLinejoin: "round",
        paintOrder: "stroke",
        fontSize: symbol.hebrew ? 34 : 32,
        fontFamily: symbol.hebrew ? HEBREW_FONTS : SYMBOL_FONTS,
        textAnchor: "middle",
      }}
      {...(symbol.hebrew ? { direction: "rtl" } : {})}
    >
      {symbol.text}
    </text>
  );
}
