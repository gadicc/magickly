import { hallPreset } from "magick-components/gd/hall/presets";
import { GD_HALLS, type GdHallEntry } from "@/render/contracts/gdHall";
import {
  KAMEA_PLANET_ENGLISH,
  KAMEA_PLANETS,
  type KameaPlanetId,
} from "./kameaPlanets";

/**
 * The temple halls and the kameas they draw (plan 093, "Pages" and K4's
 * "hall links"), read off the halls' presets, so that a hall that gains a
 * square links its page, and its page the hall, without either changing.
 */

/**
 * A hall's planet as its preset names it ("sun", "moon": the hall's own
 * words, plan 061, decision 5) and the planet's id in magick-data's table,
 * as magick-components' `HALL_KAMEA_PLANET_IDS` gives them.
 */
const HALL_PLANET_IDS: Readonly<Record<string, KameaPlanetId>> = {
  saturn: "saturn",
  jupiter: "jupiter",
  mars: "mars",
  sun: "sol",
  venus: "venus",
  mercury: "mercury",
  moon: "luna",
};

/** The kameas a hall draws, in the Chaldean order, each once. */
export function kameasInHall(hall: GdHallEntry): KameaPlanetId[] {
  const found = new Set<KameaPlanetId>();
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const { type, planet, children } = node as {
      type?: string;
      planet?: string;
      children?: unknown[];
    };
    if (type === "kamea" && planet && Object.hasOwn(HALL_PLANET_IDS, planet))
      found.add(HALL_PLANET_IDS[planet]);
    if (Array.isArray(children)) children.forEach(visit);
  };
  visit(hallPreset(hall.preset)?.hall);
  return KAMEA_PLANETS.filter((planet) => found.has(planet));
}

/**
 * The temple halls that draw a planet's square (plan 093, "Pages":
 * Theoricus' Moon, Philosophus' Venus), in the halls' order.
 */
export const hallsDrawing = (planet: KameaPlanetId) =>
  GD_HALLS.filter((hall) => kameasInHall(hall).includes(planet));

/**
 * The square a hall's station names, by the words the hall's description
 * gives it ("kamea of the Moon", magick-components' `describeHall`), if
 * the hall draws that square; otherwise undefined. The hall's page links
 * the station to the square's page by it.
 */
export function kameaOfStation(
  hall: GdHallEntry,
  station: string,
): KameaPlanetId | undefined {
  return kameasInHall(hall).find(
    (planet) => station === `kamea of ${KAMEA_PLANET_ENGLISH[planet]}`,
  );
}
