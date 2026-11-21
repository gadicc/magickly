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
    // The intelligence's name, from `planetaryName`.
    "intelligence",
    // The Moon's other intelligence, beside Shelachel in the Intelligence
    // row, with a note on each (../Intelligence.tsx). The Hebrew is
    // Agrippa's; of the romanisations, his is in the row and 777's and the
    // Golden Dawn's in the note.
    "intelligenceOfIntelligences.he",
    "intelligenceOfIntelligences.roman",
    // The spirit's name, from `planetaryName`; its id draws its sigil and
    // names the sigil's source.
    "spirit",
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
    // Shown through their accessors, `hebrewLetter`, `godName`, `archangel`
    // and `intelligence`.
    "hebrewLetterId",
    "godNameId",
    "archangelId",
    "intelligenceId",
    // Every name of the planet's square, with each witness's reading: the
    // kamea pages' (plan 093, K4), not yet this page's.
    "planetaryNames",
  ],
};
