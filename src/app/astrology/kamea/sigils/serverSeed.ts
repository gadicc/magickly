import {
  type KameaSigilFigure,
  kameaSigil,
} from "magick-components/astrology/KameaSigil";
import {
  DEFAULT_KAMEA_SIGIL,
  type KameaSigilState,
  kameaSigilKey,
} from "./kameaSigilState";
import { kameaSigilNames } from "./names";

/**
 * The names-list spellings placement's search does not clear by itself:
 * Barrett's run-together Malcha, which only the seeded fallback clears
 * (1.4 and 1.9 s), and 777's Malcha with finals, the listed failure (about
 * 4 s, drawn best effort). A test holds this list to what placement does,
 * so a new name that needs the fallback fails until it is added.
 */
export const NAMES_NEEDING_FALLBACK: ReadonlySet<string> = new Set([
  kameaSigilKey("luna", "מלכאבתרשיסים עד ברוהשהקים", false),
  kameaSigilKey("luna", "מלכאבתרשיסים עד ברוהשהקים", true),
  kameaSigilKey("luna", "מלכא בתרשישים ועד ברוח שחקים", true),
]);

/**
 * The figure the server draws into the generator's HTML, as `/gd/sigils`
 * draws its rose: for the default, and for a name from the planet's list
 * that placement's search clears (at most about half a second, the
 * Moon's Malcha, and that once per server, since placement keeps what it
 * placed). Anything else, a shared text the server cannot bound, is left
 * to the reader's browser: null.
 */
export function serverSeed(state: KameaSigilState): KameaSigilFigure | null {
  const { planet, text, finals } = state;
  const key = kameaSigilKey(planet, text, finals);
  const listed =
    key ===
      kameaSigilKey(
        DEFAULT_KAMEA_SIGIL.planet,
        DEFAULT_KAMEA_SIGIL.text,
        DEFAULT_KAMEA_SIGIL.finals,
      ) ||
    (!NAMES_NEEDING_FALLBACK.has(key) &&
      kameaSigilNames(planet).some((name) => name.he === text));
  return listed ? kameaSigil(planet, text, { finals }) : null;
}
