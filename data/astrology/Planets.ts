import rows from "../dist/astrology/planets.json";
import type { Links, Raw } from "../types";

/** Every key of the table, the three spheres of the Tree included. */
type PlanetKey = keyof typeof rows;

/**
 * A planet's key. The table also holds `primum-mobile`, `zodiac` and
 * `olam-yesodot`, which the sephirot point at through `planetId` but which
 * are spheres of the Tree rather than planets: they have a name and nothing
 * else, no symbol among it. Derived from that, so a row joins by carrying
 * one, rather than from a list that would drift.
 */
type PlanetId = {
  [K in PlanetKey]: (typeof rows)[K] extends { symbol: string } ? K : never;
}[PlanetKey];

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Planet = Raw<"planet"> & Partial<Links<"*", "planet">>;

/** Every row of the table, by key, spheres included. */
type Planets = Record<PlanetKey, Planet>;

export type { Planet, PlanetId, PlanetKey, Planets };
export default rows;
