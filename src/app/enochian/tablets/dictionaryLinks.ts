import type { TabletNameId } from "magick-data/enochian/tabletNames";
import type { TabletVersionId } from "magick-data/enochian/tablets";

/**
 * The tablets' names' dictionary links as the page holds them: the map
 * `nameLinks.ts` builds on the server, and how the page reads it. Nothing
 * here imports the dictionary, so the browser never loads it.
 */

/**
 * A name's headword on one tablet: the same in every version, or by
 * version where the versions' spellings find different ones. A version
 * whose name has no headword is left out.
 */
export type NameLink =
  | string
  | Readonly<Partial<Record<TabletVersionId, string>>>;

/** The headwords of each Watchtower's names, by tablet and name id. */
export type TabletNameLinks = Readonly<
  Record<string, Readonly<Partial<Record<TabletNameId, NameLink>>>>
>;

/** A name's headword in a version, from the map the page is given. */
export function linkedHeadword(
  links: TabletNameLinks | undefined,
  tablet: string,
  version: TabletVersionId,
  id: string,
): string | undefined {
  const link = links?.[tablet]?.[id as TabletNameId];
  return typeof link === "string" ? link : link?.[version];
}

/** The dictionary's page for a headword, relative so it can be prerendered. */
export const dictionaryHref = (key: string) =>
  `/enochian/dictionary?w=${encodeURIComponent(key)}`;
