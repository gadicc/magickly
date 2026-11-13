/**
 * The seven chakras on a seated figure.
 *
 * The figure, a woman seated cross-legged with her hands resting palm up
 * on her knees, thumb and index finger touching, was drawn for this
 * package on 13 November 2026 as an original: constructed below from
 * hand-placed cubic Béziers, one half mirrored onto the other, without
 * tracing or adapting any image. It replaces an earlier silhouette
 * (added in fe44a6bf, December 2020) whose source was not recorded
 * (plan 080, "Before publishing").
 *
 * The figure is filled `#000`, which the app's dark ink selects on
 * (`.chakras path[fill="#000"]`); the chakras keep their colours.
 */

const WIDTH = 91.414;
const HEIGHT = 83.244;
/** The figure's midline, on which the chakras sit. */
const MID = WIDTH / 2;

/** A point as its distance right of the midline and its height. */
type Point = readonly [dx: number, y: number];
/** A cubic Bézier's two control points and its end point. */
type Curve = readonly [Point, Point, Point];

const format = (value: number) => String(Math.round(value * 1000) / 1000);
/** A point on the right (`side` 1) or mirrored onto the left (-1). */
const at = ([dx, y]: Point, side: 1 | -1) =>
  `${format(MID + side * dx)} ${format(y)}`;
const curveTo = ([c1, c2, end]: Curve, side: 1 | -1) =>
  `C${at(c1, side)} ${at(c2, side)} ${at(end, side)}`;

/**
 * One outline from a right half that starts and ends on the midline: the
 * half, then its mirror image traced back up to the start.
 */
function symmetricOutline(start: Point, half: readonly Curve[]) {
  const ends = [start, ...half.map(([, , end]) => end)];
  const back = half
    .map(([c1, c2], i) => curveTo([c2, c1, ends[i]], -1))
    .reverse();
  return `M${at(start, 1)}${half.map((curve) => curveTo(curve, 1)).join("")}${back.join("")}Z`;
}

/** A closed shape: where it starts, then its Béziers. */
type Shape = readonly [start: Point, curves: readonly Curve[]];

/** Closed shapes on the right and their mirror images on the left. */
function mirrored(shapes: readonly Shape[]) {
  const one = ([start, curves]: Shape, side: 1 | -1) =>
    `M${at(start, side)}${curves.map((curve) => curveTo(curve, side)).join("")}Z`;
  return ([1, -1] as const)
    .flatMap((side) => shapes.map((shape) => one(shape, side)))
    .join("");
}

/** A circle as four Béziers, for the hole a hand's fingers ring. */
function circle([dx, y]: Point, r: number): Shape {
  const k = 0.5523 * r;
  return [
    [dx + r, y],
    [
      [
        [dx + r, y + k],
        [dx + k, y + r],
        [dx, y + r],
      ],
      [
        [dx - k, y + r],
        [dx - r, y + k],
        [dx - r, y],
      ],
      [
        [dx - r, y - k],
        [dx - k, y - r],
        [dx, y - r],
      ],
      [
        [dx + k, y - r],
        [dx + r, y - k],
        [dx + r, y],
      ],
    ],
  ];
}

/**
 * Head, slender neck, trunk with its waist and hips, and crossed legs,
 * from the crown round to the seat.
 */
// biome-ignore format: one Bézier a line
const body = symmetricOutline([0, 5.7], [
  [[3.65, 5.7], [6.6, 9.2], [6.6, 13.5]], // head
  [[6.6, 17.5], [4.6, 20.4], [2.6, 21.4]], // jaw to the neck
  [[2.45, 22.8], [2.45, 24.3], [2.8, 25.4]], // neck
  [[3.6, 27.6], [8, 28.6], [12, 29.8]], // shoulder's slope
  [[14.8, 30.6], [16.4, 32.6], [16.6, 35.5]], // shoulder
  [[16.7, 37.8], [15.2, 39], [14.6, 40.5]], // armpit
  [[13.6, 44.5], [9.6, 47], [9.6, 51.5]], // flank to the waist
  [[9.6, 55], [12, 57.5], [15, 58.8]], // hip
  [[22, 60.2], [30, 61], [36, 62.2]], // thigh
  [[40.8, 62.6], [43.2, 65.2], [42.8, 68.8]], // knee
  [[42.4, 72.6], [38.4, 74.6], [33, 75.2]], // under the knee
  [[24, 76.3], [14, 78], [7, 79.2]], // shin
  [[4, 79.7], [1.5, 79], [0, 78.2]], // where the shins cross
]);

