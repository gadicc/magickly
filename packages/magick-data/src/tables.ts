/**
 * Every table, as the module [the build](./build.ts) emits for it, whose
 * generated declaration states its type.
 *
 * These are the raw rows: no links, nothing mutated, the file as authored.
 * [graph.ts](./graph.ts) says how they relate, [assemble.ts](./assemble.ts)
 * joins them, and [data.ts](./data.ts) is the assembled barrel the app reads.
 *
 * Table names are today's barrel keys (plan 032, decision 11); renaming them
 * belongs with the package extraction. Everything under `src/` is here bar
 * the Enochian dictionary and the Keys, which are not tables.
 */
// biome-ignore assist/source/organizeImports: grouped by subject, as data.ts is
import planet from "../dist/astrology/planets.js";
import zodiac from "../dist/astrology/zodiac.js";
import astrologicalHouse from "../dist/astrology/houses.js";

import hebrewLetter from "../dist/hebrewLetters.js";

import enochianLetter from "../dist/enochian/letters.js";
import enochianTablet from "../dist/enochian/tablets.js";

import tetragram from "../dist/geomancy/tetragrams.js";
import geomanticHouse from "../dist/geomancy/houses.js";

import gdGrade from "../dist/gd/grades.js";
import gdDegree from "../dist/gd/degrees.js";

import archangel from "../dist/kabbalah/archangels.js";
import angelicOrder from "../dist/kabbalah/angelicOrders.js";
import christianChoir from "../dist/kabbalah/christianChoirs.js";
import fourWorlds from "../dist/kabbalah/fourWorlds.js";
import godName from "../dist/kabbalah/godNames.js";
import kerub from "../dist/kabbalah/kerubim.js";
import sephirah from "../dist/kabbalah/sephirot.js";
import treeOfLifePath from "../dist/kabbalah/paths.js";
import soul from "../dist/kabbalah/souls.js";
import tribeOfIsrael from "../dist/kabbalah/tribesOfIsrael.js";
import seventyTwoAngel from "../dist/kabbalah/seventyTwoAngels.js";

import chakra from "../dist/chakras.js";

import bodyPart from "../dist/body/parts.js";

import stone from "../dist/materia/stones.js";
import scent from "../dist/materia/scents.js";

import alchemySymbol from "../dist/alchemy/symbols.js";
import alchemyTerm from "../dist/alchemy/terms.js";
import element from "../dist/alchemy/elements.js";
import elemental from "../dist/alchemy/elementals.js";

/**
 * Every table by name, raw: what each generated declaration states. It is
 * written out rather than inferred from `tables` so that no declaration
 * emitted from this module has to spell every table's structure inline. It
 * is a `type` and not an `interface`: an interface has no implicit index
 * signature, and `assemble()`'s implementation signature and `pathTarget()`'s
 * default both need one.
 */
export type Tables = {
  planet: typeof planet;
  zodiac: typeof zodiac;
  astrologicalHouse: typeof astrologicalHouse;
  hebrewLetter: typeof hebrewLetter;
  enochianLetter: typeof enochianLetter;
  enochianTablet: typeof enochianTablet;
  tetragram: typeof tetragram;
  geomanticHouse: typeof geomanticHouse;
  gdGrade: typeof gdGrade;
  gdDegree: typeof gdDegree;
  archangel: typeof archangel;
  angelicOrder: typeof angelicOrder;
  christianChoir: typeof christianChoir;
  fourWorlds: typeof fourWorlds;
  godName: typeof godName;
  kerub: typeof kerub;
  sephirah: typeof sephirah;
  treeOfLifePath: typeof treeOfLifePath;
  soul: typeof soul;
  tribeOfIsrael: typeof tribeOfIsrael;
  seventyTwoAngel: typeof seventyTwoAngel;
  chakra: typeof chakra;
  bodyPart: typeof bodyPart;
  stone: typeof stone;
  scent: typeof scent;
  alchemySymbol: typeof alchemySymbol;
  alchemyTerm: typeof alchemyTerm;
  element: typeof element;
  elemental: typeof elemental;
};

export const tables: Tables = {
  // ASTROLOGY
  planet,
  zodiac,
  astrologicalHouse,

  hebrewLetter,

  // ENOCHIAN
  enochianLetter,
  enochianTablet,

  // GEOMANCY
  tetragram,
  geomanticHouse,

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
  treeOfLifePath,
  soul,
  tribeOfIsrael,
  seventyTwoAngel,

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
};

/** The name of a table, which is also what a link's `to` names. */
export type TableName = keyof Tables;

export default tables;
