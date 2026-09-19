import _houses from "./houses.json5" with { type: "json" };

type LangObject = { en: string };

/** A house of a reading, keyed by its own number rather than an index. */
type HouseId =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12";

interface House {
  id: number;
  meaning: LangObject;
}

type Houses = Record<HouseId, House>;

const houses: Houses = _houses as Houses;

export type { House, HouseId, Houses };
export default houses;
