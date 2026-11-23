import type { Angel } from "magick-data/kabbalah/seventyTwoAngels";
import { angelNameShared, angelSlug } from "@/lib/angelSlugs";
import {
  ANGEL_SIGIL_GENESIS_VERSE,
  ANGEL_SIGIL_STYLES,
  type AngelSigilSlug,
  type AngelSigilStyle,
  angelSigilFileBase,
} from "@/render/contracts/angelSigil";
import {
  canonicalSigilText,
  sigilRasterDefault,
  sigilWordCount,
} from "@/render/contracts/roseSigil";

/*
 * The angels' Rose Cross sigil files (plan 088, S4) as a page links them:
 * their names, paths and sizes and the alt text's messages, with nothing
 * that draws, so that a client page (the 72 angels' list) can show them
 * without the structured data's catalogue. `angelSigils.ts` has the rest.
 */

/** Where an angel's page is. */
export const angelPath = (angel: Angel) =>
  `/kabbalah/angel/${angelSlug(angel.no)}`;

/**
 * The text an angel's sigil traces: the name as the site spells it
 * (`name.he`), as the contract keeps it. Every one of the 72 is plain rose
 * letters, so this never falls back; a test holds it so.
 */
export function angelSigilText(angel: Angel): string {
  const text = canonicalSigilText(angel.name.he ?? "");
  if (text === null)
    throw new Error(`angel ${angel.no} has no sigil text: ${angel.name.he}`);
  return text;
}

/**
 * The generator with an angel's name in it, encoded as the generator's own
 * example links encode theirs (`SigilsText.tsx`).
 */
export const angelSigilGeneratorHref = (angel: Angel) =>
  `/gd/sigils?text=${encodeURIComponent(angelSigilText(angel))}`;

/** One of an angel's static sigil files. */
export interface AngelSigilFile {
  /** The file's name in the URL: `vehuiah-rose-cross-sigil.png`. */
  name: string;
  /** Its path on the site, under the angel's page. */
  path: string;
  format: "png" | "svg";
  /** The style it draws (plan 096): the rose's are plan 088's files. */
  style: AngelSigilStyle;
  /** The PNG's pixels. The SVG states only its viewBox, so has none. */
  width?: number;
  height?: number;
}

/** One style's two files: the PNG and the SVG. */
export interface AngelSigilFiles {
  png: AngelSigilFile & { width: number; height: number };
  svg: AngelSigilFile;
}

/**
 * An angel's two files of a style (plan 096, decision 3): the PNG at the
 * contract's raster default, 1,024 pixels square, and the SVG. The rose's
 * keep plan 088's names (`vehuiah-rose-cross-sigil.png`), on the Golden
 * Dawn's rose with the rose shown; every other style adds its own
 * (`vehuiah-rose-cross-sigil-band.png`).
 */
export function angelSigilStyleFiles(
  angel: Angel,
  style: AngelSigilStyle,
): AngelSigilFiles {
  const base = angelSigilFileBase(angelSlug(angel.no) as AngelSigilSlug, style);
  const file = (format: "png" | "svg") => ({
    name: `${base}.${format}`,
    path: `${angelPath(angel)}/${base}.${format}`,
    format,
    style,
  });
  return {
    png: {
      ...file("png"),
      // Every style is drawn in the rose's square (the package's viewBox
      // for one word), so each has the rose's raster default.
      ...sigilRasterDefault(sigilWordCount(angelSigilText(angel))),
    },
    svg: file("svg"),
  };
}

/** An angel's rose files (plan 088, S4). */
export const angelSigilFiles = (angel: Angel): AngelSigilFiles =>
  angelSigilStyleFiles(angel, "rose");

/** Every style's files for an angel, in the styles' order. */
export const angelSigilEveryStyle = (angel: Angel) =>
  ANGEL_SIGIL_STYLES.map((style) => angelSigilStyleFiles(angel, style));

/**
 * The sigil's alt text, in our own words, for Lingui: the page translates
 * it where it is shown, and the structured data's caption is its English.
 */
export const ANGEL_SIGIL_ALT =
  /*i18n*/ "The Rose Cross sigil of {name}, {hebrew}, traced on the Golden Dawn's rose of 22 letters";

/**
 * The alt text of a genius whose name another shares (the two Lauviahs,
 * whose names and so whose sigils are the same): with its number, as its
 * slug has it, so that the two images are not described word for word
 * alike.
 */
