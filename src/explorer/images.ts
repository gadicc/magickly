/**
 * The server image of what the explorer draws, where the image route has a
 * contract for the component (plan 080, decision 5). Client-safe: only the
 * pure contracts are imported. The contracts' query names are not the
 * components' props (`text` for `sigilText`), so each component maps its
 * own, and a drawing the image cannot show (second letters on a tablet,
 * a sigil's debug circles) has no image.
 */
import { componentImagePath } from "@/render/componentImageUrl";
import { CONTRACTS, type ComponentImageSlug } from "@/render/contracts";

type Props = Readonly<Record<string, unknown>>;

/** The image of a query the contract accepts; null for one it refuses. */
function viaContract(
  slug: ComponentImageSlug,
  query: Record<string, string | undefined>,
): string | null {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, value);
  try {
    const props = CONTRACTS[slug].parse(params);
    return componentImagePath({ slug, props } as Parameters<
      typeof componentImagePath
    >[0]);
  } catch {
    return null;
  }
}

const text = (value: unknown) =>
  typeof value === "string" ? value : undefined;
const flag = (value: unknown) =>
  typeof value === "boolean" ? String(value) : undefined;
const number = (value: unknown) =>
  typeof value === "number" ? String(value) : text(value);

/** The components whose drawing an image route also serves. */
export const IMAGE_COMPONENTS = [
  "TreeOfLife",
  "Tablet",
  "RoseSigil",
  "SevenBranchedCandleStick",
  "TableOfShewbread",
] as const;

/**
 * The image of a component drawn with `props`, or null when it has no
 * contract or the props draw what the image cannot. `GdHall`'s images are
 * its halls' published files, which the page finds by example.
 */
export function componentImage(name: string, props: Props): string | null {
  switch (name) {
    case "TreeOfLife":
      // Labels and links of the caller's own reach the drawing, not a query.
      if (props.labels !== undefined) return null;
      return viaContract("tree-of-life", {
        field: text(props.field),
        topText: text(props.topText),
        bottomText: text(props.bottomText),
        colorScale: text(props.colorScale),
        letterAttr: text(props.letterAttr),
        flip: flag(props.flip),
        showDaat: flag(props.showDaat),
        fontSize: number(props.fontSize),
        active: text(props.active),
        activePath: text(props.activePath),
      });
    case "Tablet":
      if (props.reversed === false || props.alt === true || props.highlights)
        return null;
      return viaContract("enochian-tablet", {
        id: text(props.id),
        version: text(props.version),
      });
    case "RoseSigil":
      if (props.debug === true) return null;
      return viaContract("rose-sigil", {
        text: text(props.sigilText),
        rose: flag(props.showRose),
      });
    case "SevenBranchedCandleStick":
      return viaContract("seven-branched-candlestick", {});
    case "TableOfShewbread":
      return viaContract("table-of-shewbread", {});
    default:
      return null;
  }
}
