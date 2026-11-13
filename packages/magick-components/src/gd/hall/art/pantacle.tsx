import { svgCoordinate } from "../../../svgCoordinate";
import { GD_HALL_FONT_STACKS } from "../fonts";
import { hebrewFont, labelFont, type TextMeasure } from "../labels";
import type { HallArt } from "../types";
import { points } from "./geometry";
import { original, PALETTE, sameForEveryNode } from "./shared";

export const provenance = {
  ...original(
    "The Pantacle drawn from geometry after Gadi Cohen's own Theoricus " +
      "badge design: the Earth disc in its four " +
      "colours, an interlaced hexagram and a ring naming the Earth's " +
      "correspondences. The names are set letter by letter in the hall fonts " +
      "(SIL OFL 1.1); no glyph outlines are copied into the code.",
  ),
};

/** Radii in the 100-unit box. */
const OUTER = 49;
const DISC = 40.5;
/** Where the ring's text stands. */
const BASELINE = 42.6;
/** The hexagram's centre line and band. */
const STAR = 32;
const BAND = 5;
const EDGE = 1.4;

/** The Earth's colours, quartered as in the drawing: citrine above. */
const QUARTERS = [
  { angle: -90, fill: PALETTE.citrine }, // East (up)
  { angle: 0, fill: PALETTE.olive },
  { angle: 90, fill: PALETTE.earthBlack },
  { angle: 180, fill: PALETTE.russet },
] as const;

/**
 * The ring: "SAPERE AUDE" at the top, then the Earth's names in the
 * order the drawing gives them (its "אאאאדני" read as אדני), each in an
 * eighth of the ring, reading on in the Hebrew direction (anticlockwise).
 */
const RING: readonly { text: string; hebrew: boolean }[] = [
  { text: "SAPERE AUDE", hebrew: false },
  ...["אדני", "אוריאל", "כרוב", "פרת", "צפון", "פורלאך", "ארץ"].map((text) => ({
    text,
    hebrew: true,
  })),
];

/** Sizes of the ring's letters, in units. */
const LATIN_SIZE = 5;
const HEBREW_SIZE = 6.4;

/** One letter on the ring: its character and where its advance centres. */
interface RingGlyph {
  char: string;
  /** Degrees clockwise from the x axis (SVG angles; 270 is the top). */
  angle: number;
}

/**
 * Where each letter of a name stands, its baseline on the ring and its top
 * outward. Measured in logical order with the font's advances and kern
 * pairs; Latin runs clockwise and Hebrew anticlockwise, so both read on
 * from the name before. Each letter is drawn alone, so no renderer's bidi
 * or text-on-path support (resvg reverses Hebrew on a path; rsvg draws no
 * `textPath`) changes the order.
 */
function ringGlyphs(
  text: string,
  centre: number,
  font: TextMeasure,
  size: number,
  rightToLeft: boolean,
): RingGlyph[] {
  const chars = [...text];
  const total = font.width(text, size);
  return chars.flatMap((char, index) => {
    if (char === " ") return [];
    // The letter's centre, from the start of the name in reading order.
    const along =
      font.width(chars.slice(0, index + 1).join(""), size) -
      font.width(char, size) / 2;
    const fromMiddle = along - total / 2;
    const radians = (rightToLeft ? -fromMiddle : fromMiddle) / BASELINE;
    return [{ char, angle: centre + (radians * 180) / Math.PI }];
  });
}

/** The ring's names, each centred in its eighth, anticlockwise from the top. */
const RING_GLYPHS = RING.map((name, index) => ({
  ...name,
  glyphs: ringGlyphs(
    name.text,
    270 - (index * 360) / RING.length,
    name.hebrew ? hebrewFont : labelFont,
    name.hebrew ? HEBREW_SIZE : LATIN_SIZE,
    name.hebrew,
  ),
}));

