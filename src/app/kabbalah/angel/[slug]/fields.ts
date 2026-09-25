import type { EntityFields } from "@/components/entity/fields";

/** The angel page's row, as [Angel.tsx](./Angel.tsx) lays it out. */
export const fields: EntityFields = {
  table: "seventyTwoAngel",
  shown: [
    // The heading's number, and what every derived row is computed from:
    // sign, degrees, decade, days, hour, choir, notes and neighbours.
    "no",
    "name.en",
    "name.he",
    "name.hePointed",
    "attribute.en",
    "attribute.fr",
    "people.en",
    "godName",
    "psalm.psalm",
    "psalm.verse",
    "psalm.la",
    "invokedFor.en",
    "governs.en",
    "bornUnder.en",
    "contrary.en",
    "printedPages",
  ],
  omitted: [
    // How the Hebrew was read. Every name a person read from the scan has a
    // `name.he` editorial note that says so, which the page renders.
    "name.heSource",
    // The table is in English; Lenain's French is his entry, printed in full
    // below it, and the book's own pages.
    "people.fr",
  ],
};
