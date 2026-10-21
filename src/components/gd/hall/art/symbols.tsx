import type { CSSProperties, ReactNode } from "react";
import Tablet, { UNION_VIEWBOX } from "../../../enochian/Tablet";
import SevenBranchedCandleStick from "../../SevenBranchedCandleStick";
import TableOfShewbread from "../../TableOfShewbread";
import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps } from "../types";
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
 * An Enochian tablet (`tablet(element="air")`) on a white board: a
 * Watchtower's 210 × 297, the Tablet of Union's (`element="union"`)
 * 124 × 104. Like any object, a board fills its cell, its longer side
 * 2 squares at scale 1. `enochianStyle` is the app's Enochian font;
 * without it the grid shows the transliteration. The package never loads
 * that font itself.
 */
export function tabletArt(enochianStyle?: CSSProperties): HallArt {
  function HallTablet({ node }: HallArtProps) {
    const element = enumAttr(node, "element", TABLET_ELEMENTS);
    const board = boardOf(element);
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
    attributes: new Map([
      ["element", { kind: "enum", values: TABLET_ELEMENTS }],
    ]),
    variant: (node) => variantOf(enumAttr(node, "element", TABLET_ELEMENTS)),
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
