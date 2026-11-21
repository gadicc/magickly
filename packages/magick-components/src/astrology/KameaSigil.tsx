import type { KameaPlanetId } from "magick-data/astrology/kameas";
import kameas from "magick-data/astrology/kameas";
import planets from "magick-data/astrology/planets";
import type { CSSProperties } from "react";
import { sigilSubpaths, sigilViewBox } from "../sigil/ink.ts";
import {
  KAMEA_SIGIL_PROFILE,
  kameaLayout,
  kameaSigilMinSize,
} from "../sigil/kameaLayout.ts";
import type { PlacementFailure } from "../sigil/placeSigil.ts";
import {
  type SigilFigure,
  SigilImage,
  sigilFigure,
} from "../sigil/SigilImage.tsx";
import { svgCoordinate } from "../svgCoordinate.ts";
import { KameaFigure } from "./Kamea.tsx";

/*
 * A name's sigil traced on its planet's kamea (plan 093, K3): the square
 * (`KameaFigure`) under the sigil the Golden Dawn's rules draw on it
 * (`kameaLayout`, `KAMEA_SIGIL_PROFILE`), once per word. A multi-word
 * name is one figure per word, each on its own square (decision 10):
 * `KameaSigil` sets them side by side, right to left, wrapping on a
 * narrow screen; `KameaSigilImage` draws them in one row, one `<svg>`, for
 * a download or an image route. Both draw the same figures, placed once
 * for the whole text, and neither uses hooks, so the server draws them.
 */

/** A text traced on a planet's kamea, worked out without drawing. */
export interface KameaSigilFigure {
  planet: KameaPlanetId;
  /** The text as given. */
  text: string;
  /** Whether final forms counted at 500 to 900. */
  finals: boolean;
  /** The whole text's sigil (`sigilFigure`), all its words in one row. */
  figure: SigilFigure;
  /** Per word, in reading order: its own one-word figure. */
  words: SigilFigure[];
  /**
   * Whether any word's figure still fails placement's checks: drawn best
   * effort, it may be hard to read (`figure.failures` says which and why).
   */
  failed: boolean;
}

/** How a text is traced (`kameaSigil`). */
export interface KameaSigilOptions {
  /** Count final forms at Aiq Bekar's 500 to 900 (default false). */
  finals?: boolean;
}

/**
 * `text` (Hebrew) traced on `planet`'s kamea: planned and placed once for
 * the whole text, as `KameaSigilImage` draws it, and split into its words
 * as `KameaSigil` draws them, with whether placement left any word
 * failing. A page that says so (or keeps the figure between renders)
 * passes it to the components as `sigil`, so the text is not placed
 * twice. Throws a `RangeError` for a planet without a square.
 */
export function kameaSigil(
  planet: KameaPlanetId,
  text: string,
  { finals = false }: KameaSigilOptions = {},
): KameaSigilFigure {
  const layout = kameaLayout(planet, { finals });
  const figure = sigilFigure(text, layout, KAMEA_SIGIL_PROFILE);
  const words = figure.placed.map(
    (placed, i): SigilFigure => ({
      plan: [figure.plan[i]],
      placed: [placed],
      failures: [figure.failures[i]],
      paths: sigilSubpaths([placed], layout, KAMEA_SIGIL_PROFILE),
      frame: figure.frame,
      viewBox: sigilViewBox(figure.frame, 1),
    }),
  );
  return {
    planet,
    text,
    finals,
    figure,
    words,
    failed: figure.failures.some((f: readonly PlacementFailure[]) => f.length),
  };
}

export interface KameaSigilProps {
  /** The planet, by magick-data's id. */
  planet: KameaPlanetId;
  /**
   * The text, in Hebrew letters; whitespace separates words, each its
   * own figure. Anything not one of the 27 letters (points, a maqaf) is
   * left out.
   */
  text: string;
  /** Count final forms at Aiq Bekar's 500 to 900 (default false). */
  finals?: boolean;
  /**
   * Each word's figure's width in CSS pixels, its square's frame and
   * margin included: never under the square's own minimum
   * (`kameaSigilMinSize`, 240 to 329), which is also the default.
   */
  size?: number;
  /** The sigil's ink (default red, as the rose sigil's). */
  ink?: string;
  /** The square's frame, rules and numbers (default black). */
  squareInk?: string;
  /** The square's ground (default white). */
  paper?: string;
  /** The square's numbers' font stack. */
  fontFamily?: string;
  /**
   * The drawing's accessible name: "Sigil of <text> on the Kamea of
   * <planet>" when not given, this one when a string. `false` marks it
   * decorative, hidden from assistive technology (`aria-hidden`).
   */
  label?: string | false;
  /** The outer element's class. */
  className?: string;
  /** The outer element's style. */
  style?: CSSProperties;
  /**
   * The text already worked out by `kameaSigil` for this planet, text and
   * finals, so a page that needs it too does not place it twice. One for
   * another planet, text or finals is ignored, and the drawing worked out
   * from the props, so what is drawn is always what the props say.
   */
  sigil?: KameaSigilFigure;
}

/** The planet's English name, as `Kamea` names its square. */
function planetName(planet: KameaPlanetId): string {
  return planets[planet].name.en.en;
}

