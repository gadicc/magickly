/**
 * One name per table, so that a row prints as what it is.
 *
 * [`Row<I, T>`](./types.ts) is a mapped type over an intersection, so a hover,
 * an error message and step 4's `.d.ts` would otherwise show the whole
 * expansion of a row — its own fields, its links and their links — where the
 * useful word is `SephirahRow`. An interface that extends it and adds nothing
 * is structurally the same type, and TypeScript prints it by name.
 *
 * [types.ts](./types.ts) reaches back into this module through `NamedRows`,
 * so that a link inside a row is named too and a four-hop read reads as
 * `SephirahRow → GDGradeRow → PlanetRow → HebrewLetterRow`. The cycle between
 * the two modules is types only, and an interface's members are resolved
 * lazily, which is what makes a graph full of mutual references terminate.
 *
 * The names are `<Table>Row`, not `<Table>`: the typed modules beside each
 * JSON file already export `Sephirah`, `Planet` and the rest as
 * `Raw & Partial<Links>`, which is the shape that accepts a raw row and an
 * assembled one alike. These are the assembled row exactly.
 */
import type { Row } from "./types";

// ASTROLOGY
export interface PlanetRow extends Row<"*", "planet"> {}
export interface ZodiacRow extends Row<"*", "zodiac"> {}
export interface HouseRow extends Row<"*", "house"> {}

export interface HebrewLetterRow extends Row<"*", "hebrewLetter"> {}

// ENOCHIAN
export interface EnochianLetterRow extends Row<"*", "enochianLetter"> {}
export interface EnochianTabletRow extends Row<"*", "enochianTablet"> {}

// GEOMANCY
export interface TetragramRow extends Row<"*", "tetragram"> {}
export interface GeomanicHouseRow extends Row<"*", "geomanicHouse"> {}

// GOLDEN DAWN
export interface GDGradeRow extends Row<"*", "gdGrade"> {}
export interface GDDegreeRow extends Row<"*", "gdDegree"> {}

// KABBALAH
export interface ArchangelRow extends Row<"*", "archangel"> {}
export interface AngelicOrderRow extends Row<"*", "angelicOrder"> {}
export interface ChristianChoirRow extends Row<"*", "christianChoir"> {}
export interface FourWorldsRow extends Row<"*", "fourWorlds"> {}
export interface GodNameRow extends Row<"*", "godName"> {}
export interface KerubRow extends Row<"*", "kerub"> {}
export interface SephirahRow extends Row<"*", "sephirah"> {}
export interface TolPathRow extends Row<"*", "tolPath"> {}
export interface SoulRow extends Row<"*", "soul"> {}
export interface TribeOfIsraelRow extends Row<"*", "tribeOfIsrael"> {}
export interface SeventyTwoAngelRow extends Row<"*", "seventyTwoAngel"> {}

export interface ChakraRow extends Row<"*", "chakra"> {}

// ALCHEMY
export interface AlchemySymbolRow extends Row<"*", "alchemySymbol"> {}
export interface AlchemyTermRow extends Row<"*", "alchemyTerm"> {}
export interface ElementRow extends Row<"*", "element"> {}
export interface ElementalRow extends Row<"*", "elemental"> {}

/**
 * The name each table's rows take, by table name. `Row<"*", T>` resolves
 * through this, so every row of a fully assembled object — a table's, a
 * link's, a back-link's — is printed by name rather than expanded.
 */
export interface NamedRows {
  planet: PlanetRow;
  zodiac: ZodiacRow;
  house: HouseRow;

  hebrewLetter: HebrewLetterRow;

  enochianLetter: EnochianLetterRow;
  enochianTablet: EnochianTabletRow;

  tetragram: TetragramRow;
  geomanicHouse: GeomanicHouseRow;

  gdGrade: GDGradeRow;
  gdDegree: GDDegreeRow;

  archangel: ArchangelRow;
  angelicOrder: AngelicOrderRow;
  christianChoir: ChristianChoirRow;
  fourWorlds: FourWorldsRow;
  godName: GodNameRow;
  kerub: KerubRow;
  sephirah: SephirahRow;
  tolPath: TolPathRow;
  soul: SoulRow;
  tribeOfIsrael: TribeOfIsraelRow;
  seventyTwoAngel: SeventyTwoAngelRow;

  chakra: ChakraRow;

  alchemySymbol: AlchemySymbolRow;
  alchemyTerm: AlchemyTermRow;
  element: ElementRow;
  elemental: ElementalRow;
}
