import rows from "../dist/astrology/planets.json";
import type { Links, Raw } from "../types";

/** Every key of the table, the three spheres of the Tree included. */
type PlanetKey = keyof typeof rows;

/**
 * The planets, as against the three spheres of the Tree the table also holds:
 * `primum-mobile`, `zodiac` and `olam-yesodot`, which the sephirot point at
 * through `planetId` but which have a name and nothing else. Which a row is,
 * it now says itself, in `kind` (plan 032, decision 14).
 *
 * The twelve are nonetheless written out here, because a JSON import widens
 * `"planet"` to `string`: no literal type can be read back off the field, so
 * `kind` cannot do this half of the work. `satisfies` checks every member
 * against the table's keys, and [the integrity check](../integrity.ts)
 * asserts the other direction — that these are exactly the rows of kind
 * `"planet"` — so the list and the data cannot drift apart.
 */
const PLANET_IDS = [
  "sol",
  "mercury",
  "venus",
  "earth",
  "luna",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "rahu",
  "ketu",
] as const satisfies readonly PlanetKey[];

/** A planet's key: one of the twelve above, never one of the three spheres. */
type PlanetId = (typeof PLANET_IDS)[number];

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Planet = Raw<"planet"> & Partial<Links<"*", "planet">>;

/** Every row of the table, by key, spheres included. */
type Planets = Record<PlanetKey, Planet>;

export type { Planet, PlanetId, PlanetKey, Planets };
export { PLANET_IDS };
export default rows;
