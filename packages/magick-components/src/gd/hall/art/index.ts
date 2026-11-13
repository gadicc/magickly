import type { HallArtRegistry } from "../types.ts";
import { altarArt } from "./altar.tsx";
import { breadArt, fanArt, roseArt, saltArt } from "./altarItems.tsx";
import { bannerArt } from "./banner.tsx";
import { boardArt } from "./board.tsx";
import { cardArt } from "./cards.tsx";
import { brazierArt, candleArt, gongArt } from "./furnishings.tsx";
import { hebrewLetterArt } from "./hebrewLetter.tsx";
import { crossArt, pentagramArt, triangleArt } from "./items.tsx";
import { kameaArt, sealArt } from "./kamea.tsx";
import { lamenArt } from "./lamen.tsx";
import { lightningArt } from "./lightning.tsx";
import { lampArt, lanternArt } from "./lights.tsx";
import { markerArt } from "./marker.tsx";
import { pantacleArt } from "./pantacle.tsx";
import { pillarArt } from "./pillar.tsx";
import { platformArt, throneArt } from "./platform.tsx";
import { candlestickArt, shewbreadArt, tabletArt } from "./symbols.tsx";
import { tarotKeyArt } from "./tarotKey.tsx";
import { veilArt } from "./veil.tsx";
import { censerArt, chaliceArt, cupArt } from "./vessels.tsx";

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
