import type { Metadata } from "next";
import { socialCardImage } from "@/seo/cards";
import { seoMetadata } from "@/seo/metadata";
import {
  planetaryNamePage,
  planetaryNameSocialImage,
} from "@/seo/planetaryNames";
import {
  type PlanetaryName,
  type PlanetaryNamePageKind,
  planetaryNameOnPage,
  planetaryNamePageKind,
  planetaryNamesWithPages,
} from "./planetaryNames";

/**
 * What the two name routes share (plan 093, decision 8):
 * `/astrology/intelligence/[id]` and `/astrology/spirit/[id]` each
 * prerender the names in their namespace and 404 any other id.
 */

/** The ids a namespace's route prerenders, in the table's order. */
export function planetaryNameParams(kind: PlanetaryNamePageKind) {
  return planetaryNamesWithPages()
    .filter((name) => planetaryNamePageKind(name) === kind)
    .map((name) => ({ id: name.id }));
}

/** The name a route's id names in its namespace, or undefined. */
export const planetaryNameRoute = (kind: PlanetaryNamePageKind, id: string) =>
  planetaryNameOnPage(kind, id);

/**
 * A name page's metadata: its search copy, then its card and its sigil's
 * PNG to share, as the angels' pages add theirs (plan 088, S4).
 */
export function planetaryNameMetadata(name: PlanetaryName): Metadata {
  const page = planetaryNamePage(name);
  const metadata = seoMetadata(page.path, page);
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      images: [
        socialCardImage(page.path, page.title),
        planetaryNameSocialImage(name),
      ],
    },
  };
}
