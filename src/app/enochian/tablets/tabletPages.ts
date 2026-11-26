import {
  TABLET_IDS,
  type TabletImageId,
} from "@/render/contracts/enochianTablet";
import { ELEMENT_WORDS, type Translate } from "./nameWords";

/**
 * The tablets' own pages (plan 100): one for each of the four Watchtowers
 * and one for the Tablet of Union, under the tool's hub, in the order the
 * tool and the image contracts list them. Server-safe: the tool's own
 * `urlState.ts` is a client module.
 */

/** The tool, and the tablets' pages' hub. */
export const TABLETS_HUB_PATH = "/enochian/tablets";

/** The five tablets with a page: Earth, Air, Water, Fire, then the Union. */
export const TABLET_PAGE_IDS = TABLET_IDS;

/** A tablet with a page of its own. */
export type TabletPageId = TabletImageId;

/** A Watchtower: a tablet with an element, holy names and a King. */
export type WatchtowerPageId = Exclude<TabletPageId, "union">;

/** A tablet's page: `/enochian/tablets/fire`. */
export const tabletPath = (id: TabletPageId) => `${TABLETS_HUB_PATH}/${id}`;

/** Each page's name, as the app bar heads it (`pathnames.ts`). */
export const TABLET_PAGE_LABELS: Readonly<Record<TabletPageId, string>> = {
  earth: /*i18n*/ "Earth Tablet",
  air: /*i18n*/ "Air Tablet",
  water: /*i18n*/ "Water Tablet",
  fire: /*i18n*/ "Fire Tablet",
  union: /*i18n*/ "Tablet of Union",
};

/**
 * Each Watchtower's quarter in the Golden Dawn's attribution, in the
 * English of the titles (`src/seo/pages.ts`): magick-data holds it only
 * in each tablet's note ("The Watchtower of the North, Earth, …"), and a
 * test holds each to its note.
 */
export const WATCHTOWER_QUARTERS: Readonly<Record<WatchtowerPageId, string>> = {
  earth: "North",
  air: "East",
  water: "West",
  fire: "South",
};

/** The tablets before and after this one, in the tool's order. */
export function tabletNeighbours(id: TabletPageId): {
  prev?: TabletPageId;
  next?: TabletPageId;
} {
  const index = TABLET_PAGE_IDS.indexOf(id);
  return { prev: TABLET_PAGE_IDS[index - 1], next: TABLET_PAGE_IDS[index + 1] };
}

/** What a link into the tool opens: the tablet, its Differences, or pyramids. */
export type TabletToolView = "tablet" | "differences" | "pyramids";

/**
 * A link into the tool, written out as `tabletQuery` (`urlState.ts`, a
 * client module) writes it, which a test holds: the tablet in the
 * default version, at its Differences tab, or drawn as pyramids with
 * their symbols, as the page's image of them is.
 */
export function tabletToolHref(id: TabletPageId, view: TabletToolView) {
  const params = [
    id === "earth" ? "" : `tablet=${id}`,
    view === "differences" ? "tab=differences" : "",
    view === "pyramids" ? "pyramids=1&symbols=1" : "",
  ].filter(Boolean);
  return params.length
    ? `${TABLETS_HUB_PATH}?${params.join("&")}`
    : TABLETS_HUB_PATH;
}

/**
 * The images' alt text, for Lingui: `{element}` the Watchtower's element
 * in words, and the Union's four lines as `{first}` to `{fourth}`. The
 * page translates it; the structured data's caption is its English
 * (`src/seo/tablets.ts`).
 */
export const TABLET_ALT = {
  watchtower:
    /*i18n*/ "The Enochian {element} tablet in the Golden Dawn's version: its sigil above a grid of thirteen rows of twelve letters",
  union:
    /*i18n*/ "The Enochian Tablet of Union in the Golden Dawn's version: four rows of five letters, {first}, {second}, {third} and {fourth}",
  watchtowerPyramids:
    /*i18n*/ "The Enochian {element} tablet in the Golden Dawn's version with every square drawn as a truncated pyramid, its sides in their elements' colours with their symbols, round a white top with the square's letter",
  unionPyramids:
    /*i18n*/ "The Enochian Tablet of Union in the Golden Dawn's version with every square drawn as a truncated pyramid, its sides in their elements' colours with their symbols, round a white top with the square's letter",
} as const;

/**
 * Each page's opening sentence, for Lingui: the Watchtower's element, its
 * three holy names and its King, or the Union's four lines.
 */
export const TABLET_LEDE = {
  watchtower:
    /*i18n*/ "The {element} tablet is one of the four Watchtowers of Enochian magic. Its three holy names are {first}, {second} and {third}, and its King is {king}.",
  union:
    /*i18n*/ "The Tablet of Union joins the four Watchtowers of Enochian magic. Its four lines are {first}, {second}, {third} and {fourth}.",
} as const;

/**
 * A tablet image's alt text in the page's language (`t`), or in English
 * for the structured data: `lines` are the Union's four, as
 * `tabletLedeValues` spells them.
 */
export function tabletAlt(
  id: TabletPageId,
  drawing: "flat" | "pyramids",
  lines: Readonly<Record<string, string>>,
  t: Translate,
): string {
  if (id === "union")
    return drawing === "flat"
      ? t(TABLET_ALT.union, { ...lines })
      : t(TABLET_ALT.unionPyramids);
  const element = t(ELEMENT_WORDS[id] ?? id);
  return t(
    drawing === "flat" ? TABLET_ALT.watchtower : TABLET_ALT.watchtowerPyramids,
    { element },
  );
}
