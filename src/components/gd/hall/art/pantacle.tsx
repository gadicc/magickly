import { svgCoordinate } from "../../../svgCoordinate";
import { GD_HALL_FONT_STACKS } from "../fonts";
import type { HallArt, HallArtProps } from "../types";
import { points } from "./geometry";
import { original, PALETTE } from "./shared";

export const provenance = {
  ...original(
    "The Pantacle redrawn from geometry after Gadi Cohen's Theoricus badge " +
      "in public/pics/theoricus2.svg (g4-9): the Earth disc in its four " +
      "colours, an interlaced hexagram and a ring naming the Earth's " +
      "correspondences. The names are set by the browser in the hall fonts " +
      "(SIL OFL 1.1); no glyph outlines are copied into the code.",
  ),
  source: "public/pics/theoricus2.svg#g4-9",
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
  { angle: -90, fill: "#a9aa66" }, // citrine, East (up)
  { angle: 0, fill: "#444f41" }, // olive
  { angle: 90, fill: "#2c2b29" }, // black
  { angle: 180, fill: "#8f5642" }, // russet
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

function Pantacle({ defId }: HallArtProps) {
  const ring = defId("ring");
  // Clockwise from just past the bottom, so no name straddles the start.
  const start = 90 + 360 / RING.length / 2;
  const [sx, sy] = at(start, BASELINE);
  const [mx, my] = at(start + 180, BASELINE);
  const circle = `M${sx},${sy}A${BASELINE},${BASELINE} 0 1 1 ${mx},${my}A${BASELINE},${BASELINE} 0 1 1 ${sx},${sy}`;
  return (
    <>
      <defs>
        <path id={ring} d={circle} />
      </defs>
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
      {RING.map((name, index) => {
        // Slot centres anticlockwise from the top, as fractions of the path.
        const angle = 270 - (index * 360) / RING.length;
        const offset = (((angle - start) % 360) + 360) % 360;
        // Set in visual order: Hebrew reversed, with bidi overridden, so
        // every renderer lays the letters out along the path alike.
        const text = name.hebrew
          ? [...name.text].reverse().join("")
          : name.text;
        return (
          <text
            key={name.text}
            fontFamily={
              name.hebrew
                ? GD_HALL_FONT_STACKS.hebrew
                : GD_HALL_FONT_STACKS.serif
            }
            fontStyle={name.hebrew ? undefined : "italic"}
            fontWeight={name.hebrew ? 700 : undefined}
            fontSize={name.hebrew ? 6.4 : 5}
            fill={PALETTE.ink}
            direction="ltr"
            unicodeBidi="bidi-override"
          >
            <textPath
              href={`#${ring}`}
              startOffset={`${svgCoordinate((offset / 360) * 100)}%`}
              textAnchor="middle"
            >
              {text}
            </textPath>
          </text>
        );
      })}
    </>
  );
}

/** The Theoricus' Pantacle (`item(kind="pantacle")`), 100 × 100. */
export const pantacleArt: HallArt = {
  Component: Pantacle,
  box: { width: 100, height: 100 },
  provenance,
};
