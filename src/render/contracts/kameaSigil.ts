import { type KameaImagePlanet, kameaPlanet } from "./kamea";
import { sigilRasterDefault, sigilViewBox, sigilWordCount } from "./roseSigil";
import {
  type ComponentImageContract,
  canonicalDimensions,
  choice,
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
}

/**
 * A name's sigil traced on its planet's kamea (plan 093, decision 9): the
 * square under each word's figure, the words in one row from right to
 * left, a square's width apart, as the rose sigil's words are, so the
 * rose's viewBox and raster default serve. Sigil text is the user's own,
 * as the rose's is: personal, and never indexed (the reference pages, K4,
 * publish the names' sigils as their own static files). A text placement
 * cannot draw with every mark clear is drawn best effort; the route says
 * so with `X-Sigil-Placement: failed` (`registry.tsx`), since the image
 * itself is the same kind of file either way.
 */
export const kameaSigil: ComponentImageContract<KameaSigilImageProps> = {
  slug: "kamea-sigil",
  viewBox: sigilViewBox(1),
  viewBoxOf: (props) => sigilViewBox(sigilWordCount(props.text)),
  rasterDefault: { width: 1024, height: 1024 },
  rasterDefaultOf: (props) => sigilRasterDefault(sigilWordCount(props.text)),
  keys: ["planet", "text", "finals"],
  personal: true,
  indexed: false,
  parse(searchParams) {
    const planet = kameaPlanet(searchParams);
    const text = canonicalKameaSigilText(searchParams.get("text") ?? "");
    if (text === null) invalid();
    return {
      planet,
      text,
      finals:
        choice(searchParams.get("finals") ?? "false", ["true", "false"]) ===
        "true",
      ...parseDimensions(searchParams, sigilViewBox(sigilWordCount(text))),
    };
  },
  canonicalize(props) {
    const pairs: Array<[string, string]> = [
      ["planet", props.planet],
      ["text", props.text],
    ];
    if (props.finals) pairs.push(["finals", "true"]);
    return [...pairs, ...canonicalDimensions(props)];
  },
  filename: (props) =>
    `kamea-sigil-${props.planet}-${props.text.replaceAll(" ", "-")}${props.finals ? "-finals" : ""}`,
};
