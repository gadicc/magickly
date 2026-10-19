import type { HallArtRegistry } from "../types";
import { altarArt } from "./altar";
import { bannerArt } from "./banner";
import { hebrewLetterArt } from "./hebrewLetter";
import { crossArt, pentagramArt, triangleArt } from "./items";
import { kameaArt, sealArt } from "./kamea";
import { lamenFallbackArt } from "./lamen";
import { lightningArt } from "./lightning";
import { markerArt } from "./marker";
import { pantacleArt } from "./pantacle";
import { pillarArt } from "./pillar";
import { boardArt, platformArt, throneArt } from "./platform";
import { candlestickArt, shewbreadArt, tabletArt } from "./symbols";
import { tarotKeyArt } from "./tarotKey";

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
  ["item:pantacle", pantacleArt],
  ["item:lightning", lightningArt],
  ["tarotKey", tarotKeyArt],
  ["tablet", tabletArt()],
  ["shewbread", shewbreadArt],
  ["candlestick", candlestickArt],
  ["kamea", kameaArt],
  ["seal", sealArt],
]);
