import type { HallArtRegistry } from "../types";
import { altarArt } from "./altar";
import { bannerArt } from "./banner";
import { hebrewLetterArt } from "./hebrewLetter";
import { crossArt, pentagramArt, triangleArt } from "./items";
import { lamenFallbackArt } from "./lamen";
import { markerArt } from "./marker";
import { pillarArt } from "./pillar";
import { boardArt, platformArt, throneArt } from "./platform";

/**
 * The package's own art, all original (MIT). The app composes its art over
 * this — `new Map([...defaultHallArt, ["lamen", lamenArt], …])` — and
 * anything still missing draws as a placeholder.
 */
export const defaultHallArt: HallArtRegistry = new Map([
  ["altar", altarArt],
  ["platform", platformArt],
  ["throne", throneArt],
  ["board", boardArt],
  ["pillar", pillarArt],
  ["banner", bannerArt],
  ["hebrewLetter", hebrewLetterArt],
  ["marker", markerArt],
  ["lamen", lamenFallbackArt],
  ["item:cross", crossArt],
  ["item:triangle", triangleArt],
  ["item:pentagram", pentagramArt],
]);
