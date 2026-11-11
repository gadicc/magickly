import type { Planet } from "magick-data/astrology/planets";

/**
 * A planet's name as readers search for it: "Sun (Sol)" where the row has a
 * `commonName`, its own name, "Mercury", where it does not. For the planet
 * page's heading and title and the planets list.
 */
export function planetName(planet: Pick<Planet, "commonName" | "name">) {
  const name = planet.name.en.en;
  return planet.commonName ? `${planet.commonName} (${name})` : name;
}
