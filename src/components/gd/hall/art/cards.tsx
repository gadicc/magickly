import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps, HallAttrSpec, HallNode } from "../types";
import { CARD_KINDS, CARD_TITLES, type CardKind } from "../vocabulary";
import { flipped, points, polar, smoothPath } from "./geometry";
import {
  ITEM_DETAIL,
  ITEM_OUTLINE,
  original,
  PALETTE,
  variantOf,
} from "./shared";
import {
  CARD_BOX,
  CardFrame,
  CardNumeral,
  CardTitle,
  romanNumeral,
} from "./tarotKey";

export const provenance = original(
  "Emblem cards drawn from geometry in the flat-emblem style, in the " +
    "tarot key's frame: Pan's pipes and crook, the Devil on his cube, " +
    "Death's skull and scythe, Typhon rising from the waves into the " +
    "storm. After the Portal rubric's descriptions (Regardie, The Golden " +
    "Dawn, vol. 2, 1938, pp. 178–184); nothing traced.",
);

/** `kind`: which card. */
export const CARD_KIND_SPEC: HallAttrSpec = {
  kind: "enum",
  values: CARD_KINDS,
};

const kindOf = (node: HallNode): CardKind | undefined =>
  enumAttr(node, "kind", CARD_KINDS);

/** The keys among the cards, by their trumps' numbers. */
const KEYS: ReadonlyMap<CardKind, number> = new Map([
  ["death", 13],
  ["devil", 15],
]);

/** A stroke drawn as a band with the items' outline: black under, colour over. */
function Band({
  d,
  width,
  stroke,
}: {
  d: string;
  width: number;
  stroke: string;
}) {
  return (
    <g fill="none">
      <path d={d} stroke={PALETTE.ink} strokeWidth={width + 7.2} />
      <path d={d} stroke={stroke} strokeWidth={width} />
    </g>
  );
}

/**
 * Pan: the rubric's seven-reeded pipe, its reeds level at the top and
 * each shorter than the last, bound with a red band, and the pastoral
 * staff, a crook, beside it.
 */
const tenth = (value: number) => Math.round(value * 10) / 10 + 0;
const REEDS = Array.from({ length: 7 }, (_, i) => tenth(-42 + i * 8.6));
const REED_PATH = REEDS.map((x, i) => {
  const bottom = tenth(29.7 - i * 6.4);
  return `M${tenth(x - 4.3)},-32V${bottom}A4.3,4.3 0 0 0 ${tenth(x + 4.3)},${bottom}V-32Z`;
}).join("");

function Pan() {
  return (
    <g {...ITEM_OUTLINE}>
      <Band
        d="M30,46L30,-30C30,-44 12,-44 12,-33C12,-29 14,-27 17,-27"
        width={5}
        stroke={PALETTE.bronze}
      />
      <path d={REED_PATH} fill={PALETTE.bread} />
      <g fill={PALETTE.ink} stroke="none">
        {REEDS.map((x) => (
          <ellipse key={x} cx={x} cy={-32} rx={2.6} ry={1.4} />
        ))}
      </g>
      <path d="M-46.3,-16H13.9V-8L-46.3,-6Z" fill={PALETTE.fire} />
    </g>
  );
}

/** A line of waves at height `y`, across the box. */
const waves = (y: number, a: number) => {
  let d = `M-48,${y}`;
  for (let x = -48; x < 48; x += 16)
    d += `Q${x + 4},${y - a} ${x + 8},${y}T${x + 16},${y}`;
  return `${d}V48H-48Z`;
};
const TYPHON_BODY = smoothPath(
  [
    [-30, 34],
    [-14, 30],
    [6, 24],
    [16, 14],
    [8, 4],
    [-12, -2],
    [-20, -12],
    [-10, -22],
    [6, -28],
  ],
  1,
);
/** The storm cloud's billows: x, y and radius. */
const CLOUD: readonly (readonly [number, number, number])[] = [
  [-22, -34, 13],
  [-4, -40, 15],
  [16, -36, 13],
  [30, -30, 10],
  [-34, -28, 9],
  [6, -27, 12],
  [-16, -26, 10],
];

/**
 * Typhon, "the Destroyer": a red serpent rising in coils from the waves
 * (Earth and Ocean) into a storm cloud, his head lost in it, a yellow
 * bolt below.
 */
