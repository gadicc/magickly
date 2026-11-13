import { svgCoordinate } from "../svgCoordinate";
import { type Point, points, polar } from "./hall/art/geometry";
import { PALETTE } from "./hall/art/shared";

/**
 * The glyphs `Lamen` draws in colour (plan 061, stage H, part 2), from the
 * Portal's rubric: the adepts' lamens, and the Hiereus' and Hegemon's
 * own in the Portal. Each is drawn from geometry in `Lamen`'s −50…50 box,
 * inside the disc (radius 42), and defines no ids.
 *
 * The adepts' three lamens are the Portal's only. In a 5=6 hall the
 * Chief Adept bears the Rose-Cross on his breast (Regardie 1938, vol. 2,
 * p.202, leaf n195; in the Pastos, p.220, n213, it hangs from a double
 * Phoenix collar; the Equinox I.3, pp.208–222, agrees). The Second and
 * Third Adepts probably wear it too, though the 5=6 rubric does not say
 * so: every Adept wears it at all meetings of Adepts (vol. 3, p.51, n44,
 * on a yellow collarette), and the Third Adept touches the one on his
 * own breast (vol. 2, p.254, n248). No source carries the
 * triangle-in-pentagram or the cup-on-octagram into the 5=6 (plan 061,
 * stage H, part 2, follow-ups).
 */

/** A circle as path data, so several join one path. */
const circle = (cx: number, cy: number, r: number) => {
  const [x, y, d] = [cx - r, cy, 2 * r].map(svgCoordinate);
  return `M${x},${y}a${svgCoordinate(r)},${svgCoordinate(r)} 0 1 0 ${d},0a${svgCoordinate(r)},${svgCoordinate(r)} 0 1 0 ${-d},0`;
};

/** A star polygon of `n` points, `outer` and `inner` radii, a point up. */
const star = (n: number, outer: number, inner: number, centre?: Point) =>
  points(
    Array.from({ length: 2 * n }, (_, i) =>
      polar(i % 2 ? inner : outer, -90 + (i * 180) / n, centre),
    ),
  );

/** Half the width of the Rose-Cross's arms. */
const ARM = 7;
/** How far the arms reach: up, sideways and down (the lower is longest). */
const [TOP, SIDE, FOOT] = [-25, 25, 27];
/** Each arm ends in a trefoil: three lobes round a point past its end. */
const LOBE = 5.4;
const LOBE_R = 5.6;

/** One arm and its trefoil as one path; `dx`, `dy` point outward. */
function arm(reach: number, dx: number, dy: number): string {
  const along = (t: number, across: number): Point => [
    dx * t + dy * across,
    dy * t + dx * across,
  ];
  const corners = [
    along(0, -ARM),
    along(reach, -ARM),
    along(reach, ARM),
    along(0, ARM),
  ];
  const lobes = [
    along(reach + 3 + LOBE, 0),
    along(reach + 3, LOBE),
    along(reach + 3, -LOBE),
  ];
  return [
    `M${points(corners).replaceAll(" ", "L")}Z`,
    ...lobes.map(([x, y]) => circle(x, y, LOBE_R)),
  ].join("");
}

/**
 * The Rose-Cross, simplified (Regardie, *The Golden Dawn*, vol. 3, Aries
 * Press, 1939, pp. 51–53): the upper arm Air's yellow, the arm on the
 * viewer's left Fire's scarlet (Geburah's side of the Tree), the right
 * Water's blue (Chesed's), the lower arm quartered in Malkuth's citrine,
 * russet, olive and black; trefoil ends, and a five-petalled rose on a
 * gold seed at the crossing. A white edge keeps the black quarter apart
 * from the disc. No letters and no 22-petalled rose: at a role icon's
 * 20 px it reads as a coloured cross with a red centre.
 */
const ROSE_CROSS_ARMS = [
  { d: arm(-TOP, 0, -1), fill: PALETTE.air },
  { d: arm(SIDE, -1, 0), fill: PALETTE.fire },
  { d: arm(SIDE, 1, 0), fill: PALETTE.water },
  { d: arm(FOOT, 0, 1), fill: PALETTE.earthBlack },
];
/** Malkuth's quarters on the lower arm, meeting below the rose. */
const MALKUTH_MEET: Point = [0, 16];
const MALKUTH_ARM = [
  { fill: PALETTE.citrine, at: [[-ARM, 6], MALKUTH_MEET, [ARM, 6]] },
  { fill: PALETTE.russet, at: [[-ARM, 6], MALKUTH_MEET, [-ARM, FOOT]] },
  { fill: PALETTE.olive, at: [[ARM, 6], MALKUTH_MEET, [ARM, FOOT]] },
] as const;
const PETALS = Array.from({ length: 5 }, (_, i) => polar(5.6, -90 + i * 72))
  .map(([x, y]) => circle(x, y, 4.6))
  .join("");

export function RoseCross() {
  return (
    <g transform="translate(0 -1)" strokeLinejoin="round">
      <g stroke={PALETTE.paper} strokeWidth={3.2}>
        {ROSE_CROSS_ARMS.map(({ d, fill }) => (
          <path key={fill} d={d} fill={fill} />
        ))}
      </g>
      {ROSE_CROSS_ARMS.map(({ d, fill }) => (
        <path key={fill} d={d} fill={fill} />
      ))}
      {MALKUTH_ARM.map(({ fill, at }) => (
        <polygon key={fill} points={points(at)} fill={fill} />
      ))}
      <g stroke={PALETTE.ink} strokeWidth={1}>
        <circle r={11.5} fill={PALETTE.rose} />
        <path d={PETALS} fill="#ff7b7b" />
        <circle r={2.8} fill={PALETTE.gold} />
      </g>
    </g>
  );
}