const at = (angle: number, r: number): [number, number] => {
  const radians = (angle * Math.PI) / 180;
  return [
    svgCoordinate(r * Math.cos(radians)),
    svgCoordinate(r * Math.sin(radians)),
  ];
};

const wedge = (angle: number) => {
  const [x0, y0] = at(angle - 45, DISC);
  const [x1, y1] = at(angle + 45, DISC);
  return `M0,0L${x0},${y0}A${DISC},${DISC} 0 0 1 ${x1},${y1}Z`;
};

const UP = [-90, 30, 150].map((angle) => at(angle, STAR));
const DOWN = [90, 210, 330].map((angle) => at(angle, STAR));

/**
 * Where the down triangle passes over the up one: three of the six
 * crossings, alternating, as short pieces of its edges redrawn on top. The
 * white piece runs a little past the black one, so no seam shows where the
 * piece ends on the band it continues.
 */
const OVER = [0, 120, 240].map((angle) => {
  const [x, y] = at(angle, STAR / Math.sqrt(3));
  // The down triangle's edge through this crossing runs at angle + 120°.
  const segment = (half: number) => {
    const [dx, dy] = at(angle + 120, half);
    return points([
      [x - dx, y - dy],
      [x + dx, y + dy],
    ]);
  };
  // Long enough to cross the other band (half its width over sin 60°, plus
  // its slant), short of the next crossing a third of the edge away.
  const black = 1.1 * (BAND + 2 * EDGE);
  return { black: segment(black), white: segment(black + 1) };
});

function Band({ pointsList }: { pointsList: string }) {
  return (
    <>
      <polygon
        points={pointsList}
        fill="none"
        stroke={PALETTE.ink}
        strokeWidth={BAND + 2 * EDGE}
        strokeLinejoin="miter"
      />
      <polygon
        points={pointsList}
        fill="none"
        stroke={PALETTE.paper}
        strokeWidth={BAND}
        strokeLinejoin="miter"
      />
    </>
  );
}

function Pantacle() {
  return (
    <>
      <circle
        r={OUTER}
        fill={PALETTE.paper}
        stroke={PALETTE.ink}
        strokeWidth={1.2}
      />
      {QUARTERS.map((quarter) => (
        <path
          key={quarter.angle}
          d={wedge(quarter.angle)}
          fill={quarter.fill}
        />
      ))}
      <circle r={DISC} fill="none" stroke={PALETTE.ink} strokeWidth={0.8} />
      <Band pointsList={points(DOWN)} />
      <Band pointsList={points(UP)} />
      {OVER.map((segment) => (
        <g key={segment.black}>
          <polyline
            points={segment.black}
            stroke={PALETTE.ink}
            strokeWidth={BAND + 2 * EDGE}
          />
          <polyline
            points={segment.white}
            stroke={PALETTE.paper}
            strokeWidth={BAND}
          />
        </g>
      ))}
      {RING_GLYPHS.map((name) => (
        <g
          key={name.text}
          fontFamily={
            name.hebrew ? GD_HALL_FONT_STACKS.hebrew : GD_HALL_FONT_STACKS.serif
          }
          fontStyle={name.hebrew ? undefined : "italic"}
          fontWeight={name.hebrew ? 700 : undefined}
          fontSize={name.hebrew ? HEBREW_SIZE : LATIN_SIZE}
          fill={PALETTE.ink}
          textAnchor="middle"
        >
          {name.glyphs.map((glyph) => (
            <text
              key={glyph.angle}
              y={-BASELINE}
              transform={`rotate(${svgCoordinate((glyph.angle + 450) % 360)})`}
            >
              {glyph.char}
            </text>
          ))}
        </g>
      ))}
    </>
  );
}

/** The Theoricus' Pantacle (`item(kind="pantacle")`), 100 × 100. */
export const pantacleArt: HallArt = {
  Component: Pantacle,
  box: { width: 100, height: 100 },
  variant: sameForEveryNode,
  provenance,
};
