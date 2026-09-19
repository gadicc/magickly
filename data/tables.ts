/**
 * Every table, as the JSON [the build](./build.mts) emits.
 *
 * These are the raw rows: no links, nothing mutated, the file as authored.
 * [graph.ts](./graph.ts) says how they relate, [assemble.ts](./assemble.ts)
 * joins them, and [data.ts](./data.ts) is the assembled barrel the app reads.
 *
 * Table names are today's barrel keys (plan 032, decision 11); renaming them
 * belongs with the package extraction. Everything under `data/` is here bar
 * the Enochian dictionary and the Keys, which are not tables.
 */
// biome-ignore assist/source/organizeImports: grouped by subject, as data.ts is
import planet from "./dist/astrology/planets.json";
import zodiac from "./dist/astrology/zodiac.json";
import house from "./dist/astrology/houses.json";

import hebrewLetter from "./dist/hebrewLetters.json";

import enochianLetter from "./dist/enochian/letters.json";
import enochianTablet from "./dist/enochian/tablets.json";

import tetragram from "./dist/geomancy/tetragrams.json";
import geomanicHouse from "./dist/geomancy/houses.json";

import gdGrade from "./dist/gd/grades.json";
import gdDegree from "./dist/gd/degrees.json";

import archangel from "./dist/kabbalah/archangels.json";
import angelicOrder from "./dist/kabbalah/angelicOrders.json";
import christianChoir from "./dist/kabbalah/christianChoirs.json";
import fourWorlds from "./dist/kabbalah/fourWorlds.json";
import godName from "./dist/kabbalah/godNames.json";
import kerub from "./dist/kabbalah/kerubim.json";
import sephirah from "./dist/kabbalah/sephirot.json";
import tolPath from "./dist/kabbalah/paths.json";
import soul from "./dist/kabbalah/souls.json";
import tribeOfIsrael from "./dist/kabbalah/tribesOfIsrael.json";
import seventyTwoAngel from "./dist/kabbalah/seventyTwoAngels.json";

import chakra from "./dist/chakras.json";

import alchemySymbol from "./dist/alchemy/symbols.json";
import alchemyTerm from "./dist/alchemy/terms.json";
import element from "./dist/alchemy/elements.json";
import elemental from "./dist/alchemy/elementals.json";

export const tables = {
  // ASTROLOGY
  planet,
  zodiac,
  house,

  hebrewLetter,

  // ENOCHIAN
  enochianLetter,
  enochianTablet,

  // GEOMANCY
  tetragram,
  geomanicHouse,

  // GOLDEN DAWN
  gdGrade,
  gdDegree,

  // KABBALAH
  archangel,
  angelicOrder,
  christianChoir,
  fourWorlds,
  godName,
  kerub,
  sephirah,
  tolPath,
  soul,
  tribeOfIsrael,
  seventyTwoAngel,

  chakra,

  // ALCHEMY
  alchemySymbol,
  alchemyTerm,
  element,
  elemental,
};

/** Every table by name, raw. */
export type Tables = typeof tables;

/** The name of a table, which is also what a link's `to` names. */
export type TableName = keyof Tables;

export default tables;
