import type { HallArtRegistry } from "../types";
import { altarArt } from "./altar";
import { breadArt, fanArt, roseArt, saltArt } from "./altarItems";
import { bannerArt } from "./banner";
import { boardArt } from "./board";
import { cardArt } from "./cards";
import { brazierArt, candleArt, gongArt } from "./furnishings";
import { hebrewLetterArt } from "./hebrewLetter";
import { crossArt, pentagramArt, triangleArt } from "./items";
import { kameaArt, sealArt } from "./kamea";
import { lamenArt } from "./lamen";
import { lightningArt } from "./lightning";
import { lampArt, lanternArt } from "./lights";
import { markerArt } from "./marker";
import { pantacleArt } from "./pantacle";
import { pillarArt } from "./pillar";
import { platformArt, throneArt } from "./platform";
import { candlestickArt, shewbreadArt, tabletArt } from "./symbols";
import { tarotKeyArt } from "./tarotKey";
import { veilArt } from "./veil";
import { censerArt, chaliceArt, cupArt } from "./vessels";

/**
 * The package's own art, all original (MIT). The app composes its art over
 * this — `new Map([...defaultHallArt, ["tablet", tabletArt(font)]])` — and
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
  ["lamen", lamenArt],
  ["item:cross", crossArt],
  ["item:triangle", triangleArt],
  ["item:pentagram", pentagramArt],
  ["item:pantacle", pantacleArt],
  ["item:lightning", lightningArt],
  ["item:gong", gongArt],
  ["item:brazier", brazierArt],
  ["item:candle", candleArt],
  ["item:cup", cupArt],
  ["item:chalice", chaliceArt],
  ["item:censer", censerArt],
  ["item:lamp", lampArt],
  ["item:lantern", lanternArt],
  ["item:rose", roseArt],
  ["item:salt", saltArt],
  ["item:bread", breadArt],
  ["item:fan", fanArt],
  ["tarotKey", tarotKeyArt],
  ["card", cardArt],
  ["tablet", tabletArt()],
  ["shewbread", shewbreadArt],
  ["candlestick", candlestickArt],
  ["veil", veilArt],
  ["kamea", kameaArt],
  ["seal", sealArt],
]);
