import type { KameaPlanetId } from "magick-data/astrology/kameas";

/**
 * The planets a hall's `kamea(planet)` and `seal(planet)` name (plan 061,
 * decision 5), in the Chaldean order. These are the hall's own words,
 * which saved halls hold, so they stay "sun" and "moon"; the squares
 * themselves are magick-data's, under its planet ids (`HALL_KAMEA_PLANET_IDS`).
 */
export const HALL_PLANETS = [
  "saturn",
  "jupiter",
  "mars",
  "sun",
  "venus",
  "mercury",
  "moon",
] as const;
export type HallPlanet = (typeof HALL_PLANETS)[number];

/** Each planet as the Order's diagrams name it ("Kamea of Luna"). */
export const HALL_PLANET_NAMES: ReadonlyMap<HallPlanet, string> = new Map([
  ["saturn", "Saturn"],
  ["jupiter", "Jupiter"],
  ["mars", "Mars"],
  ["sun", "Sol"],
  ["venus", "Venus"],
  ["mercury", "Mercury"],
  ["moon", "Luna"],
]);

/** Each hall planet's id in magick-data's planet table. */
export const HALL_KAMEA_PLANET_IDS: ReadonlyMap<HallPlanet, KameaPlanetId> =
  new Map([
    ["saturn", "saturn"],
    ["jupiter", "jupiter"],
    ["mars", "mars"],
    ["sun", "sol"],
    ["venus", "venus"],
    ["mercury", "mercury"],
    ["moon", "luna"],
  ]);
