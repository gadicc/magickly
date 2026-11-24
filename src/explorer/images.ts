/**
 * The server image of what the explorer draws, where the image route has a
 * contract for the component (plan 080, decision 5). Client-safe: only the
 * pure contracts are imported. The contracts' query names are not the
 * components' props (`id` for `tablet`), so each component maps its
 * own, and a drawing the image cannot show (second letters on a tablet,
 * highlighted squares, a pyramid's top at a size of the caller's own, the
 * Tablet of Union in a version without one) has no image.
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
  "SevenBranchedCandlestick",
  "TableOfShewbread",
  "Kamea",
  "KameaSigil",
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
      // A sephirah the query cannot name: none lit.
      if (props.activeSephirah === null) return null;
      // The component's defaults, which are not the image's (its query
      // keeps the Tree's first ones): the Tree page's.
      return viaContract("tree-of-life", {
        field: text(props.field) || "name.roman",
        topText: text(props.topText) ?? "index",
        bottomText: text(props.bottomText) ?? "name.en",
        colorScale: text(props.colorScale),
        letterAttr: text(props.letterAttr),
        flip: flag(props.flip),
        showDaat: flag(props.showDaat),
        // The component sizes `name.roman` at 10, the API at 12.
        fontSize:
          number(props.fontSize) ??
          ((text(props.field) || "name.roman") === "name.roman"
            ? String(10)
            : undefined),
        active: text(props.activeSephirah),
        activePath: text(props.activePath),
      });
    case "Tablet":
      if (
        props.mirrorReversed === false ||
        props.showSecondLetters === true ||
        props.highlights
      )
        return null;
      // Pyramids have a slug of their own (plan 095, decision 5), which
      // draws the top at its default share and refuses the versions with
      // no pyramids; a top of the caller's own has no image.
      if (props.pyramids === true)
        return props.pyramidTop === undefined
          ? viaContract("enochian-tablet-pyramids", {
              id: text(props.tablet),
              version: text(props.version),
            })
          : null;
      return viaContract("enochian-tablet", {
        id: text(props.tablet),
        version: text(props.version),
      });
    case "RoseSigil":
      return viaContract("rose-sigil", {
        text: text(props.text),
        rose: flag(props.showRose),
        version: text(props.version),
      });
    case "SevenBranchedCandlestick":
      return viaContract("seven-branched-candlestick", {
        version: text(props.version),
      });
    case "TableOfShewbread":
      return viaContract("table-of-shewbread", {});
    case "Kamea":
    case "KameaSigil":
      // The images draw the page's colours and Noto Serif, named as the
      // component names them; a square in the caller's own colours, font
      // or name, or with the caller's own drawing over it, has no image.
      if (
        props.children !== undefined ||
        props.label !== undefined ||
        props.ink !== undefined ||
        props.paper !== undefined ||
        props.squareInk !== undefined ||
        props.fontFamily !== undefined
      )
        return null;
      return name === "Kamea"
        ? viaContract("kamea", { planet: text(props.planet) })
        : viaContract("kamea-sigil", {
            planet: text(props.planet),
            text: text(props.text),
            finals: flag(props.finals),
          });
    default:
      return null;
  }
}
