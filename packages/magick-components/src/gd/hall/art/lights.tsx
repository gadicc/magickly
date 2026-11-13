import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps, HallAttrSpec, HallNode } from "../types";
import { LIGHT_COLOURS, type LightColour } from "../vocabulary";
import { pathPoint } from "./geometry";
import {
  HIGHLIGHT,
  ITEM_DETAIL,
  ITEM_OUTLINE,
  original,
  PALETTE,
} from "./shared";

const GLASS: ReadonlyMap<LightColour, string> = new Map([
  ["red", PALETTE.glassRed],
  ["yellow", PALETTE.glassYellow],
  ["white", PALETTE.glassWhite],
]);

/**
 * A light's colour: its `light`, else the default of its kind (a lamp
 * red, a lantern yellow). Halls written before stage H named the glass
 * with `fill`, which still counts when it is one of the light colours.
 */
export function lightColour(node: HallNode, fallback: LightColour) {
  return (
    enumAttr(node, "light", LIGHT_COLOURS) ??
    enumAttr(node, "fill", LIGHT_COLOURS) ??
    fallback
  );
}

/** The attribute the lamp and the lantern add to an item's. */
const LIGHT_ATTRIBUTES: ReadonlyMap<string, HallAttrSpec> = new Map([
  ["light", { kind: "enum", values: LIGHT_COLOURS }],
]);

export const provenance = original(
  "A lantern drawn from geometry: a ring, a roof, glazed panes in the " +
    "colour of its light, a flame, a stepped base.",
);

/** A teardrop flame `h` tall, centred on the axis at `cy`. */
function flame(cy: number, h: number): string {
  const w = h * 0.36;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  const shoulder = top + h * 0.42;
  const p = (x: number, y: number) => pathPoint([x, y]);
  return (
    `M${p(0, top)}C${p(w * 1.1, shoulder)} ${p(w, bottom)} ${p(0, bottom)}` +
    `C${p(-w, bottom)} ${p(-w * 1.1, shoulder)} ${p(0, top)}Z`
  );
}
const FLAME = flame(10, 18);
const FLAME_CORE = flame(12.88, 9);
const PANES =
  "M-11,-18H11V29H-11ZM-19.5,-18H-14.5V29H-19.5ZM14.5,-18H19.5V29H14.5Z";

/** The lantern, its panes glazed in the colour of its light. */
function Lantern({ glass }: { glass: string }) {
  return (
    <g {...ITEM_OUTLINE}>
      <circle cy={-45} r={3} fill="none" strokeWidth={ITEM_DETAIL} />
      <path d="M-6,-41H6L26,-28H-26Z" fill={PALETTE.bronze} />
      <rect
        x={-28}
        y={-28.5}
        width={56}
        height={5}
        rx={1.5}
        fill={PALETTE.bronze}
      />
      <rect x={-22.5} y={-23.5} width={45} height={57} fill={PALETTE.bronze} />
      <path d={PANES} fill={glass} strokeWidth={ITEM_DETAIL} />
      <path
        d={FLAME}
        fill={PALETTE.flame}
        stroke={PALETTE.fire}
        strokeWidth={ITEM_DETAIL}
      />
      <path d={FLAME_CORE} fill={PALETTE.air} stroke="none" />
      <path d="M-22.5,33.5H22.5L26.5,40H-26.5Z" fill={PALETTE.bronze} />
      <rect
        x={-27.5}
        y={40}
        width={55}
        height={6.5}
        rx={1.5}
        fill={PALETTE.bronze}
      />
      <path d="M-3.5,-37.5L-16,-30" {...HIGHLIGHT} />
    </g>
  );
}

/**
 * The lamp and the lantern: one drawing, as in the old drawings, whose
 * lanterns were the lamp stretched. They stay two kinds because their
 * default scales and colours differ (a lamp is red and 0.94 squares
 * tall, a lantern yellow and 2.38), and saved halls and the presets name
 * both. `light` picks the colour of either.
 */
const lightArt = (fallback: LightColour): HallArt => {
  const glassOf = (node: HallNode) =>
    GLASS.get(lightColour(node, fallback)) as string;
  return {
    Component: ({ node }: HallArtProps) => <Lantern glass={glassOf(node)} />,
    box: { width: 60.09, height: 100 },
    attributes: LIGHT_ATTRIBUTES,
    variant: (node) => lightColour(node, fallback),
    provenance,
  };
};

/** A lamp (`item(kind="lamp")`), red unless its `light` says otherwise. */
export const lampArt = lightArt("red");
/** A lantern (`item(kind="lantern")`), yellow unless `light` says otherwise. */
export const lanternArt = lightArt("yellow");