export const ANGEL_SIGIL_ALT_NUMBERED =
  /*i18n*/ "The Rose Cross sigil of {name}, angel {number} of the 72, {hebrew}, traced on the Golden Dawn's rose of 22 letters";

/** The alt text's message for an angel: numbered where the name is shared. */
export const angelSigilAltMessage = (angel: Angel) =>
  angelNameShared(angel.no) ? ANGEL_SIGIL_ALT_NUMBERED : ANGEL_SIGIL_ALT;

/*
 * Plan 096's styles, as a reader meets them (Y4). Each message is a
 * descriptor so that it carries a translator's comment; the page passes
 * its `id`. The lettering inside the images is source data and never
 * passes here.
 */

/** A message with a note for its translator, as Lingui extracts it. */
interface Described {
  id: string;
  comment: string;
}

const STYLE_LABELS = {
  band: /*i18n*/ {
    id: "In a ring with its name",
    comment:
      "An option of the angel page's \"Sigil style\" menu, and a label in its list of every style's files: the angel's sigil inside a ring, the angel's name lettered in the ring",
  },
  bare: /*i18n*/ {
    id: "Alone, with its name",
    comment:
      "An option of the angel page's \"Sigil style\" menu, and a label in its list of files: the sigil drawn on its own, the angel's name beneath it",
  },
  rose: /*i18n*/ {
    id: "On the rose",
    comment:
      "An option of the angel page's \"Sigil style\" menu, and a label in its list of files: the sigil drawn over the Golden Dawn's Rose Cross lettered with the Hebrew alphabet",
  },
  talisman: /*i18n*/ {
    id: "Talisman with its verse",
    comment:
      "An option of the angel page's \"Sigil style\" menu, and a label in its list of files: the sigil inside a ring lettered with the angel's psalm verse in Latin",
  },
} as const satisfies Record<AngelSigilStyle, Described>;

/**
 * Each style's name, as the angel page's menu and its list of files show
 * it (plan 096, "Lingui"): descriptive, not the code's word.
 */
export const ANGEL_SIGIL_STYLE_LABELS: Readonly<
  Record<AngelSigilStyle, string>
> = Object.fromEntries(
  ANGEL_SIGIL_STYLES.map((style) => [style, STYLE_LABELS[style].id]),
) as Record<AngelSigilStyle, string>;

const BAND_ALT = /*i18n*/ {
  id: "The Rose Cross sigil of {name}, {hebrew}, inside a ring with the name in Hebrew as Lenain prints it",
  comment:
    "Alt text of an angel's sigil inside a ring (angel page, 72 angels list). {name} is the angel's name in English, {hebrew} the same in Hebrew letters",
};
const BAND_ALT_NUMBERED = /*i18n*/ {
  id: "The Rose Cross sigil of {name}, angel {number} of the 72, {hebrew}, inside a ring with the name in Hebrew as Lenain prints it",
  comment:
    "Alt text as above, for one of the two angels named Lauviah, told apart by {number}, their place among the 72",
};
const BARE_ALT = /*i18n*/ {
  id: "The Rose Cross sigil of {name}, {hebrew}, drawn alone with the name beneath",
  comment:
    "Alt text of an angel's sigil drawn on its own, its name beneath (angel page). {name} is the angel's name in English, {hebrew} the same in Hebrew letters",
};
const BARE_ALT_NUMBERED = /*i18n*/ {
  id: "The Rose Cross sigil of {name}, angel {number} of the 72, {hebrew}, drawn alone with the name beneath",
  comment:
    "Alt text as above, for one of the two angels named Lauviah, told apart by {number}, their place among the 72",
};
const TALISMAN_ALT = /*i18n*/ {
  id: "A talisman of {name}, {hebrew}: the Rose Cross sigil, with the name in Hebrew as Lenain prints it, inside a ring lettered with a verse of Psalm {psalm} (Vulgate numbering) in Latin",
  comment:
    "Alt text of an angel's talisman (angel page): the sigil inside a ring lettered with the angel's psalm verse. {psalm} is the psalm's number in the Latin Bible's numbering",
};
const TALISMAN_ALT_NUMBERED = /*i18n*/ {
  id: "A talisman of {name}, angel {number} of the 72, {hebrew}: the Rose Cross sigil, with the name in Hebrew as Lenain prints it, inside a ring lettered with a verse of Psalm {psalm} (Vulgate numbering) in Latin",
  comment:
    "Alt text as above, for one of the two angels named Lauviah, told apart by {number}, their place among the 72",
};
const TALISMAN_ALT_GENESIS = /*i18n*/ {
  id: "A talisman of {name}, {hebrew}: the Rose Cross sigil, with the name in Hebrew as Lenain prints it, inside a ring lettered with Genesis 1:1 in Latin",
  comment:
    "Alt text of the talisman of Jabamiah, the one angel whose verse is the Bible's first, not a psalm's",
};

