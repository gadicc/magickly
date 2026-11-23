import { type KameaImagePlanet, kameaPlanet } from "./kamea";
import { sigilRasterDefault, sigilViewBox, sigilWordCount } from "./roseSigil";
import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
  DIMENSION_LIMITS,
  type ImageDimensions,
  invalid,
  parseDimensions,
} from "./types";

/**
 * The 27 letters a name is traced in on a kamea, the five final forms
 * among them: with `finals` a final counts at Aiq Bekar's 500 to 900, so
 * the form is part of the name and is kept as typed.
 */
export const KAMEA_SIGIL_LETTERS = "אבגדהוזחטיכךלמםנןסעפףצץקרשת";

/**
 * Letters in the whole text, every word's together: the rose sigil's
 * bound, which also bounds placement's work (a word that fails costs
 * about a second a budget; `KAMEA_SIGIL_PROFILE` in magick-components).
 */
export const KAMEA_SIGIL_MAX_LETTERS = 32;

/**
 * A text as the contract keeps it: whitespace (JavaScript's `\s`, as the
 * planner splits on) collapsed to single spaces and trimmed, the letters
 * as typed; or `null` when it holds anything but the 27 letters and
 * whitespace, no letter, or more than KAMEA_SIGIL_MAX_LETTERS letters.
 * Unlike the rose's, final forms are not respelled: with `finals` set a
 * final letter is worth its own value, so מטטרונ and מטטרון are two
 * names.
 */
export function canonicalKameaSigilText(raw: string): string | null {
  const words = raw.trim().split(/\s+/);
  let letters = 0;
  for (const character of words.join("")) {
    if (!KAMEA_SIGIL_LETTERS.includes(character)) return null;
    letters++;
  }
  return letters >= 1 && letters <= KAMEA_SIGIL_MAX_LETTERS
    ? words.join(" ")
    : null;
}

export interface KameaSigilImageProps extends ImageDimensions {
  planet: KameaImagePlanet;
  /**
   * The 27 Hebrew letters, at least one and at most
   * KAMEA_SIGIL_MAX_LETTERS in all, in words separated by single spaces,
   * with no space at either end (`canonicalKameaSigilText`).
   */
  text: string;
  /** Count final forms at Aiq Bekar's 500 to 900 (plan 093, decision 3). */
  finals: boolean;
  /**
   * Words a row, for a text set in more than one row (a name page's
   * social card): at least one and fewer than the text's words. Absent,
   * the words run in one row, as the generator's download draws them.
   */
  columns?: number;
}

/**
 * The viewBox of `words` words set `columns` a row (all in one row when
 * `columns` is absent): the one row's viewBox, as wide as a full row and
 * a square's height for each row below the first.
 */
export function kameaSigilViewBox(
  words: number,
  columns?: number,
): readonly [number, number, number, number] {
  if (columns === undefined) return sigilViewBox(words);
  const [x, y, width, height] = sigilViewBox(columns);
  return [x, y, width, height * Math.ceil(words / columns)];
}

/**
 * The PNG size when the request names neither axis: 1,024 pixels a
 * square, scaled down to fit the route's limits on an axis and in all.
 */
function kameaSigilRasterDefault(
  words: number,
  columns?: number,
): { width: number; height: number } {
  if (columns === undefined) return sigilRasterDefault(words);
  const width = 1024 * columns;
  const height = 1024 * Math.ceil(words / columns);
  const scale = Math.min(
    1,
    DIMENSION_LIMITS.axis / width,
    DIMENSION_LIMITS.axis / height,
    Math.sqrt(DIMENSION_LIMITS.pixels / (width * height)),
  );
  return {
    width: Math.floor(width * scale),
    height: Math.floor(height * scale),
  };
}

/**
 * `columns` as a request gives it: a whole number of words a row, from
 * one to one fewer than the text's words (all of them is the default,
 * which the link leaves out); absent when not given.
 */
function parseColumns(value: string | null, words: number): number | undefined {
  if (value === null) return undefined;
  if (!/^[1-9]\d{0,1}$/.test(value)) invalid();
  const columns = Number(value);
  return columns < words ? columns : invalid();
}

/**
 * A name's sigil traced on its planet's kamea (plan 093, decision 9): the
 * square under each word's figure, the words in one row from right to
 * left, a square's width apart, as the rose sigil's words are, so the
 * rose's viewBox and raster default serve. `columns` sets a long name in
 * rows of that many words, the last row centred, for a card that cannot
 * show a long row at a readable size. Sigil text is the user's own,
 * as the rose's is: personal, and never indexed (the reference pages, K4,
 * publish the names' sigils as their own static files). A text placement
 * cannot draw with every mark clear is drawn best effort; the route says
 * so with `X-Sigil-Placement: failed` (`registry.tsx`), since the image
 * itself is the same kind of file either way.
 */
export const kameaSigil: ComponentImageContract<KameaSigilImageProps> = {
  slug: "kamea-sigil",
  viewBox: sigilViewBox(1),
  viewBoxOf: (props) =>
    kameaSigilViewBox(sigilWordCount(props.text), props.columns),
  rasterDefault: { width: 1024, height: 1024 },
  rasterDefaultOf: (props) =>
    kameaSigilRasterDefault(sigilWordCount(props.text), props.columns),
  keys: ["planet", "text", "finals", "columns"],
  personal: true,
  indexed: false,
  parse(searchParams) {
    const planet = kameaPlanet(searchParams);
    const text = canonicalKameaSigilText(searchParams.get("text") ?? "");
    if (text === null) invalid();
    const words = sigilWordCount(text);
    const columns = parseColumns(searchParams.get("columns"), words);
    return {
      planet,
      text,
      finals:
        choice(searchParams.get("finals") ?? "false", ["true", "false"]) ===
        "true",
      // Only when given, so that a one-row request's props are as before.
      ...(columns === undefined ? {} : { columns }),
      ...parseDimensions(searchParams, kameaSigilViewBox(words, columns)),
    };
  },
  canonicalize(props) {
    const pairs: Array<[string, string]> = [
      ["planet", props.planet],
      ["text", props.text],
    ];
    if (props.finals) pairs.push(["finals", "true"]);
    if (props.columns !== undefined)
      pairs.push(["columns", String(props.columns)]);
    return [...pairs, ...canonicalDimensions(props)];
  },
  filename: (props) =>
    `kamea-sigil-${props.planet}-${props.text.replaceAll(" ", "-")}${props.finals ? "-finals" : ""}`,
};
