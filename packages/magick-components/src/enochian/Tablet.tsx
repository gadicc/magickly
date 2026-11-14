import { type TabletProps, TabletSvg, tabletName } from "./tabletSvg.tsx";

export {
  type TabletHighlights,
  type TabletProps,
  type TabletSquare,
  type TabletViewBox,
  tabletName,
  tabletViewBox,
  UNION_VIEWBOX,
  WATCHTOWER_VIEWBOX,
} from "./tabletSvg.tsx";

/**
 * An Enochian tablet in a version (`version`, the Golden Dawn's by
 * default): a Watchtower's sigil above its grid on a 210 × 297 page, or
 * the Tablet of Union's grid on a page of its own (`tabletViewBox`). The
 * version's reversed letters are mirrored unless `mirrorReversed` is
 * false, and a Watchtower's second letters drawn small in each square's
 * corner when `showSecondLetters` is true. A key the data does not have
 * draws an empty page; a tablet the version does not have, its page
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
  ...props
}: TabletProps) {
  const name =
    label === undefined
      ? tabletName(props.tablet, props.version)
      : label || undefined;
  const drawn = { ...props, mirrorReversed, showSecondLetters, frame };
  return name ? (
    <TabletSvg {...drawn} role="img" aria-label={name} />
  ) : (
    <TabletSvg {...drawn} aria-hidden />
  );
}

export default Tablet;
