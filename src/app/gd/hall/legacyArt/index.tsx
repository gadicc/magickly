import type {
  HallArt,
  HallArtProps,
  HallArtProvenance,
} from "@magick-components/gd/hall";
import { enumAttr } from "@magick-components/gd/hall/attributes";
import { HALL_COLOURS } from "@magick-components/gd/hall/vocabulary";
import { bread } from "./bread";
import { censer } from "./censer";
import { chalice } from "./chalice";
import { cup } from "./cup";
import { type LegacyDrawing, LegacyPaths } from "./drawing";
import { fan } from "./fan";
import { lamp } from "./lamp";
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

const COLOUR_NAMES = [...HALL_COLOURS.keys()];

/** A named colour mixed half and half with white, as glass. */
function glassOf(name: string): string {
  const hex = HALL_COLOURS.get(name) as string;
  if (!hex.startsWith("#")) return hex;
  const mixed = [1, 3, 5].map((at) =>
    Math.round((Number.parseInt(hex.slice(at, at + 2), 16) + 255) / 2)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${mixed.join("")}`;
}

const art = (drawing: LegacyDrawing, source: string): HallArt => ({
  Component: () => <LegacyPaths drawing={drawing} />,
  box: drawing.box,
  provenance: lifted(source),
});

/**
 * The lamp and the lantern are one drawing, the Neophyte altar's red lamp
 * (`g2-6`); the drawings' unglazed lanterns are stretched copies of it
 * (`g49`). The panes take `fill`, a named colour, mixed with white.
 */
const lampArt = (defaultGlass: string, source: string): HallArt => ({
  Component: ({ node }: HallArtProps) => {
    const name = enumAttr(node, "fill", COLOUR_NAMES);
    return (
      <LegacyPaths
        drawing={lamp}
        glass={name === undefined ? defaultGlass : glassOf(name)}
      />
    );
  },
  box: lamp.box,
  provenance: lifted(source),
});

/** The legacy items by registry key, for the app's art registry. */
export const legacyHallArt: ReadonlyMap<string, HallArt> = new Map([
  ["item:cup", art(cup, "public/pics/neophyte.svg#g26")],
  ["item:chalice", art(chalice, "public/pics/zelator2.svg#g6960")],
  ["item:salt", art(salt, "public/pics/neophyte.svg#g7064")],
  ["item:bread", art(bread, "public/pics/neophyte.svg#g11-8")],
  ["item:rose", art(rose, "public/pics/neophyte.svg#g6-06")],
  ["item:lamp", lampArt("#ff8080", "public/pics/neophyte.svg#g2-6")],
  [
    "item:lantern",
    lampArt(
      "#f8edb4",
      "public/pics/neophyte.svg#g2-6 (glazed as zelator1.svg#g49)",
    ),
  ],
  ["item:censer", art(censer, "public/pics/zelator2.svg#g239")],
  ["item:fan", art(fan, "public/pics/theoricus1.svg#g1-0")],
]);
