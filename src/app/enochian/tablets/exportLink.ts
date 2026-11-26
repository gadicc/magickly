import type { TabletVersionId } from "magick-data/enochian/tablets";
import { componentImageFilename } from "@/render/componentImageUrl";
import type { TabletImageId } from "@/render/contracts/enochianTablet";
import {
  isTabletPyramidImageVersion,
  type TabletPyramidSymbols,
  tabletPyramidsSuffix,
} from "@/render/contracts/enochianTabletPyramids";

/**
 * The image the tool's export box links for what it draws, and the name
 * its downloads take (`tablets.tsx`); a plain module, so that the
 * tablets' static files (`src/seo/tablets.ts`, plan 100) are held to it.
 *
 * Pyramids have an image of their own (plan 095, decision 5), in the
 * versions that have them, which are the only ones they are drawn in. A
 * version drawn with pyramids that the image does not take (none today:
 * a test holds the image's versions to magick-data's) has its link
 * withheld (`pyramidsUnlinked`), never the flat image's in its place;
 * its downloads are named as the image would be.
 */
export function tabletExportLink({
  id,
  font,
  version,
  pyramids,
  symbols,
}: {
  id: TabletImageId;
  font: "latin" | "enochian";
  version: TabletVersionId;
  /** Every square drawn as a pyramid. */
  pyramids: boolean;
  /** Their sides' symbols, facing out or upright; none when absent. */
  symbols?: Exclude<TabletPyramidSymbols, "none">;
}) {
  const flatLink = {
    slug: "enochian-tablet" as const,
    props: { id, font, version },
  };
  const pyramidsUnlinked = pyramids && !isTabletPyramidImageVersion(version);
  const link =
    pyramids && isTabletPyramidImageVersion(version)
      ? {
          slug: "enochian-tablet-pyramids" as const,
          props: {
            id,
            font,
            version,
            symbols: symbols ?? ("none" as const),
          },
        }
      : flatLink;
  const imageName = pyramidsUnlinked
    ? `${componentImageFilename(flatLink)}${tabletPyramidsSuffix(symbols ?? "none")}`
    : componentImageFilename(link);
  return { link, imageName, pyramidsUnlinked };
}