/** The Second Adept's: a red triangle in a green pentagram. */
const PENTAGRAM = star(5, 37, 37 * 0.382, [0, 2.5]);
const PENTAGRAM_TRIANGLE = points(
  Array.from({ length: 3 }, (_, i) =>
    polar(37 * 0.382 * 0.95, -90 + i * 120, [0, 2.5]),
  ),
);

export function TriangleInPentagram() {
  return (
    <g stroke={PALETTE.ink} strokeLinejoin="round">
      <polygon points={PENTAGRAM} fill={PALETTE.green} strokeWidth={1.6} />
      <polygon
        points={PENTAGRAM_TRIANGLE}
        fill={PALETTE.fire}
        strokeWidth={1.2}
      />
    </g>
  );
}

/**
 * The Third Adept's: a blue cup on an orange octagram, two squares
 * crossed: the inner corners lie where their sides meet, at
 * 37 · cos 45° / cos 22.5°.
 */
const OCTAGRAM = star(
  8,
  37,
  (37 * Math.cos(Math.PI / 4)) / Math.cos(Math.PI / 8),
);
const CUP =
  "M-13,-12H13C13,0 7,6 2.5,7V13H8V17H-8V13H-2.5V7C-7,6 -13,0 -13,-12Z";

export function CupOnOctagram() {
  return (
    <g stroke={PALETTE.ink} strokeWidth={1.6} strokeLinejoin="round">
      <polygon points={OCTAGRAM} fill={PALETTE.orange} />
      <path d={CUP} fill={PALETTE.water} />
    </g>
  );
}

/** The Portal hexagrams' size, in lamen units. */
const STAR = 31;
const BAND = 5;
const EDGE = 1.4;

const at = (degrees: number, r: number): Point => {
  const [x, y] = polar(r, degrees);
  return [svgCoordinate(x), svgCoordinate(y)];
};
const HEX_UP = points([-90, 30, 150].map((angle) => at(angle, STAR)));
const HEX_DOWN = points([90, 210, 330].map((angle) => at(angle, STAR)));

/**
 * Where the downward triangle passes over the upward one: three of the
 * six crossings, alternating, as short pieces of its edges drawn again on
 * top (as the Pantacle's hexagram is interlaced). The coloured piece runs
 * a little past the black one, so no seam shows on the band it continues.
 */
const HEX_OVER = [0, 120, 240].map((angle) => {
  const [x, y] = at(angle, STAR / Math.sqrt(3));
  const piece = (half: number) => {
    const [dx, dy] = polar(half, angle + 120);
    return points([
      [x - dx, y - dy],
      [x + dx, y + dy],
    ]);
  };
  const black = 1.1 * (BAND + 2 * EDGE);
  return { black: piece(black), colour: piece(black + 1) };
});

/** A band along a triangle: black edges, the colour between. */
function Band({ at, colour }: { at: string; colour: string }) {
  return (
    <>
      <polygon points={at} stroke={PALETTE.ink} strokeWidth={BAND + 2 * EDGE} />
      <polygon points={at} stroke={colour} strokeWidth={BAND} />
    </>
  );
}

/** An interlaced hexagram of bands, the downward triangle over at three crossings. */
function Hexagram({ up, down }: { up: string; down: string }) {
  return (
    <g fill="none" strokeLinejoin="miter">
      <Band at={HEX_DOWN} colour={down} />
      <Band at={HEX_UP} colour={up} />
      {HEX_OVER.map(({ black, colour }) => (
        <g key={black}>
          <polyline
            points={black}
            stroke={PALETTE.ink}
            strokeWidth={BAND + 2 * EDGE}
          />
          <polyline points={colour} stroke={down} strokeWidth={BAND} />
        </g>
      ))}
    </g>
  );
}

/** A quarter of the disc (radius 42) centred on `degrees`. */
const quarter = (degrees: number) => {
  const [x0, y0] = at(degrees - 45, 42);
  const [x1, y1] = at(degrees + 45, 42);
  return `M0,0L${x0},${y0}A42,42 0 0 1 ${x1},${y1}Z`;
};
const MALKUTH_QUARTERS = [
  { d: quarter(-90), fill: PALETTE.citrine },
  { d: quarter(0), fill: PALETTE.olive },
  { d: quarter(90), fill: PALETTE.earthBlack },
  { d: quarter(180), fill: PALETTE.russet },
];

/**
 * The Hiereus' lamen in the Portal (Regardie 1938, vol. 2, p.156): a
 * white hexagram on the four colours of Malkuth, the disc quartered as
 * the Pantacle's, citrine above. His collar, the ring, is red: see
 * `GRADE_LAMENS` in `Lamen.tsx`.
 */
export function PortalHiereus() {
  return (
    <>
      {MALKUTH_QUARTERS.map(({ d, fill }) => (
        <path key={fill} d={d} fill={fill} />
      ))}
      <circle r={42} fill="none" stroke={PALETTE.ink} strokeWidth={1} />
      <Hexagram up={PALETTE.paper} down={PALETTE.paper} />
    </>
  );
}

/**
 * The Hegemon's lamen in the Portal (Regardie 1938, vol. 2, p.156): a
 * red and blue hexagram on a white ground, Fire's triangle pointing up
 * and Water's down.
 */
export function PortalHegemon() {
  return <Hexagram up={PALETTE.fire} down={PALETTE.water} />;
}
