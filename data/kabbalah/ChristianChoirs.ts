import _christianChoirs from "./christianChoirs.json5" with { type: "json" };

type ChristianChoirId =
  | "seraphim"
  | "cherubim"
  | "thrones"
  | "dominations"
  | "powers"
  | "virtues"
  | "principalities"
  | "archangels"
  | "angels";

interface ChristianChoir {
  id: ChristianChoirId;
  name: { en: string; fr: string };
}

/** In Lenain's order, so that the nth choir is at index n - 1. */
type ChristianChoirs = ChristianChoir[];

const christianChoirs: ChristianChoirs = _christianChoirs as ChristianChoirs;

export type { ChristianChoir, ChristianChoirId, ChristianChoirs };
export default christianChoirs;
