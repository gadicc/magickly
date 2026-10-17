import type { CSSProperties, ReactNode } from "react";
import Tablet from "../../../enochian/Tablet";
import SevenBranchedCandleStick from "../../SevenBranchedCandleStick";
import TableOfShewbread from "../../TableOfShewbread";
import { enumAttr } from "../attributes";
import type { HallArt, HallArtProps } from "../types";
import { original, PALETTE } from "./shared";

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

/** The tablets with data in magick-data; water, fire and union follow. */
export const TABLET_ELEMENTS = ["earth", "air"] as const;

// Tablet draws on a 210 × 297 page (viewBox -105 0 210 297).
const PAGE = { width: 210, height: 297 };

/**
 * An Enochian tablet (`tablet(element="air")`) on a white board, 210 × 297.
 * `enochianStyle` is the app's Enochian font; without it the grid shows
 * the transliteration. The package never loads that font itself.
 */
export function tabletArt(enochianStyle?: CSSProperties): HallArt {
  function HallTablet({ node }: HallArtProps) {
    const element = enumAttr(node, "element", TABLET_ELEMENTS);
    return (
      <>
        <rect
          x={-PAGE.width / 2}
          y={-PAGE.height / 2}
          width={PAGE.width}
          height={PAGE.height}
          fill={PALETTE.paper}
          stroke={PALETTE.ink}
          strokeWidth={2}
        />
        {element && (
          <g transform={`translate(${-PAGE.width / 2} ${-PAGE.height / 2})`}>
            <Tablet
              id={element}
              frame={false}
              width={PAGE.width}
              height={PAGE.height}
              enochianStyle={enochianStyle}
            />
          </g>
        )}
      </>
    );
  }
  return {
    Component: HallTablet,
    box: PAGE,
    attributes: new Map([
      ["element", { kind: "enum", values: TABLET_ELEMENTS }],
    ]),
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
  provenance: candlestickProvenance,
};
