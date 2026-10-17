import {
  defaultHallArt,
  type HallArtRegistry,
} from "@magick-components/gd/hall";
import { lamenArt } from "./lamenArt";
import { legacyHallArt } from "./legacyArt";

/**
 * The app's hall art (plan 061, decision 1): the MIT package's original art
 * with the art the app may not put under MIT composed over it — `Lamen`
 * and the items lifted from the old drawings. The reader block, the editor
 * and `/gd/hall` draw with this; every entry declares its provenance, and
 * `art.test.tsx` holds the third-party list that stage H brings to zero.
 */
export const gdHallArt: HallArtRegistry = new Map([
  ...defaultHallArt,
  ["lamen", lamenArt],
  ...legacyHallArt,
]);
