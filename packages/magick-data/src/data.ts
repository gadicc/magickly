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
 * Three of the 29 in [the registry](./tables.ts) are missing, which is why
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

import planet from "../dist/astrology/planets.js";
import zodiac from "../dist/astrology/zodiac.js";
import astrologicalHouse from "../dist/astrology/houses.js";

import hebrewLetter from "../dist/hebrewLetters.js";

import enochianLetter from "../dist/enochian/letters.js";

import tetragramRows from "../dist/geomancy/tetragrams.js";
import geomanticHouseRows from "../dist/geomancy/houses.js";

import gdGrade from "../dist/gd/grades.js";
import gdDegree from "../dist/gd/degrees.js";

import archangel from "../dist/kabbalah/archangels.js";
import angelicOrder from "../dist/kabbalah/angelicOrders.js";
import fourWorlds from "../dist/kabbalah/fourWorlds.js";
import godName from "../dist/kabbalah/godNames.js";
import kerub from "../dist/kabbalah/kerubim.js";
import sephirah from "../dist/kabbalah/sephirot.js";
import treeOfLifePath from "../dist/kabbalah/paths.js";
import soul from "../dist/kabbalah/souls.js";
import tribeOfIsrael from "../dist/kabbalah/tribesOfIsrael.js";

import chakra from "../dist/chakras.js";

import bodyPart from "../dist/body/parts.js";

import stone from "../dist/materia/stones.js";
import scent from "../dist/materia/scents.js";

import alchemySymbol from "../dist/alchemy/symbols.js";
import alchemyTerm from "../dist/alchemy/terms.js";
import element from "../dist/alchemy/elements.js";
import elemental from "../dist/alchemy/elementals.js";

const barrel = {
  // ASTROLOGY
  planet,
  zodiac,
  astrologicalHouse,

  hebrewLetter,

  // ENOCHIAN
  enochianLetter,

  // GEOMANCY
  tetragram: tetragramRows,
  geomanticHouse: geomanticHouseRows,

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
  treeOfLifePath,
  soul,
  tribeOfIsrael,

  chakra,

  // BODY
  bodyPart,

  // MATERIA
  stone,
  scent,

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
