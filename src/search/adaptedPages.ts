import { KAMEA_PLANETS, kameaPath } from "@/app/astrology/kamea/kameaPlanets";
import {
  TABLET_PAGE_IDS,
  tabletPath,
} from "@/app/enochian/tablets/tabletPages";
import { PUBLIC_PAGES } from "@/seo/pages";

/**
 * Public pages whose search text an adapter in the catalogue builds from
 * the page's data and messages, rather than from the literal prose of its
 * JSX (`scripts/search/prose.ts`): the seven kamea pages share one
 * component, whose every branch the extraction would give every square
 * alike (plan 093, K4), so each square's document is built for its own
 * planet instead; and the five tablets' pages likewise (plan 100).
 */
export const ADAPTED_PAGES: ReadonlySet<string> = new Set([
  ...KAMEA_PLANETS.map(kameaPath),
  ...TABLET_PAGE_IDS.map(tabletPath),
]);

/**
 * Public pages that are an app's interface around stored content, which the
 * catalogue describes by its metadata alone: the public rituals. Their JSX is
 * the reader's own controls and messages ("More Variables", "Ritual not
 * found."), not what the page is about, and indexing it would make every
 * change to the reader's wording a search republish (plan 089, deferred
 * item 9).
 */
export const INTERFACE_PAGES: ReadonlySet<string> = new Set(
  Object.keys(PUBLIC_PAGES).filter((path) => path.startsWith("/doc/")),
);

/** Public pages that get no extracted JSX prose, for either reason above. */
export const UNEXTRACTED_PAGES: ReadonlySet<string> = new Set([
  ...ADAPTED_PAGES,
  ...INTERFACE_PAGES,
]);
