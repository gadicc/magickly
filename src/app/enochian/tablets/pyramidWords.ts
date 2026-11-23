import planets, { type PlanetId } from "magick-data/astrology/planets";
import zodiac from "magick-data/astrology/zodiac";
import type {
  NameLetter,
  TabletPyramid,
  TabletPyramidAttribution,
  TabletPyramidSide,
} from "magick-data/enochian/tabletPyramids";
import godForms, { type GDGodFormId } from "magick-data/gd/godForms";
import tetragrams from "magick-data/geomancy/tetragrams";
import hebrewLetters from "magick-data/hebrewLetters";
import kerubim, { type KerubId } from "magick-data/kabbalah/kerubim";
import paths from "magick-data/kabbalah/paths";
import sephirot from "magick-data/kabbalah/sephirot";
import { minorCard } from "magick-data/tarot/minorCards";
import { ELEMENT_WORDS, groupLabel, type Translate } from "./nameWords";

/**
 * The Squares tab's words for a square's pyramid (plan 095, decision 3):
 * each sentence a whole message for Lingui. The attributions' names (the
 * signs, planets, Sephiroth, cards, trumps, letters, figures and Kerubs)
 * are magick-data's, in English, and joined as a list in the reader's
 * language; the elements are the page's own messages.
 */

/** An element of a side: the four and Spirit. */
export type SideElement = "fire" | "water" | "air" | "earth" | "spirit";

/** Each element by name, Spirit with the four. */
export const SIDE_ELEMENT_WORDS: Readonly<Record<SideElement, string>> = {
  ...(ELEMENT_WORDS as Record<Exclude<SideElement, "spirit">, string>),
  spirit: /*i18n*/ "Spirit",
};

/**
 * Each element's colour on a side, and the colour of a symbol painted on
 * it, its complement (Regardie, vol. 4, pp.294–295): Fire red with green,
 * Water blue with orange, Air yellow with violet, Earth black with white,
 * Spirit white with black. The reds, blues and yellows are the tablets'
 * own (`tabletSvg.tsx`), as are the green and orange their angles are
 * lettered in. A complement can be close to its ground in lightness (the
 * green on red, the orange on blue), so every symbol is drawn with a thin
 * `outline`, dark on a light ground and light on a dark one, which stands
 * out from the ground by at least 3:1 (`pyramidColours.test.ts`).
 */
export const SIDE_COLOURS: Readonly<
  Record<
    SideElement | "white",
    { fill: string; symbol: string; outline: string }
  >
> = {
  fire: { fill: "#ff3333", symbol: "#22bb22", outline: "#000000" },
  water: { fill: "#5599ff", symbol: "#ff8800", outline: "#000000" },
  air: { fill: "#fff100", symbol: "#7b1fa2", outline: "#000000" },
  earth: { fill: "#000000", symbol: "#ffffff", outline: "#ffffff" },
  spirit: { fill: "#ffffff", symbol: "#000000", outline: "#000000" },
  // A Calvary square's fourth side, which carries its Sephirah and no
  // element: white, as the source allows (or the Sephirah's colour).
  white: { fill: "#ffffff", symbol: "#000000", outline: "#000000" },
};

/**
 * Text presentation for a symbol that may otherwise be drawn as an emoji:
 * the zodiac's carry U+FE0E in the data, the planets' and Spirit's wheel
 * do not.
 */
export const asText = (symbol: string) =>
  symbol.endsWith("\uFE0E") ? symbol : `${symbol}\uFE0E`;

/** A Hebrew letter's glyph and name, by its id. */
const letterOf = (id: string) =>
  (hebrewLetters as Record<string, { letter: { he: string; name: string } }>)[
    id
  ]?.letter;

/** A planet's everyday English name: "Sun", "Moon", "Mars". */
export const planetName = (id: PlanetId) => {
  const planet = planets[id] as {
    commonName?: string;
    name: { en: { en: string } };
  };
  return planet.commonName ?? planet.name.en.en;
};

