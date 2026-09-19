/**
 * The tables the app reads through one import, assembled.
 *
 * It was a hand-written object whose rows were mutated in place at module
 * load — for each key ending in `Id`, if a table of that name existed, the
 * row it named was assigned onto the row — which made a link a guess from a
 * field name, left the result order-dependent, and put the whole set on
 * `window.magickData`. It is now [assemble()](./assemble.ts) over the tables
 * below, with [the graph](./graph.ts) saying what links to what.
 *
 * Three of the 26 in [the registry](./tables.ts) are missing, which is why
 * the imports are repeated here rather than taken from it. `seventyTwoAngel`,
 * `enochianTablet` and `christianChoir` are named nowhere in the graph, in
 * either direction, so assembling them adds no accessor to any row, and the
 * one page that reads the seventy-two imports the typed module directly.
 * Importing `tables` would carry their JSON — 63 KB for the seventy-two alone
 * — into the shared chunk of every route that reads the barrel, because a
 * module brings everything it imports with it whether or not the value is
 * used. `gdDegree` and `tribeOfIsrael` are here: they are link targets.
 * `satisfies` is what keeps the two lists from drifting, since a table added
 * to the registry must then be added here or excluded there by name.
 *
 * A page that wants one table should import that table, not this: the barrel
 * pulls in everything it can reach.
 */
// biome-ignore assist/source/organizeImports: grouped by subject, as tables.ts is
import { assemble } from "./assemble";
import type { Tables } from "./tables";

import planet from "./dist/astrology/planets.json";
import zodiac from "./dist/astrology/zodiac.json";
import house from "./dist/astrology/houses.json";

import hebrewLetter from "./dist/hebrewLetters.json";

import enochianLetter from "./dist/enochian/letters.json";

// The two the barrel also exports by name, so the exports below can have it.
import tetragramRows from "./dist/geomancy/tetragrams.json";
import geomanicHouseRows from "./dist/geomancy/houses.json";

import gdGrade from "./dist/gd/grades.json";
import gdDegree from "./dist/gd/degrees.json";

import archangel from "./dist/kabbalah/archangels.json";
import angelicOrder from "./dist/kabbalah/angelicOrders.json";
import fourWorlds from "./dist/kabbalah/fourWorlds.json";
import godName from "./dist/kabbalah/godNames.json";
import kerub from "./dist/kabbalah/kerubim.json";
import sephirah from "./dist/kabbalah/sephirot.json";
import tolPath from "./dist/kabbalah/paths.json";
import soul from "./dist/kabbalah/souls.json";
import tribeOfIsrael from "./dist/kabbalah/tribesOfIsrael.json";

import chakra from "./dist/chakras.json";

import alchemySymbol from "./dist/alchemy/symbols.json";
import alchemyTerm from "./dist/alchemy/terms.json";
import element from "./dist/alchemy/elements.json";
import elemental from "./dist/alchemy/elementals.json";

const barrel = {
  // ASTROLOGY
  planet,
  zodiac,
  house,

  hebrewLetter,

  // ENOCHIAN
  enochianLetter,

  // GEOMANCY
  tetragram: tetragramRows,
  geomanicHouse: geomanicHouseRows,

  // GOLDEN DAWN
  gdGrade,
  gdDegree,

  // KABBALAH
  archangel,
  angelicOrder,
  fourWorlds,
  godName,
  kerub,
  sephirah,
  tolPath,
  soul,
  tribeOfIsrael,

  chakra,

  // ALCHEMY
  alchemySymbol,
  alchemyTerm,
  element,
  elemental,
} satisfies Omit<
  Tables,
  "seventyTwoAngel" | "enochianTablet" | "christianChoir"
>;

const data = assemble(barrel);

export default data;

export const { geomanicHouse, tetragram } = data;
