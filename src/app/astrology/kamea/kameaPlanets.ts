import kameas, {
  KAMEA_PLANETS,
  type KameaPlanetId,
} from "magick-data/astrology/kameas";

/**
 * The seven kameas as the reference pages present them (plan 093, K4):
 * where each page is, how a page names its planet and its square, the
 * square's four numbers, and where Agrippa and Regardie print it. Shared by
 * the kameas' hub and pages, the generator and the names' pages.
 */

export { KAMEA_PLANETS, type KameaPlanetId };

/** The kameas' hub. */
export const KAMEA_HUB_PATH = "/astrology/kamea";

/** A planet's kamea page: `/astrology/kamea/saturn`, by the planet table's id. */
export const kameaPath = (planet: KameaPlanetId) =>
  `${KAMEA_HUB_PATH}/${planet}`;

/** Whether a string is one of the seven planets with a kamea. */
export const isKameaPlanet = (value: string): value is KameaPlanetId =>
  (KAMEA_PLANETS as readonly string[]).includes(value);

/**
 * Each planet as a list or a picker names it, on its own: "Saturn", "The
 * Sun". Lingui messages; a sentence that names a planet has a message of
 * its own for each, so that a translation can decline the name.
 */
export const KAMEA_PLANET_LABELS: Record<KameaPlanetId, string> = {
  saturn: /*i18n*/ "Saturn",
  jupiter: /*i18n*/ "Jupiter",
  mars: /*i18n*/ "Mars",
  sol: /*i18n*/ "The Sun",
  venus: /*i18n*/ "Venus",
  mercury: /*i18n*/ "Mercury",
  luna: /*i18n*/ "The Moon",
};

/**
 * Each square's own name: "Kamea of the Sun". The kamea pages' heading
 * (`pathnames.ts` has the same words), the squares' accessible names and
 * the images' alt text lead with it.
 */
export const KAMEA_SQUARE_LABELS: Record<KameaPlanetId, string> = {
  saturn: /*i18n*/ "Kamea of Saturn",
  jupiter: /*i18n*/ "Kamea of Jupiter",
  mars: /*i18n*/ "Kamea of Mars",
  sol: /*i18n*/ "Kamea of the Sun",
  venus: /*i18n*/ "Kamea of Venus",
  mercury: /*i18n*/ "Kamea of Mercury",
  luna: /*i18n*/ "Kamea of the Moon",
};

/**
 * A square's alt text, in our own words, for Lingui: the page translates
 * it where it shows the square (`{square}` is the square's own name,
 * `KAMEA_SQUARE_LABELS`, and the rest `kameaConstants`), and the
 * structured data's caption is its English (`src/seo/kameas.ts`).
 */
export const KAMEA_ALT =
  /*i18n*/ "{square}, the magic square of {order} by {order}: the numbers 1 to {cells}, every row, column and diagonal adding up to {line}, and the whole to {total}, as Agrippa prints it";

/**
 * The squares the site gives with a cell of Agrippa's 1533 printing
 * corrected (Venus' 45 for 43, the Moon's 45 for 54; the kamea pages'
 * notes say where), whose alt text and captions say so.
 */
export const CORRECTED_PLANETS: readonly KameaPlanetId[] = ["venus", "luna"];

/** `KAMEA_ALT` for a square with a misprinted cell corrected. */
export const KAMEA_ALT_CORRECTED =
  /*i18n*/ "{square}, the magic square of {order} by {order}: the numbers 1 to {cells}, every row, column and diagonal adding up to {line}, and the whole to {total}, as Agrippa prints it with one misprinted number corrected";

/** A square's alt text message: corrected where the site corrects it. */
export const kameaAltMessage = (planet: KameaPlanetId) =>
  CORRECTED_PLANETS.includes(planet) ? KAMEA_ALT_CORRECTED : KAMEA_ALT;

/**
 * A name's sigil traced on its square, as its alt text and accessible name
 * give it, in our own words, for Lingui: `{name}` the name, `{hebrew}` the
 * letters traced, `{square}` the square's own name (`KAMEA_SQUARE_LABELS`).
 * The name's page translates it where it shows the sigil, and the
 * structured data's caption is its English (`src/seo/planetaryNames.ts`).
 */
export const PLANETARY_NAME_SIGIL_ALT =
  /*i18n*/ "The sigil of {name}, {hebrew}, traced on the {square} by the method Regardie sets out";

/**
 * The planet in English as the SEO copy and the files' names give it,
 * with its article: "Saturn", "the Sun". Not interface text: the titles
 * and descriptions are English (`src/seo/pages.ts`).
 */
