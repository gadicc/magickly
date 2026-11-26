/**
 * How the symbol on each side of a Golden Dawn pyramid is turned when it
 * is drawn "outward" (`pyramidSymbols="outward"`): in degrees, as an SVG
 * `rotate()` of a mark drawn upright and centred on 0, 0, by side in the
 * sides' order, 1 to 4 (`PYRAMID_SYMBOL_TURNS[side - 1]`): side 1 on the
 * left, 2 at the top, 3 on the right, 4 at the bottom (Regardie, The
 * Golden Dawn, vol. 4 (1940), p.293).
 *
 * Each symbol stands on its side's outer edge, the square's own, with
 * its head toward the flat top, as Regardie's drawings have them (which
 * we take to mean that a face of a real pyramid is read from outside
 * it; no source states it as a rule): the three ORO
 * pyramids of the Air tablet on p.294 (archive.org
 * `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaf n286), and the two
 * worked squares on p.296 (leaf n288), whose top sides' symbols stand
 * upside down on the page. Seen from above, as a tablet is drawn, the
 * left side's symbol is turned a quarter clockwise (`rotate(90)`, its
 * head to the right in SVG's y-down frame), the top's half a turn, the
 * right's a quarter anticlockwise, and the bottom's not at all.
 * `"upright"` draws them all unturned instead, as the Equinox I(7)'s
 * plates do (1912, "Liber Chanokh", Plates IV to VIII). Which way the
 * Order itself painted them, these two witnesses do not settle.
 *
 * A side's head direction is the turn applied to the mark's up, (0, -1),
 * and points from the side toward the square's centre. A view that
 * lifts each side onto a face of its own keeps the same turns: the
 * symbol's foot stays on the face's lower edge.
 *
 * Its own module, which loads no data, so that the drawing the hall's art
 * shares can read it without the marks' data (`Tablet.tsx`);
 * `enochian/pyramidMarks` exports it.
 */
export const PYRAMID_SYMBOL_TURNS: readonly [
  side1: 90,
  side2: 180,
  side3: -90,
  side4: 0,
] = Object.freeze([90, 180, -90, 0] as const);