/** The default accessible name: the square's own for an empty text. */
function defaultLabel(planet: KameaPlanetId, text: string): string {
  const words = text.trim().replace(/\s+/g, " ");
  const square = `Kamea of ${planetName(planet)}`;
  return words ? `Sigil of ${words} on the ${square}` : square;
}

/**
 * `sigil` if it was worked out for these props, otherwise the props'
 * own (`KameaSigilProps.sigil`).
 */
function sigilFor(
  planet: KameaPlanetId,
  text: string,
  finals: boolean,
  sigil: KameaSigilFigure | undefined,
): KameaSigilFigure {
  return sigil &&
    sigil.planet === planet &&
    sigil.text === text &&
    sigil.finals === finals
    ? sigil
    : kameaSigil(checked(planet), text, { finals });
}

/**
 * The size to draw at: `size` if it is a number at or over the square's
 * minimum, the minimum otherwise.
 */
function clampedSize(planet: KameaPlanetId, size?: number): number {
  const least = kameaSigilMinSize(planet);
  return typeof size === "number" && Number.isFinite(size) && size > least
    ? size
    : least;
}

/** The planet, refused with a `RangeError` unless it has a square. */
function checked(planet: KameaPlanetId): KameaPlanetId {
  if (!Object.hasOwn(kameas, planet))
    throw new RangeError(`Not a planet with a kamea: ${planet}`);
  return planet;
}

/** The square under one word, at that word's offset. */
function square(
  props: Pick<KameaSigilProps, "planet" | "squareInk" | "paper" | "fontFamily">,
) {
  return (offset: { x: number; y: number }, index: number) => {
    const figure = (
      <KameaFigure
        planet={props.planet}
        ink={props.squareInk}
        paper={props.paper}
        fontFamily={props.fontFamily}
      />
    );
    return offset.x === 0 && offset.y === 0 ? (
      <g key={index}>{figure}</g>
    ) : (
      <g
        key={index}
        transform={`translate(${svgCoordinate(offset.x)} ${svgCoordinate(offset.y)})`}
      >
        {figure}
      </g>
    );
  };
}

/**
 * A name's sigil on its planet's kamea, one figure per word, each on its
 * own square `size` pixels across, set right to left and wrapping onto
 * the next line where the width runs out (an empty text, the bare
 * square). The figures are `<svg>`s in a
 * `<div>`, which is the image (named by `label`). A text placement could
 * not draw with every mark clear is drawn best effort, and says so:
 * `data-placement="failed"` on the `<div>` and on each such word's
 * `<svg>` (`kameaSigil`'s `failed` gives the same to the page).
 */
export function KameaSigil({
  planet,
  text,
  finals = false,
  size,
  ink = "red",
  squareInk,
  paper,
  fontFamily,
  label,
  className,
  style,
  sigil: given,
}: KameaSigilProps) {
  const sigil = sigilFor(planet, text, finals, given);
  const layout = kameaLayout(planet, { finals });
  const width = clampedSize(planet, size);
  const name = label === undefined ? defaultLabel(planet, text) : label;
  const backdrop = square({ planet, squareInk, paper, fontFamily });
  return (
    <div
      dir="rtl"
      className={className}
      style={{ display: "flex", flexWrap: "wrap", ...style }}
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      data-placement={sigil.failed ? "failed" : undefined}
    >
      {(sigil.words.length ? sigil.words : [sigil.figure]).map((word, i) => (
        <SigilImage
          // Words in reading order; a text's words are its identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: the order is the identity.
          key={i}
          text=""
          layout={layout}
          profile={KAMEA_SIGIL_PROFILE}
          figure={word}
          stroke={ink}
          backdrop={backdrop}
          width={width}
          height={width}
          aria-hidden
          data-placement={
            word.failures.some((f) => f.length > 0) ? "failed" : undefined
          }
        />
      ))}
    </div>
  );
}

export type KameaSigilImageProps = KameaSigilProps;

/**
 * The same sigil in one `<svg>`: every word on its own square, in one row
 * from right to left, `size` pixels a word across. What a download or an
 * image route serves; `KameaSigil` draws the same figures, wrapping.
 */
export function KameaSigilImage({
  planet,
  text,
  finals = false,
  size,
  ink = "red",
  squareInk,
  paper,
  fontFamily,
  label,
  className,
  style,
  sigil: given,
}: KameaSigilImageProps) {
  const sigil = sigilFor(planet, text, finals, given);
  const layout = kameaLayout(planet, { finals });
  const width = clampedSize(planet, size);
  const name = label === undefined ? defaultLabel(planet, text) : label;
  const regions = Math.max(1, sigil.figure.plan.length);
  return (
    <SigilImage
      text=""
      layout={layout}
      profile={KAMEA_SIGIL_PROFILE}
      figure={sigil.figure}
      stroke={ink}
      backdrop={square({ planet, squareInk, paper, fontFamily })}
      width={svgCoordinate(width * regions)}
      height={width}
      className={className}
      style={style}
      role={name ? "img" : undefined}
      aria-label={name || undefined}
      aria-hidden={name ? undefined : true}
      data-placement={sigil.failed ? "failed" : undefined}
    />
  );
}

export default KameaSigil;