function Typhon() {
  return (
    <g {...ITEM_OUTLINE}>
      <path d={waves(32, 5)} fill={PALETTE.water} />
      <Band d={TYPHON_BODY} width={11} stroke={PALETTE.fire} />
      <path d={waves(40, 4)} fill={PALETTE.water} />
      {/* Outlined, then filled again, so the billows merge into one cloud. */}
      <g fill={PALETTE.storm}>
        {CLOUD.map(([x, y, r]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      <g fill={PALETTE.storm} stroke="none">
        {CLOUD.map(([x, y, r]) => (
          <circle key={`${x},${y}`} cx={x} cy={y} r={r - 1.8} />
        ))}
      </g>
      <path
        d="M2,-24L-6,-10L2,-12L-4,2"
        fill="none"
        stroke={PALETTE.air}
        strokeWidth={3.4}
      />
    </g>
  );
}

/** Death: a skull, and the scythe he reaps with. */
function Death() {
  return (
    <g {...ITEM_OUTLINE}>
      <Band d="M26,46L12,-38" width={5} stroke={PALETTE.bronze} />
      <path
        d="M13,-40C-4,-48 -30,-44 -46,-24C-28,-36 -6,-36 15,-30Z"
        fill={PALETTE.silver}
      />
      <path
        d="M-30,6A20,20 0 1 1 6,6C6,12 2,14 0,16V24H-24V16C-26,14 -30,12 -30,6Z"
        fill={PALETTE.paper}
      />
      <g fill={PALETTE.ink} stroke="none">
        <ellipse cx={-20} cy={4} rx={5.6} ry={6.4} />
        <ellipse cx={-4} cy={4} rx={5.6} ry={6.4} />
        <path d="M-12,10L-15,17H-9Z" />
      </g>
      <path
        d="M-18,24V19M-12,24V19M-6,24V19"
        fill="none"
        strokeWidth={ITEM_DETAIL}
      />
    </g>
  );
}

/** A bat's wing, the right one: finger points along the top, scalloped. */
const BAT_WING =
  "M8,-6C18,-20 34,-26 48,-22L44,-10C40,0 42,8 46,16C38,10 32,10 28,16" +
  "C24,8 18,8 14,14C14,6 12,0 8,-2Z";
const BAT_WINGS = BAT_WING + flipped(BAT_WING);
/** The reversed pentagram over his head: a point down. */
const REVERSED_PENTAGRAM = `M${points(
  Array.from({ length: 5 }, (_, i) => polar(8, 90 + i * 144, [0, -36])),
).replaceAll(" ", "L")}Z`;

/**
 * The Devil: bat wings, a red horned head under a reversed pentagram,
 * standing on the cubical altar (the key as the rubric describes it).
 */
function Devil() {
  return (
    <g {...ITEM_OUTLINE}>
      <path d={BAT_WINGS} fill={PALETTE.bannerDark} />
      <path d="M-18,22H18V44H-18Z" fill={PALETTE.bannerDark} />
      <path d="M-18,22L-12,16H24L18,22M24,16V38L18,44" fill={PALETTE.storm} />
      <path
        d="M-7,-14C-18,-17 -23,-26 -20,-35C-17,-27 -11,-23 -3,-19Z"
        fill={PALETTE.goldDeep}
      />
      <path
        d="M7,-14C18,-17 23,-26 20,-35C17,-27 11,-23 3,-19Z"
        fill={PALETTE.goldDeep}
      />
      <path
        d="M-12,-16C-6,-20 6,-20 12,-16C13,-6 8,4 4,10L0,18L-4,10C-8,4 -13,-6 -12,-16Z"
        fill={PALETTE.fire}
      />
      <path
        d="M-9,-8L-3,-6M9,-8L3,-6"
        stroke={PALETTE.paper}
        strokeWidth={3.2}
      />
      <path
        d={REVERSED_PENTAGRAM}
        fill="none"
        stroke={PALETTE.ink}
        strokeWidth={5.6}
      />
      <path
        d={REVERSED_PENTAGRAM}
        fill="none"
        stroke={PALETTE.paper}
        strokeWidth={2.2}
      />
    </g>
  );
}

const EMBLEMS: ReadonlyMap<CardKind, () => React.ReactElement> = new Map([
  ["pan", Pan],
  ["devil", Devil],
  ["death", Death],
  ["typhon", Typhon],
]);

/**
 * An emblem card: the tarot key's frame with the emblem in it, the
 * title below and, on a key, its numeral above. The emblem is drawn in a
 * 100-unit box at 0.44, so its outline matches the frame's.
 */
function Card({ node }: HallArtProps) {
  const kind = kindOf(node);
  const Emblem = kind && EMBLEMS.get(kind);
  const key = kind && KEYS.get(kind);
  return (
    <>
      <CardFrame />
      {kind && Emblem && (
        <>
          <g transform={`translate(0 ${key ? 2 : -3}) scale(0.44)`}>
            <Emblem />
          </g>
          <g fill={PALETTE.ink} textAnchor="middle">
            {key && <CardNumeral numeral={romanNumeral(key)} />}
            <CardTitle title={CARD_TITLES.get(kind) as string} />
          </g>
        </>
      )}
    </>
  );
}

/**
 * An emblem card (`card(kind="pan")`), 58 × 100 like a tarot key: Pan,
 * the Devil, Death or Typhon (Gadi's option (d), 24 October 2026). A
 * card without a kind is blank. Its title cannot be read at a hall's
 * size, so a hall labels it.
 */
export const cardArt: HallArt = {
  Component: Card,
  box: CARD_BOX,
  attributes: new Map([["kind", CARD_KIND_SPEC]]),
  // One of four cards, or a blank one.
  variant: (node) => variantOf(kindOf(node)),
  provenance,
};
