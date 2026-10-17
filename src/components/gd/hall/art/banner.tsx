import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps } from "../types";
import { points } from "./geometry";
import { original, PALETTE } from "./shared";

export const provenance = {
  ...original(
    "Redrawn as clean geometry from Gadi Cohen's own banners in " +
      "public/pics/neophyte.svg (groups g44, the East, and g5, the West): " +
      "a pennant on a rod with knobs, cord and tassels; the East bears the " +
      "yellow cross with the interlaced red and blue triangles and the white " +
      "Tau, the West the white triangle with the red cross. Part of g44 " +
      "is a path of steps on a 0.32-unit grid that looks auto-traced from " +
      "a raster image; no path of either group is reused: these banners " +
      "are primitive geometry throughout.",
  ),
  source: "public/pics/neophyte.svg",
};

/** The pennant's half-width and its top, shoulder and point. */
export const PENNANT = { half: 38, top: -37, shoulder: 27, point: 49 };

/** The pennant outline: a rectangle ending in a point. */
export function pennantPath(top: number, shoulder: number, point: number) {
  const { half } = PENNANT;
  return `M${-half},${top}H${half}V${shoulder}L0,${point}L${-half},${shoulder}Z`;
}

/** The rod across the top with a knob at each end. */
export function Rod({ y }: { y: number }) {
  return (
    <>
      <rect
        x={-43}
        y={y - 2}
        width={86}
        height={4}
        fill={PALETTE.knob}
        stroke={PALETTE.ink}
        strokeWidth={0.6}
      />
      {[-44, 44].map((x) => (
        <circle
          key={x}
          cx={x}
          cy={y}
          r={4.5}
          fill={PALETTE.knob}
          stroke={PALETTE.ink}
          strokeWidth={0.6}
        />
      ))}
    </>
  );
}

function EastEmblem() {
  return (
    <>
      <path
        d="M-7.5,-24H7.5V-9H23V5.5H7.5V35H-7.5V5.5H-23V-9H-7.5Z"
        fill={PALETTE.gold}
      />
      <polygon
        points={points([
          [-23, -9],
          [23, -9],
          [0, 28],
        ])}
        fill="none"
        stroke={PALETTE.water}
        strokeWidth={3.5}
      />
      <polygon
        points={points([
          [0, -21],
          [23, 16],
          [-23, 16],
        ])}
        fill="none"
        stroke={PALETTE.fire}
        strokeWidth={3.5}
      />
      <path d="M-7,-3H7V1.5H2.5V10H-2.5V1.5H-7Z" fill={PALETTE.tau} />
    </>
  );
}

function WestEmblem() {
  return (
    <>
      <polygon
        points={points([
          [0, -23],
          [25.6, 20.7],
          [-25.6, 20.7],
        ])}
        fill="none"
        stroke={PALETTE.tau}
        strokeWidth={4.3}
      />
      <path
        d="M-2.3,-2.4H2.3V2H7V7H2.3V15.5H-2.3V7H-7V2H-2.3Z"
        fill={PALETTE.glow}
        stroke={PALETTE.knob}
        strokeWidth={0.6}
      />
    </>
  );
}

function Banner({ node, defId }: HallArtProps) {
  const east = enumAttr(node, "kind", ["east", "west"]) !== "west";
  const { half, top, shoulder, point } = PENNANT;
  const fill = defId("fill");
  const tassels: [number, number, number][] = [
    [-half, top, top + 15],
    [half, top, top + 15],
    [-half, shoulder, shoulder + 13],
    [half, shoulder, shoulder + 13],
    [0, point, point + 13],
  ];
  return (
    <>
      {east && (
        <defs>
          <linearGradient
            id={fill}
            x1={-half}
            x2={half}
            y1={0}
            y2={0}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset={0} stopColor={PALETTE.bannerLightFrom} />
            <stop offset={1} stopColor={PALETTE.bannerLightTo} />
          </linearGradient>
        </defs>
      )}
      <polyline
        points={points([
          [-half, top],
          [0, -61],
          [half, top],
        ])}
        fill="none"
        stroke={east ? PALETTE.tassel : PALETTE.bannerDark}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Rod y={top} />
      <path
        d={pennantPath(top, shoulder, point)}
        fill={east ? `url(#${fill})` : PALETTE.bannerDark}
        stroke={PALETTE.ink}
        strokeWidth={1.5}
      />
      {tassels.map(([x, from, to]) => (
        <line
          key={`${x},${from}`}
          x1={x}
          x2={x}
          y1={from}
          y2={to}
          stroke={PALETTE.tassel}
          strokeWidth={3.4}
          strokeLinecap="round"
        />
      ))}
      {east ? <EastEmblem /> : <WestEmblem />}
    </>
  );
}

/** The Banners of the East and of the West, 100 × 125 units. */
export const bannerArt: HallArt = {
  Component: Banner,
  box: { width: 100, height: 125 },
  provenance,
};
