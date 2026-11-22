import { KAMEA_PLANETS, kameaPath } from "@/app/astrology/kamea/kameaPlanets";

/**
 * Public pages whose search text an adapter in the catalogue builds from
 * the page's data and messages, rather than from the literal prose of its
 * JSX (`scripts/search/prose.ts`): the seven kamea pages share one
 * component, whose every branch the extraction would give every square
 * alike (plan 093, K4), so each square's document is built for its own
 * planet instead.
 */
export const ADAPTED_PAGES: ReadonlySet<string> = new Set(
  KAMEA_PLANETS.map(kameaPath),
);
