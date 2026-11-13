import type { CSSProperties, SVGProps } from "react";

/**
 * The geomantic sigils of the seven planetary spirits, whom geomancy calls
 * the Rulers of the figures: Zazel (Saturn), Hismael (Jupiter), Bartzabel
 * (Mars), Sorath (the Sun), Kedemel (Venus), Taphthartharath (Mercury) and
 * Chasmodai (the Moon). They are not the spirits' seals that Agrippa prints
 * with the planets' tables (*De occulta philosophia*, 1533, II.22), which
 * are other figures.
 *
 * Drawn after the earliest printing found of them, John Heydon,
 * *Theomagia, or The Temple of Wisdome*, vol. 1 (London, 1663/4), book I,
 * chapter 5, the table of the figures' Rulers and Genii; the Getty Research
 * Institute's copy on archive.org, `theomagiaortempl00heyd`: p. 13 (leaf
 * n124) and p. 15 (n126). Book I, chapter 13, p. 46 (n157) prints them
 * again, with Mercury's, the Sun's and Venus' in other forms; the Golden
 * Dawn's later forms descend from those of pp. 13 and 15. Each sigil
 * below names the figure it follows.
 *
 * Our own drawing, not a tracing: each is a few hand-placed strokes of one
 * width on a grid of 100 laid over the printed figure, with round ends. The
 * viewBox is the stroke's extent, plus a unit. Copyright Gadi Cohen, MIT
 * like the rest of the package.
 */
const SIGILS = {
  /** Mars: a tail ending in a spiral; Heydon, p. 13 (n124), first row. */
  bartzabel: {
    viewBox: "16 33 67 39",
    d:
      "M27 64C22 64 20 60 21 55C22 50 28 49 34 50C42 51 46 56 51 61" +
      "C55 65 60 67 66 67C74 67 79 60 78 51C77 43 71 38 65 38" +
      "C60 38 57 43 58 48C59 53 63 55 66 54",
  },
  /** Venus: a heart whose lobes curl in; p. 13 (n124), fourth row. */
  kedemel: {
    viewBox: "24 25 54 55",
    d:
      "M55 44C51 39 53 31 58 30C64 29 67 35 69 43C70 52 72 64 73 75" +
      "C62 72 47 66 38 58C31 52 29 45 29 39C29 33 33 30 38 30" +
      "C43 31 46 36 48 43",
  },
  /** Mercury: a bar and an upright over a cross; p. 13 (n124), second row. */
  taphthartharath: {
    viewBox: "17 19 68 61",
    d: "M23 24V38M23 31H62V75M22 45V59M22 52H80M80 42V56M57 75H68",
  },
  /** The Moon: like a 5; p. 13 (n124), third row. */
  chasmodai: {
    viewBox: "23 20 56 63",
    d: "M74 25L32 40C42 43 52 50 56 58C58 66 54 74 45 77C38 79 32 78 28 76",
  },
  /**
   * The Sun: an upright with a foot, crossed by a bar that curls back on
   * the left and runs into a long stroke on the right; p. 13 (n124), fifth
   * row, and p. 15 (n126).
   */
  sorath: {
    viewBox: "23 17 68 65",
    d:
      "M57 22H65M59 22L61 68H53" +
      "M43 55C38 60 29 57 28 49C27 42 35 39 42 41C50 43 55 46 62 46" +
      "C70 46 77 44 81 38M84 26C82 38 85 50 86 62C87 72 83 77 76 77",
  },
  /** Jupiter: two strokes meeting in a point; p. 15 (n126), first row. */
  hismael: {
    viewBox: "19 20 63 56",
    d: "M24 35C38 48 54 60 77 71M49 25L70 69",
  },
  /**
   * Saturn: a half-moon with a dot, its straight side up to the right;
   * p. 15 (n126), fourth row. The dot is a stroke one unit long, which
   * its round ends make a dot, so the sigil is one stroke in one colour (a
   * tiny stroked circle would do, but some renderers leave its centre
   * open).
   */
  zazel: {
    viewBox: "25 17 56 59",
    d:
      "M41 22C32 31 28 46 30 58C32 67 40 71 50 71C60 71 70 69 76 64Z" +
      "M43.5 51H44.5",
  },
} as const satisfies Record<string, { viewBox: string; d: string }>;

/** The sigils' stroke, in units of the grid of 100 they are drawn on. */
const STROKE_WIDTH = 7;

/** A planetary spirit with a sigil: `bartzabel`, `kedemel`, … */
export type PlanetarySpiritId = keyof typeof SIGILS;

/** Every spirit with a sigil. */
export const PLANETARY_SPIRIT_IDS = Object.keys(SIGILS) as PlanetarySpiritId[];

/** Whether `id` names a spirit this module draws. */
export const isPlanetarySpiritId = (id: string): id is PlanetarySpiritId =>
  Object.hasOwn(SIGILS, id);

function Sigil({
  id,
  ...props
}: { id: PlanetarySpiritId } & SVGProps<SVGSVGElement>) {
  const { viewBox, d } = SIGILS[id];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} {...props}>
      <path
        d={d}
        fill="none"
        stroke="#000"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface PlanetarySpiritProps extends CSSProperties {
  /**
   * The spirit (its figures' Ruler), in lower case; none, or an id with no
   * sigil, draws nothing.
   */
  id?: string;
  /** Hides the sigil from assistive technology when the text names it. */
  "aria-hidden"?: boolean;
}

/**
 * A planetary spirit's geomantic sigil, centred in a flex box as tall as its
 * container allows. Every prop but `id` and `aria-hidden` is the box's
 * style.
 */
export default function PlanetarySpirit(props: PlanetarySpiritProps) {
  // Everything but the id and `aria-hidden` is style, as its callers pass it.
  const { id, "aria-hidden": ariaHidden, ...rest } = props;
  if (id === undefined || !isPlanetarySpiritId(id)) return null;
  return (
    <div
      aria-hidden={ariaHidden}
      style={{
        display: "flex",
        alignContent: "center",
        justifyContent: "center",
        ...rest,
      }}
    >
      <Sigil id={id} height="100%" />
    </div>
  );
}