/** What a side's symbol is, for the drawing. */
export type SideSymbol =
  | { kind: "text"; text: string; hebrew?: boolean }
  | { kind: "element"; element: SideElement }
  | { kind: "figure"; rows: readonly number[] };

/**
 * The symbol painted on a side: its sign, planet, Sephirah's number,
 * Hebrew letter or geomantic figure, and where the side carries none of
 * these (Spirit, an element alone, a card or a trump), its element's.
 * Ours: the sources paint a symbol of each kind, and the drawing shows
 * the one a reader is most likely to know.
 */
export function sideSymbol(side: TabletPyramidSide): SideSymbol {
  const { attribution: a } = side;
  if (a.zodiacId)
    return { kind: "text", text: asText(zodiac[a.zodiacId].symbol) };
  if (a.sephirahId)
    return { kind: "text", text: String(sephirot[a.sephirahId].index) };
  if (a.planetId)
    return { kind: "text", text: asText(planets[a.planetId].symbol) };
  if (a.hebrewLetterId)
    return {
      kind: "text",
      text: letterOf(a.hebrewLetterId)?.he ?? "",
      hebrew: true,
    };
  if (a.tetragramId)
    return { kind: "figure", rows: tetragrams[a.tetragramId].rows };
  return {
    kind: "element",
    element: (a.elementId ?? side.elementId ?? "spirit") as SideElement,
  };
}

/** The attributions of a side, by name, in the order the data gives them. */
export function attributionNames(
  a: TabletPyramidAttribution,
  t: Translate,
): string[] {
  const names: string[] = [];
  if (a.decanId && a.zodiacId)
    names.push(
      t(/*i18n*/ "decan {number} of {sign}", {
        number: Number(a.decanId.split("-")[1]),
        sign: zodiac[a.zodiacId].name.en,
      }),
    );
  else if (a.kerubId)
    names.push(
      t(/*i18n*/ "the {kerub} and {sign}", {
        kerub: kerubim[a.kerubId].face.en,
        sign: a.zodiacId ? zodiac[a.zodiacId].name.en : "",
      }),
    );
  else if (a.zodiacId) names.push(zodiac[a.zodiacId].name.en);
  if (a.elementId) names.push(t(SIDE_ELEMENT_WORDS[a.elementId]));
  if (a.sephirahId)
    names.push(
      t(/*i18n*/ "the Sephirah {sephirah} ({number})", {
        sephirah: sephirot[a.sephirahId].name.roman,
        number: sephirot[a.sephirahId].index,
      }),
    );
  if (a.planetId)
    names.push(
      // The two lights take the article in a sentence: "the Moon".
      a.planetId === "sol" || a.planetId === "luna"
        ? t(/*i18n*/ "the {planet}", { planet: planetName(a.planetId) })
        : planetName(a.planetId),
    );
  if (a.minorCardId) names.push(minorCard(a.minorCardId)?.name ?? "");
  if (a.pathId) {
    const { hermetic: trump } = paths[a.pathId] as {
      hermetic: { tarotId: string; tarotTitle: string };
    };
    names.push(
      t(/*i18n*/ "{title} (trump {number})", {
        title: trump.tarotTitle,
        number: trump.tarotId,
      }),
    );
  }
  if (a.hebrewLetterId)
    names.push(
      t(/*i18n*/ "the letter {letter}", {
        letter: letterOf(a.hebrewLetterId)?.name ?? "",
      }),
    );
  if (a.tetragramId) names.push(tetragrams[a.tetragramId].title.en);
  return names;
}

/** A list of names in the reader's language: "Aries, Mars and Fire". */
export type ListWords = (items: readonly string[]) => string;

/** A list formatter for a locale. */
export const listWords =
  (locale: string): ListWords =>
  (items) =>
    new Intl.ListFormat(locale, { type: "conjunction" }).format(items);

/**
 * A side in words, for the list beside the drawing and screen readers:
 * "Left, side 1: Fire, with decan 1 of Aries and Two of Wands".
 */