export const KAMEA_PLANET_ENGLISH: Record<KameaPlanetId, string> = {
  saturn: "Saturn",
  jupiter: "Jupiter",
  mars: "Mars",
  sol: "the Sun",
  venus: "Venus",
  mercury: "Mercury",
  luna: "the Moon",
};

/** The four numbers a square's names are given: n, n², a line and the whole. */
export interface KameaConstants {
  /** The square's order, n: 3 for Saturn to 9 for the Moon. */
  order: number;
  /** Its cells, n², which is also its highest number. */
  cells: number;
  /** What every row, column and diagonal adds up to, n(n² + 1)/2. */
  line: number;
  /** All its numbers together, n²(n² + 1)/2. */
  total: number;
}

/** Which of a square's four numbers a name's number is. */
export type KameaConstant = keyof KameaConstants;

/** A planet's square's four numbers, from the square magick-data computes. */
export function kameaConstants(planet: KameaPlanetId): KameaConstants {
  const order = kameas[planet].length;
  const cells = order * order;
  return {
    order,
    cells,
    line: (order * (cells + 1)) / 2,
    total: (cells * (cells + 1)) / 2,
  };
}

/**
 * Which of the square's four numbers `number` is, or null for none. The
 * four differ on every square, so the answer is never ambiguous.
 */
export function constantOf(
  planet: KameaPlanetId,
  number: number | undefined,
): KameaConstant | null {
  if (number === undefined) return null;
  const constants = kameaConstants(planet);
  return (
    (Object.keys(constants) as KameaConstant[]).find(
      (key) => constants[key] === number,
    ) ?? null
  );
}

/** What each of the four numbers is, beside a name's number. */
export const CONSTANT_LABELS: Record<KameaConstant, string> = {
  order: /*i18n*/ "the square's order",
  cells: /*i18n*/ "the square's count of cells",
  line: /*i18n*/ "the sum of a line",
  total: /*i18n*/ "the sum of the square",
};

/**
 * How the square is made: `odd`, 1 below the centre and each next number
 * down and to the right; `doublyEven`, written in order with the blocks'
 * diagonals exchanged; `written`, the Sun's six, which neither builds
 * (magick-data's `kameas.ts`).
 */
export type KameaConstruction = "odd" | "doublyEven" | "written";

export function kameaConstruction(planet: KameaPlanetId): KameaConstruction {
  const { order } = kameaConstants(planet);
  return order % 2 === 1 ? "odd" : order % 4 === 0 ? "doublyEven" : "written";
}

/**
 * Where Agrippa prints each square, in numbers and in Hebrew letters, with
 * its seal and its intelligence's and spirit's characters beside it: the
 * leaves of archive.org `DeOccultaPhilosophiaLoc1533` (1533, book II,
 * chapter 22) and the printed pages. Written out so that the generator,
 * a client page, does not load the seals; a test holds it equal to
 * `PlanetarySeal`'s `PLANETARY_SEAL_LEAVES`.
 */
export const AGRIPPA_SQUARE_LEAVES: Readonly<
  Record<KameaPlanetId, { leaf: number; page: string }>
> = {
  saturn: { leaf: 164, page: "CXLIX" },
  jupiter: { leaf: 164, page: "CXLIX" },
  mars: { leaf: 165, page: "CL" },
  sol: { leaf: 165, page: "CL" },
  venus: { leaf: 166, page: "CLI" },
  mercury: { leaf: 167, page: "CLII" },
  luna: { leaf: 168, page: "CLIII" },
};

/**
 * Where Regardie's *The Golden Dawn*, vol. 4 (1940), prints each square
 * with its seal and characters, pp. 81–86: archive.org
 * `IsraelRegardie-TheGoldenDawn-Vol4-1940`, the leaves `planetaryNames`
 * gives the names' captions on.
 */
export const REGARDIE_SQUARE_LEAVES: Record<KameaPlanetId, number> = {
  saturn: 75,
  jupiter: 75,
  mars: 76,
  sol: 77,
  venus: 78,
  mercury: 79,
  luna: 80,
};

/** The planets before and after one in the Chaldean order, for the nav. */
export function kameaNeighbours(planet: KameaPlanetId): {
  prev?: KameaPlanetId;
  next?: KameaPlanetId;
} {
  const index = KAMEA_PLANETS.indexOf(planet);
  return { prev: KAMEA_PLANETS[index - 1], next: KAMEA_PLANETS[index + 1] };
}
