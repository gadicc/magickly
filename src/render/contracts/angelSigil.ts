import { SIGIL_VIEWBOX } from "./roseSigil";
import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
  type ImageDimensions,
  invalid,
  parseDimensions,
} from "./types";

/**
 * The 72 angels' page slugs, in Lenain's order, so that the nth is at index
 * n - 1: `angelSlug` over the data, written out because the contracts ship
 * in client bundles and `seventyTwoAngel` is kept out of the data barrel. A
 * test holds the list to the data. **A published slug never changes.**
 */
export const ANGEL_SIGIL_SLUGS = [
  "vehuiah",
  "jeliel",
  "sitael",
  "elemiah",
  "mahasiah",
  "lelahel",
  "achaiah",
  "cahethel",
  "haziel",
  "aladiah",
  "lauviah-11",
  "hahaiah",
  "iezalel",
  "mebahel",
  "hariel",
  "hakamiah",
  "lauviah-17",
  "caliel",
  "leuviah",
  "pahaliah",
  "nelchael",
  "ieiaiel",
  "melahel",
  "hahiuiah",
  "nith-haiah",
  "haaiah",
  "ierathel",
  "seheiah",
  "reiiel",
  "omael",
  "lecabel",
  "vasariah",
  "iehuiah",
  "lehahiah",
  "chavakiah",
  "menadel",
  "aniel",
  "haamiah",
  "rehael",
  "ieiazel",
  "hahahel",
  "mikael",
  "veualiah",
  "ielahiah",
  "sealiah",
  "ariel",
  "asaliah",
  "mihael",
  "vehuel",
  "daniel",
  "hahasiah",
  "imamiah",
  "nanael",
  "nithael",
  "mebahiah",
  "poiel",
  "nemamiah",
  "ieialel",
  "harahel",
  "mitzrael",
  "umabel",
  "iah-hel",
  "anauel",
  "mehiel",
  "damabiah",
  "manakel",
  "eiael",
  "habuhiah",
  "rochel",
  "jabamiah",
  "haiaiel",
  "mumiah",
] as const;

/** One of the 72 angels' slugs. */
export type AngelSigilSlug = (typeof ANGEL_SIGIL_SLUGS)[number];

/**
 * The angels whose verse needs a note: Lenain gives Jabamiah (#70) no psalm
 * but "le 1er verset de la Genèse", in French only, so the talisman letters
 * the Vulgate's Latin of Genesis 1:1 (plan 096, decision 8), from Y0's verse
 * file. Written out for the same reason as the slugs; a test holds it to
 * the angels whose entry cites no psalm.
 */
export const ANGEL_SIGIL_GENESIS_VERSE: readonly AngelSigilSlug[] = [
  "jabamiah",
];

/**
 * The styles, in the order a menu lists them, `band` the default: the
 * package's `SIGIL_STYLES` (magick-components/gd/roseSigilStyles), written
 * out so that the contracts do not pull in the engine; a test holds the two
 * equal.
 */
export const ANGEL_SIGIL_STYLES = ["band", "bare", "rose", "talisman"] as const;

/** One of `ANGEL_SIGIL_STYLES`. */
export type AngelSigilStyle = (typeof ANGEL_SIGIL_STYLES)[number];

export interface AngelSigilImageProps extends ImageDimensions {
  angel: AngelSigilSlug;
  style: AngelSigilStyle;
}

/** Whether a string is one of the 72 angels' slugs. */
export function isAngelSigilSlug(value: string): value is AngelSigilSlug {
  return (ANGEL_SIGIL_SLUGS as readonly string[]).includes(value);
}

/**
 * The base of an angel's file for a style, without the extension: the
 * rose's is the file plan 088 published (`vehuiah-rose-cross-sigil`), the
 * others add their style (`vehuiah-rose-cross-sigil-band`).
 */
export function angelSigilFileBase(
  angel: AngelSigilSlug,
  style: AngelSigilStyle,
): string {
  return `${angel}-rose-cross-sigil${style === "rose" ? "" : `-${style}`}`;
}

/**
 * One of the 72 angels' sigils in one of the styles (plan 096, decision 1).
 * Only the slug and the style choose it: the Hebrew, the roman name and the
 * verse are the data's, read by the registration, so no free text reaches
 * an image. Not personal (a closed set drawn from public data) and not
 * indexed: every image it draws is a file under the angel's page, the copy
 * to index, and `/api/render/angel-sigil` sends every request there with a
 * permanent redirect, the rose to the file `rose-sigil` draws.
 */
export const angelSigil: ComponentImageContract<AngelSigilImageProps> = {
  slug: "angel-sigil",
  viewBox: SIGIL_VIEWBOX,
  rasterDefault: { width: 1024, height: 1024 },
  keys: ["angel", "style"],
  personal: false,
  indexed: false,
  parse(searchParams) {
    const angel = searchParams.get("angel");
    return {
      angel: (angel === null
        ? invalid()
        : choice(angel, ANGEL_SIGIL_SLUGS)) as AngelSigilSlug,
      style: choice(searchParams.get("style") || "band", ANGEL_SIGIL_STYLES),
      ...parseDimensions(searchParams, SIGIL_VIEWBOX),
    };
  },
  canonicalize(props) {
    const pairs: Array<[string, string]> = [["angel", props.angel]];
    if (props.style !== "band") pairs.push(["style", props.style]);
    return [...pairs, ...canonicalDimensions(props)];
  },
  filename: (props) => angelSigilFileBase(props.angel, props.style),
};