export function sideInWords(
  side: TabletPyramidSide,
  t: Translate,
  list: ListWords,
): string {
  const names = attributionNames(side.attribution, t);
  const values = {
    element: side.elementId
      ? t(SIDE_ELEMENT_WORDS[side.elementId as SideElement])
      : "",
    attributions: list(names),
  };
  const plain = names.length === 0;
  switch (side.place) {
    case "left":
      return plain
        ? t(/*i18n*/ "Left, side 1: {element}", values)
        : t(/*i18n*/ "Left, side 1: {element}, with {attributions}", values);
    case "top":
      return plain
        ? t(/*i18n*/ "Top, side 2: {element}", values)
        : t(/*i18n*/ "Top, side 2: {element}, with {attributions}", values);
    case "right":
      return plain
        ? t(/*i18n*/ "Right, side 3: {element}", values)
        : t(/*i18n*/ "Right, side 3: {element}, with {attributions}", values);
    case "bottom":
      if (!side.elementId)
        return t(/*i18n*/ "Bottom, side 4: white, with {attributions}", values);
      return plain
        ? t(/*i18n*/ "Bottom, side 4: {element}", values)
        : t(/*i18n*/ "Bottom, side 4: {element}, with {attributions}", values);
  }
}

/** The letters of the Name by name. */
export const NAME_LETTER_WORDS: Readonly<Record<NameLetter, string>> = {
  yod: /*i18n*/ "Yod",
  he: /*i18n*/ "He",
  vav: /*i18n*/ "Vau",
  heFinal: /*i18n*/ "He final",
};

/**
 * Where a square lies, and the letters of the Name that govern it: "A
 * servient square of Air of Earth: its column under Vau, its rank under
 * He".
 */
export function regionInWords(
  pyramid: TabletPyramid,
  tablet: string,
  t: Translate,
): string {
  const letter = (id: NameLetter | undefined) =>
    id ? t(NAME_LETTER_WORDS[id]) : "";
  const quarter = pyramid.quarter
    ? groupLabel(pyramid.quarter, tablet, "gd", t)
    : "";
  switch (pyramid.region) {
    case "greatCross":
      return t(
        /*i18n*/ "On the Great Cross, in a block of three squares under {letter} of the Name",
        { letter: letter(pyramid.letters.block) },
      );
    case "calvaryCross":
      return t(/*i18n*/ "On the Calvary cross of {quarter}", { quarter });
    case "kerubic":
      return t(
        /*i18n*/ "A Kerubic square of {quarter}, under {letter} of the Name",
        {
          quarter,
          letter: letter(pyramid.letters.column),
        },
      );
    case "servient":
      return t(
        /*i18n*/ "A servient square of {quarter}: its column under {column} of the Name, its rank under {rank}",
        {
          quarter,
          column: letter(pyramid.letters.column),
          rank: letter(pyramid.letters.rank),
        },
      );
    case "union":
      return t(
        /*i18n*/ "On the Tablet of Union, in the line of {element}, column {column}",
        {
          element: t(SIDE_ELEMENT_WORDS[lineElement(pyramid)]),
          column: pyramid.column + 1,
        },
      );
  }
}

/** A square of the Tablet of Union's line's element: its side 3's. */
const lineElement = (pyramid: TabletPyramid) =>
  (pyramid.sides[2].elementId ?? "spirit") as SideElement;