/**
 * The arms, each hand resting palm up on its knee, the thumb and index
 * finger touching in a ring; the space between arm, flank and thigh
 * stays open.
 */
// biome-ignore format: one Bézier a line
const arms = mirrored([
  [[11, 29.5], [
    [[14.8, 30.4], [16.6, 32.4], [16.9, 35.5]], // shoulder, over the body's
    [[17.4, 40.5], [19.9, 46], [22.7, 50.4]], // upper arm
    [[23.9, 52.3], [25.2, 53.8], [27, 55.1]], // elbow
    [[30.5, 57.4], [34, 58.8], [36.6, 59.3]], // forearm to the wrist
    [[37.4, 59.35], [38.25, 58.6], [38.25, 57.4]], // index finger, rising
    [[38.25, 56.43], [39.03, 55.65], [40, 55.65]], // the ring's top
    [[40.97, 55.65], [41.75, 56.43], [41.75, 57.4]], // the thumb
    [[41.75, 58.2], [42.2, 58.85], [43, 59.1]], // the hand's outer edge
    [[43.8, 59.35], [44.6, 59.45], [45, 59.6]], // first finger
    [[45.4, 59.75], [45.35, 60.2], [44.9, 60.25]], // its tip
    [[44.3, 60.3], [43.8, 60.3], [43.5, 60.35]],
    [[44.1, 60.4], [44.7, 60.5], [45, 60.7]], // second finger
    [[45.3, 60.9], [45.1, 61.25], [44.7, 61.2]], // its tip
    [[44.2, 61.15], [43.8, 61.1], [43.5, 61.15]],
    [[43.9, 61.3], [44.3, 61.45], [44.45, 61.65]], // third finger
    [[44.6, 61.95], [44.3, 62.15], [43.9, 62.1]], // its tip
    [[42.5, 62.3], [40.6, 62.6], [38.8, 62.7]], // palm, on the knee
    [[34.5, 62.2], [28, 59.6], [24.4, 57]], // under the forearm
    [[22.6, 55.7], [21.4, 54], [20.4, 52]], // inside the elbow
    [[18.6, 48.4], [15.8, 44], [15, 40.5]], // inside the upper arm
    [[14.6, 38], [13, 33], [11, 31]], // back into the shoulder
  ]],
  circle([40, 57.4], 1), // inside the thumb and index finger
]);

/** Each chakra's height on the midline, crown to root. */
const chakras = [
  { id: "crown", fill: "#c9f", cy: 4.68 }, // on the crown
  { id: "third-eye", fill: "#A28BE7", cy: 14 }, // the brow
  { id: "throat", fill: "#0ff", cy: 24 },
  { id: "heart", fill: "#0f0", cy: 37.5 },
  { id: "solar-plexus", fill: "#ff0", cy: 49 }, // above the navel
  { id: "sacral", fill: "#f60", cy: 60.5 }, // the lower belly
  { id: "root", fill: "red", cy: 71.5 }, // the seat
];

const opacityActive = { false: 0.2, true: 1 };

/** Props of `Chakras`. */
export interface ChakrasProps {
  /** The SVG's width; from the height and the figure's shape when not given. */
  width?: string | number;
  /** The SVG's height; from the width and the figure's shape when not given. */
  height?: string | number;
  /**
   * A chakra's id in magick-data (`root`, `sacral`, `solar-plexus`,
   * `heart`, `throat`, `third-eye`, `crown`): that one is drawn and the
   * others faded. All are drawn when it is absent or names none of them.
   */
  active?: string;
}

/**
 * The seven chakras as coloured circles on a figure's silhouette, from the
 * root at the base of its spine to the crown at the top of its head.
 */
function Chakras({ width, height, active }: ChakrasProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      version="1.1"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      <path fill="#000" d={body}></path>
      <path fill="#000" fillRule="evenodd" d={arms}></path>
      {chakras.map((chakra) => (
        <circle
          key={chakra.id}
          cx={format(MID)}
          cy={chakra.cy}
          r="4.679"
          fill={chakra.fill}
          opacity={
            !active || active === chakra.id
              ? opacityActive.true
              : opacityActive.false
          }
        ></circle>
      ))}
    </svg>
  );
}

export default Chakras;
