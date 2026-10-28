import enochianFont from "@magick-components/enochian/enochianFont";
import {
  defaultHallArt,
  type HallArtRegistry,
  tabletArt,
} from "@magick-components/gd/hall";

/**
 * The app's hall art (plan 061, decision 1): the MIT package's art, all
 * of it original since stage H, with the Enochian tablets given the app's
 * Enochian font. The reader block, the editor and `/gd/halls` draw with
 * this; every entry declares its provenance, and `art.test.tsx` holds the
 * third-party list, which stage H emptied.
 */
export const gdHallArt: HallArtRegistry = new Map([
  ...defaultHallArt,
  ["tablet", tabletArt(enochianFont.style)],
]);