/** The elements of a servient square's four sides, counted. */
function counted(pyramid: TabletPyramid) {
  const counts = new Map<SideElement, number>();
  for (const side of pyramid.sides) {
    const element = side.elementId as SideElement;
    counts.set(element, (counts.get(element) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

/**
 * Why a servient square has its god, from the mix of its sides' elements
 * (vol. 4, p.315), naming the god: "Two sides of Water and two of Earth:
 * the god is Athor."
 */
export function godInWords(pyramid: TabletPyramid, t: Translate): string {
  const id = pyramid.godFormId as GDGodFormId;
  const god = godForms[id].name.en;
  const mix = counted(pyramid);
  const word = (index: number) =>
    t(SIDE_ELEMENT_WORDS[mix[index]?.[0] ?? "spirit"]);
  switch (godForms[id].mix) {
    case "each":
      return t(/*i18n*/ "One side of each element: the god is {god}.", { god });
    case "single":
      return t(
        /*i18n*/ "{element} on {count} of the four sides: the god is {god}.",
        { element: word(0), count: mix[0]?.[1] ?? 0, god },
      );
    case "pair":
      return t(
        /*i18n*/ "Two sides of {first} and two of {second}: the god is {god}.",
        { first: word(0), second: word(1), god },
      );
    default:
      return t(
        /*i18n*/ "{doubled} on two sides, {first} and {second} on one each: the god is {god}, a Child of Horus.",
        { doubled: word(0), first: word(1), second: word(2), god },
      );
  }
}

/** The Kerubs that give a sphinx wings (vol. 4, p.311): the Eagle and the Man. */
const WINGED: ReadonlySet<KerubId> = new Set(["water", "air"]);
/** The active elements; Water and Earth are passive. */
const ACTIVE: ReadonlySet<string> = new Set(["fire", "air"]);

/** A Kerub by its face: "the Lion". */
const kerubWords = (id: KerubId, t: Translate) =>
  t(/*i18n*/ "the {kerub}", { kerub: kerubim[id].face.en });

/** Which of the three a sphinx's tendency is (vol. 4, p.312). */
export type SphinxTendency = "male" | "female" | "none";

/** A servient square's tendency: by its active and passive sides. */
export function tendencyOf(pyramid: TabletPyramid): SphinxTendency {
  const active = pyramid.sides.filter((side) =>
    ACTIVE.has(side.elementId ?? ""),
  ).length;
  return active > 2 ? "male" : active < 2 ? "female" : "none";
}

/**
 * A servient square's sphinx, as the source builds it, by side: the
 * head, the body and forelimbs, the hind limbs, the wings and the
 * tendency, each a sentence. Not one figure: the source does not say
 * which of the left and right sides gives which part.
 */
export function sphinxInWords(pyramid: TabletPyramid, t: Translate): string[] {
  const sphinx = pyramid.sphinx;
  if (!sphinx) return [];
  const [left, top, right, bottom] = sphinx;
  const active = pyramid.sides.filter((side) =>
    ACTIVE.has(side.elementId ?? ""),
  ).length;
  const tendency = tendencyOf(pyramid);
  return [
    t(/*i18n*/ "Head and neck, from the top side: {kerub}.", {
      kerub: kerubWords(top, t),
    }),
    left === right
      ? t(
          /*i18n*/ "Body and forelimbs, from the left and right sides: {kerub} on both.",
          { kerub: kerubWords(left, t) },
        )
      : t(
          /*i18n*/ "Body and forelimbs, from the left and right sides: {left} and {right}; the source does not say which gives which.",
          { left: kerubWords(left, t), right: kerubWords(right, t) },
        ),
    t(/*i18n*/ "Hind limbs and tail, from the bottom side: {kerub}.", {
      kerub: kerubWords(bottom, t),
    }),
    sphinx.some((kerub) => WINGED.has(kerub))
      ? t(
          /*i18n*/ "It is winged, since the Eagle or the Man is among its Kerubs.",
        )
      : t(
          /*i18n*/ "It has no wings: neither the Eagle nor the Man is among its Kerubs.",
        ),
    tendency === "male"
      ? t(
          /*i18n*/ "Its tendency is male: {count} of its sides are active, Fire or Air.",
          { count: active },
        )
      : tendency === "female"
        ? t(
            /*i18n*/ "Its tendency is female: {count} of its sides are passive, Water or Earth.",
            { count: 4 - active },
          )
        : t(
            /*i18n*/ "No tendency is stated: two of its sides are active and two passive.",
          ),
  ];
}
