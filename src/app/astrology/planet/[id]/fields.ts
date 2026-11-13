import type { EntityFields } from "@/ui/entity/fields";

/** The planet page's row, as [Planet.tsx](./Planet.tsx) lays it out. */
export const fields: EntityFields = {
  table: "planet",
  shown: [
    // The heading, the lede and the Symbol row.
    "name.en",
    "commonName",
    "name.he",
    "symbol",
    // The lede, where a row has its own text (plan 078).
    "about.en",
    // The Symbol row's second half: the metal, for the seven.
    "alchemySymbol",
    // Hebrew letter, and through its `hermeticPath` the Path row.
    "hebrewLetter",
    // Sephirah for a planet; for a sphere, the ten heavens.
    "sephirot",
    "godName",
    "archangel",
    // Pending links with no table yet, so rendered as text, capitalised.
    "intelligenceId",
    "spiritId",
    "zodiacs",
    "tetragrams",
    "gdGrade",
    "keyOfSolomon.en",
  ],
  omitted: [
    // The URL's; it decides the Planetary hours link and is not printed.
    "id",
    // Whether the row is a planet or a sphere: it chooses the lede and
    // whether there is a table, and is data for the types, not a row.
    "kind",
    // The meta description, which `planetPage` gives the route.
    "description.en",
    // Shown through their accessors, `hebrewLetter`, `godName`, `archangel`.
    "hebrewLetterId",
    "godNameId",
    "archangelId",
  ],
};
