import type { HallArt, HallArtProvenance } from "@magick-components/gd/hall";
import { bread } from "./bread";
import { type LegacyDrawing, LegacyPaths } from "./drawing";
import { fan } from "./fan";
import { rose } from "./rose";
import { salt } from "./salt";

/**
 * The hall drawings' items (plan 061, decision 9), lifted from
 * `public/pics` until stage H redraws them. They carry the signatures of
 * icon sets whose source and licence nobody recorded, so they live here in
 * the AGPL app, never in the MIT `src/components`, and reach the hall
 * renderer only through the app's art registry (`../art.ts`).
 */
const lifted = (source: string): HallArtProvenance => ({
  origin: "thirdParty",
  author: "unknown",
  licence: "unknown",
  source,
  notes: "icon-set signatures; replace in stage H",
});

const art = (drawing: LegacyDrawing, source: string): HallArt => ({
  Component: () => <LegacyPaths drawing={drawing} />,
  box: drawing.box,
  variant: () => "",
  provenance: lifted(source),
});

/** The legacy items by registry key, for the app's art registry. */
export const legacyHallArt: ReadonlyMap<string, HallArt> = new Map([
  ["item:salt", art(salt, "public/pics/neophyte.svg#g7064")],
  ["item:bread", art(bread, "public/pics/neophyte.svg#g11-8")],
  ["item:rose", art(rose, "public/pics/neophyte.svg#g6-06")],
  ["item:fan", art(fan, "public/pics/theoricus1.svg#g1-0")],
]);
