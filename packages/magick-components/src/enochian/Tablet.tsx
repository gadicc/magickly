import {
  type TabletPyramidSide,
  tabletPyramids,
} from "magick-data/enochian/tabletPyramids";
import {
  inksOf,
  SideMark,
  sideSymbol,
  TABLET_MARK_OUTLINES,
} from "./pyramidMarks.tsx";
import { type TabletProps, TabletSvg, tabletName } from "./tabletSvg.tsx";

export {
  PYRAMID_COLOURS,
  PYRAMID_TOP,
  PYRAMID_TOP_SYMBOLS,
  REGION_HATCH,
  REGION_TINTS,
  regionFromPosition,
  type TabletHighlights,
  type TabletNameHighlight,
  type TabletProps,
  type TabletSquare,
  type TabletViewBox,
  tabletGround,
  tabletName,
  tabletViewBox,
  UNION_VIEWBOX,
  WATCHTOWER_VIEWBOX,
} from "./tabletSvg.tsx";

/** A side's own mark, in its inks, at a tablet's outlines. */
const tabletSideMark = (side: TabletPyramidSide) => (
  <SideMark
    symbol={sideSymbol(side)}
    {...inksOf(side)}
    outlines={TABLET_MARK_OUTLINES}
  />
);

/**
 * An Enochian tablet in a version (`version`, the Golden Dawn's by
 * default): a Watchtower's sigil above its grid on a 210 × 297 page, or
 * the Tablet of Union's grid on a page of its own (`tabletViewBox`). The
 * version's reversed letters are mirrored unless `mirrorReversed` is
 * false, and a Watchtower's second letters drawn small in each square's
 * corner when `showSecondLetters` is true. With `pyramids`, the Golden
 * Dawn's versions draw every square as a truncated pyramid in its sides'
 * elemental colours instead (plan 095), its letter on a flat top the size
 * `pyramidTop` gives, and no second letters; with `pyramidSymbols`, each
 * side's symbol on it too, outward or upright. A key the data does not
 * have draws an empty page; a tablet the version does not have, its page
 * saying so. It is an image named by `tabletName` (an `aria-label`, which
 * shows no tooltip over the squares as a `<title>` would) unless `label`
 * names it otherwise or is false, as for a tablet drawn inside a larger
 * drawing that names itself.
 */
export function Tablet({
  label,
  mirrorReversed = true,
  showSecondLetters = false,
  frame = false,
  pyramids = false,
  ...props
}: TabletProps) {
  const name =
    label === undefined
      ? tabletName(props.tablet, props.version)
      : label || undefined;
  const drawn = {
    ...props,
    mirrorReversed,
    showSecondLetters,
    frame,
    // The rules behind the pyramids, and the data their symbols read,
    // load with the entry, not with the drawing the hall's art shares.
    pyramidsOf: pyramids ? tabletPyramids : undefined,
    pyramidMarkOf: pyramids ? tabletSideMark : undefined,
  };
  return name ? (
    <TabletSvg {...drawn} role="img" aria-label={name} />
  ) : (
    <TabletSvg {...drawn} aria-hidden />
  );
}

export default Tablet;