/**
 * Whether an angel's talisman letters Genesis 1:1 rather than a psalm
 * (plan 096, decision 8): Jabamiah's.
 */
export const angelSigilGenesis = (angel: Angel) =>
  ANGEL_SIGIL_GENESIS_VERSE.includes(angelSlug(angel.no) as AngelSigilSlug);

/**
 * A style's alt text message for an angel: numbered where the name is
 * shared, and for the talisman naming its psalm only (plan 096, decision
 * for Gadi 12), since Lenain's verse numbers are often not the Vulgate's.
 * The rose's is plan 088's.
 */
export function angelSigilStyleAltMessage(
  angel: Angel,
  style: AngelSigilStyle,
): string {
  const shared = angelNameShared(angel.no);
  switch (style) {
    case "rose":
      return angelSigilAltMessage(angel);
    case "band":
      return (shared ? BAND_ALT_NUMBERED : BAND_ALT).id;
    case "bare":
      return (shared ? BARE_ALT_NUMBERED : BARE_ALT).id;
    case "talisman":
      if (angelSigilGenesis(angel)) {
        if (shared) throw new Error(`angel ${angel.no}: a shared Genesis name`);
        return TALISMAN_ALT_GENESIS.id;
      }
      return (shared ? TALISMAN_ALT_NUMBERED : TALISMAN_ALT).id;
  }
}

/**
 * Where the psalm Lenain names is not the one the verse is from, by the
 * genius's number: the 33rd's verse is the Vulgate's 93:11, which he cites
 * as Psalm 33 (`lenain/vulgate/differences.json5`). Written out, so that
 * the client pages need no verse file; a test holds every angel's psalm
 * to the Vulgate's reference in `verses.json5`, so a new mismatch fails.
 */
const VULGATE_PSALM: Readonly<Record<number, number>> = { 33: 93 };

/**
 * The psalm an angel's verse is from, in the Vulgate's numbering, as the
 * talisman's alt text and caption name it (plan 096, decision for Gadi
 * 12): Lenain's number except where his is wrong. 0 for Jabamiah, whose
 * verse is Genesis 1:1.
 */
export const angelSigilPsalm = (angel: Angel): number =>
  VULGATE_PSALM[angel.no] ?? angel.psalm.psalm;

/** The values every style's alt text may name. */
export const angelSigilStyleAltValues = (angel: Angel) => ({
  name: angel.name.en,
  number: angel.no,
  hebrew: angelSigilText(angel),
  psalm: angelSigilPsalm(angel),
});

/** One style as the angel page offers it: its files and its alt text. */
export interface AngelSigilStyleEntry extends AngelSigilFiles {
  style: AngelSigilStyle;
  /** The alt text's message, translated where the image is shown. */
  alt: string;
}

/**
 * What the angel page's sigil section needs (plan 096, "The angel page"),
 * plain values only, so the server hands the client component no data
 * module: every style in the menu's order, the band first.
 */
export interface AngelSigilSection {
  /** The angel's name in English: "Vehuiah". */
  name: string;
  /** Its number, 1 to 72. */
  number: number;
  /** The text the sigil traces: "והויה". */
  hebrew: string;
  /**
   * The psalm the talisman's verse is from, in the Vulgate's numbering, 0
   * for Jabamiah's Genesis.
   */
  psalm: number;
  /** Whether the talisman letters Genesis 1:1 (Jabamiah). */
  genesis: boolean;
  /** The generator with the name in it. */
  generatorHref: string;
  styles: AngelSigilStyleEntry[];
}

/** An angel's sigil section, every style's files and alt text. */
export function angelSigilSection(angel: Angel): AngelSigilSection {
  return {
    name: angel.name.en,
    number: angel.no,
    hebrew: angelSigilText(angel),
    psalm: angelSigilPsalm(angel),
    genesis: angelSigilGenesis(angel),
    generatorHref: angelSigilGeneratorHref(angel),
    styles: ANGEL_SIGIL_STYLES.map((style) => ({
      style,
      ...angelSigilStyleFiles(angel, style),
      alt: angelSigilStyleAltMessage(angel, style),
    })),
  };
}
