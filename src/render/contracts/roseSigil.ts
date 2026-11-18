import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
  DIMENSION_LIMITS,
  type ImageDimensions,
  invalid,
  parseDimensions,
} from "./types";

/** One word's viewBox: the rose, centred on the origin. */
export const SIGIL_VIEWBOX = [-50, -50, 100, 100] as const;
/**
 * Each word is its own sigil, the next one a rose's width to the left
 * (plan 088, R2 and decision 5): the package's `sigilFrame` pitch on the
 * rose, written out so that the contracts do not pull in the geometry; a
 * test holds the two equal.
 */
export const SIGIL_WORD_PITCH = 100;
/** Letters on the rose. Final forms are folded onto these before lookup. */
export const SIGIL_LETTERS = "אבגדהוזחטיכלמנסעפצקרשת";
/** Rose letters in the whole text, every word's together. */
export const SIGIL_MAX_LETTERS = 32;
const FINAL_FORMS: Record<string, string> = {
  ך: "כ",
  ם: "מ",
  ן: "נ",
  ף: "פ",
  ץ: "צ",
};

/** Each letter with a final form, with that form. */
const TO_FINAL: Record<string, string> = Object.fromEntries(
  Object.entries(FINAL_FORMS).map(([final, medial]) => [medial, final]),
);

/**
 * Final forms folded onto the letters the rose has (ך to כ and so on),
 * for checking and drawing: a final letter is traced at its ordinary
 * form's place.
 */
export function foldFinalForms(text: string): string {
  return text.replace(/[ךםןףץ]/g, (letter) => FINAL_FORMS[letter]);
}

/**
 * A word as Hebrew spells it: a final form at its end and nowhere else,
 * whichever form it was typed with. A one-letter word keeps its ordinary
 * form.
 */
function spelledWord(word: string): string {
  const folded = foldFinalForms(word);
  const letters = [...folded];
  const last = letters.at(-1) ?? "";
  if (letters.length < 2 || !TO_FINAL[last]) return folded;
  return letters.slice(0, -1).join("") + TO_FINAL[last];
}

/**
 * The viewBox of a sigil of `words` words, side by side from right to
 * left: the first word on the rose's own coordinates, each later one a
 * pitch to its left.
 */
export function sigilViewBox(
  words: number,
): readonly [number, number, number, number] {
  if (words <= 1) return SIGIL_VIEWBOX;
  const [x, y, width, height] = SIGIL_VIEWBOX;
  return [
    x - (words - 1) * SIGIL_WORD_PITCH,
    y,
    width + (words - 1) * SIGIL_WORD_PITCH,
    height,
  ];
}

/** How many words (sigils) a canonical sigil text draws. */
export const sigilWordCount = (text: string) => text.split(" ").length;

/**
 * The PNG size when the request names neither axis: 1,024 pixels a
 * word's square, the row of words scaled down to fit the route's 4,096
 * pixels a side.
 */
export function sigilRasterDefault(words: number): {
  width: number;
  height: number;
} {
  const width = 1024 * Math.max(1, words);
  if (width <= DIMENSION_LIMITS.axis) return { width, height: 1024 };
  return {
    width: DIMENSION_LIMITS.axis,
    height: Math.round((DIMENSION_LIMITS.axis * 1024) / width),
  };
}

/**
 * The roses a sigil is traced on, the Golden Dawn's (`gd`) first and by
 * default: the package's `ROSE_VERSIONS`, written out so that the
 * contracts do not pull in the geometry; a test holds the two equal.
 */
export const ROSE_IMAGE_VERSIONS = ["gd", "regardie1939"] as const;

export interface RoseSigilProps extends ImageDimensions {
  /**
   * Rose letters, at least one and at most SIGIL_MAX_LETTERS in all,
   * spelled with final forms at the ends of words (`canonicalSigilText`),
   * in words separated by single spaces (R2), with no space at either end.
   */
  text: string;
  rose: boolean;
  /**
   * Which rose: the Golden Dawn's when absent, as for a link made before
   * the versions.
   */
  version?: (typeof ROSE_IMAGE_VERSIONS)[number];
}

/**
 * A text as the contract keeps it: whitespace (JavaScript's `\s`, as the
 * planner splits on) collapsed to single spaces and trimmed, and each
 * word spelled with a final form at its end and nowhere else, so that
 * מטטרון and מטטרונ are one sigil and one link, shown as Hebrew writes it;
 * or `null` when it holds anything but rose letters, their final forms and
 * whitespace, no letter, or more than SIGIL_MAX_LETTERS letters.
 */
export function canonicalSigilText(raw: string): string | null {
  const words = foldFinalForms(raw).trim().split(/\s+/);
  let letters = 0;
  for (const character of words.join("")) {
    if (!SIGIL_LETTERS.includes(character)) return null;
    letters++;
  }
  return letters >= 1 && letters <= SIGIL_MAX_LETTERS
    ? words.map(spelledWord).join(" ")
    : null;
}

/**
 * Sigil text is the user's own intent. Links are only created on explicit
 * request and responses are never indexed; the parser accepts final forms
 * and any whitespace between words, and canonicalises them so equivalent
 * spellings share one representation.
 */
export const roseSigil: ComponentImageContract<RoseSigilProps> = {
  slug: "rose-sigil",
  viewBox: SIGIL_VIEWBOX,
  viewBoxOf: (props) => sigilViewBox(sigilWordCount(props.text)),
  rasterDefault: { width: 1024, height: 1024 },
  rasterDefaultOf: (props) => sigilRasterDefault(sigilWordCount(props.text)),
  keys: ["text", "rose", "version"],
  personal: true,
  parse(searchParams) {
    const text = canonicalSigilText(searchParams.get("text") ?? "");
    if (text === null) invalid();
    return {
      text,
      rose:
        choice(searchParams.get("rose") ?? "true", ["true", "false"]) ===
        "true",
      version: choice(searchParams.get("version") || "gd", ROSE_IMAGE_VERSIONS),
      ...parseDimensions(searchParams, sigilViewBox(sigilWordCount(text))),
    };
  },
  canonicalize(props) {
    const pairs: Array<[string, string]> = [["text", props.text]];
    if (!props.rose) pairs.push(["rose", "false"]);
    if (props.version && props.version !== "gd")
      pairs.push(["version", props.version]);
    return [...pairs, ...canonicalDimensions(props)];
  },
  filename: (props) =>
    `rose-sigil-${props.text.replaceAll(" ", "-")}${props.version && props.version !== "gd" ? `-${props.version}` : ""}`,
};
