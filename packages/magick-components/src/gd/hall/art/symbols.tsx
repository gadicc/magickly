import {
  DEFAULT_TABLET_VERSION,
  TABLET_VERSIONS,
} from "magick-data/enochian/tablets";
import type { CSSProperties, ReactNode } from "react";
import Tablet, { UNION_VIEWBOX } from "../../../enochian/Tablet";
import SevenBranchedCandleStick from "../../SevenBranchedCandleStick";
import TableOfShewbread from "../../TableOfShewbread";
import { booleanAttr, enumAttr } from "../attributes";
import type { HallArt, HallArtProps, HallAttrSpec, HallNode } from "../types";
import { original, PALETTE, sameForEveryNode, variantOf } from "./shared";

export const tabletProvenance = original(
  "Draws the package's own Enochian Tablet component (Gadi Cohen) on a " +
    "board. The grid's letters are the Latin transliteration unless the " +
    "app passes a font; the Enochian Plain font is never bundled here.",
);
export const shewbreadProvenance = original(
  "Draws the package's own TableOfShewbread diagram (Gadi Cohen) on a disc.",
);
export const candlestickProvenance = original(
  "Draws the package's own SevenBranchedCandleStick diagram (Gadi Cohen) " +
    "on a disc.",
);

/** Every art module exports its provenance; these three share a module. */
export const provenance = [
  tabletProvenance,
  shewbreadProvenance,
  candlestickProvenance,
];

/**
 * The tablets magick-data has: the four Watchtowers, by their elements, and
 * the Tablet of Union.
 */
export const TABLET_ELEMENTS = [
  "earth",
  "air",
  "water",
  "fire",
  "union",
] as const;

// A Watchtower draws on a 210 × 297 page (viewBox -105 0 210 297), the
// Tablet of Union on a 124 × 104 one, its squares the Watchtowers' size.
const PAGE = { width: 210, height: 297 };
const UNION_PAGE = { width: UNION_VIEWBOX[2], height: UNION_VIEWBOX[3] };

/** The board a tablet stands on: the Tablet of Union's, or a Watchtower's. */
const boardOf = (element: string | undefined) =>
  element === "union" ? UNION_PAGE : PAGE;

/**
 * Each version as an editor names it beside its id. Written here rather
 * than read from the notes, whose prose the hall's chunk must not carry.
 * The panel marks the default itself ("Default"), so no label repeats it.
 */
export const TABLET_VERSION_LABELS: Readonly<
  Record<(typeof TABLET_VERSIONS)[number], string>
> = {
  gd: "Golden Dawn",
  regardie: "Regardie's print, 1940",
  equinox: "The Equinox, 1912",
  dee: "Dee, 1584",
  raphael: "Raphael's table, 1587",
};

/**
 * How a hall tablet is drawn, as its attributes say: the version (the
 * Golden Dawn's, `gd`, when absent, so that a hall never needs to say),
 * whether reversed letters are mirrored (yes when absent) and whether
 * second letters are drawn (no when absent).
 */
function tabletLook(node: HallNode) {
  return {
    version:
      enumAttr(node, "version", TABLET_VERSIONS) ?? DEFAULT_TABLET_VERSION,
    reversed: booleanAttr(node, "reversed") ?? true,
    alt: booleanAttr(node, "alt") ?? false,
  };
}

/**
 * An Enochian tablet (`tablet(element="air")`) on a white board: a
 * Watchtower's 210 × 297, the Tablet of Union's (`element="union"`)
 * 124 × 104. Like any object, a board fills its cell, its longer side
 * 2 squares at scale 1. `version` draws another version than the Golden
 * Dawn's (`tablet(element="fire", version="dee")`), whose board is the
 * same; `reversed=false` draws reversed letters plain, and `alt` draws
 * second letters in the squares' corners. `enochianStyle` is the app's
 * Enochian font; without it the grid shows the transliteration. The
 * package never loads that font itself.
 */
export function tabletArt(enochianStyle?: CSSProperties): HallArt {
  function HallTablet({ node }: HallArtProps) {
    const element = enumAttr(node, "element", TABLET_ELEMENTS);
    const board = boardOf(element);
    const look = tabletLook(node);
    return (
      <>
        <rect
          x={-board.width / 2}
          y={-board.height / 2}
          width={board.width}
          height={board.height}
          fill={PALETTE.paper}
          stroke={PALETTE.ink}
          strokeWidth={2}
        />
        {element && (
          <g transform={`translate(${-board.width / 2} ${-board.height / 2})`}>
            <Tablet
              id={element}
              version={look.version}
              reversed={look.reversed}
              alt={look.alt}
              frame={false}
              label={false}
              width={board.width}
              height={board.height}
              enochianStyle={enochianStyle}
            />
          </g>
        )}
      </>
    );
  }
  return {
    Component: HallTablet,
    box: (node) => boardOf(enumAttr(node, "element", TABLET_ELEMENTS)),
    attributes: new Map<string, HallAttrSpec>([
      ["element", { kind: "enum", values: TABLET_ELEMENTS }],
      [
        "version",
        {
          kind: "enum",
          values: TABLET_VERSIONS,
          labels: TABLET_VERSION_LABELS,
        },
      ],
      ["reversed", { kind: "boolean", default: true }],
      ["alt", { kind: "boolean" }],
    ]),
    variant: (node) => {
      const { version, reversed, alt } = tabletLook(node);
      // Only what departs from the defaults, so that a tablet drawn as
      // before keeps the variant, and the hall the bytes, it had.
      const extra = [
        version === DEFAULT_TABLET_VERSION ? "" : version,
        reversed ? "" : "plain",
        alt ? "alt" : "",
      ].filter(Boolean);
      return variantOf(enumAttr(node, "element", TABLET_ELEMENTS), ...extra);
    },
    provenance: tabletProvenance,
  };
}

/**
 * The two diagrams draw on a 100-unit page with no size of their own, so
 * each is given a 100 × 100 viewport centred on the origin; nested in the
 * hall's `<svg>` without one they would fill the whole hall.
 */
function Disc({ children }: { children: ReactNode }) {
  return (
    <>
      <circle r={40} fill={PALETTE.paper} />
      <svg x={-50} y={-50} width={100} height={100} viewBox="0 0 100 100">
        {children}
      </svg>
    </>
  );
}

/** The Table of Shewbread (`shewbread`), 100 × 100. */
export const shewbreadArt: HallArt = {
  Component: ({ defId }: HallArtProps) => (
    <Disc>
      <TableOfShewbread idPrefix={defId("shewbread")} />
    </Disc>
  ),
  box: { width: 100, height: 100 },
  variant: sameForEveryNode,
  provenance: shewbreadProvenance,
};

/** The Seven-Branched Candlestick (`candlestick`), 100 × 100. */
export const candlestickArt: HallArt = {
  Component: ({ defId }: HallArtProps) => (
    <Disc>
      <SevenBranchedCandleStick idPrefix={defId("candlestick")} />
    </Disc>
  ),
  box: { width: 100, height: 100 },
  variant: sameForEveryNode,
  provenance: candlestickProvenance,
};
