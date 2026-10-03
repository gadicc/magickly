import rows from "../../dist/astrology/planets.js";
import type { Links, Raw } from "../types";

/** Every key of the table, the three spheres of the Tree included. */
type PlanetKey = keyof typeof rows;

/**
 * A planet's key: one of the twelve, never one of the three spheres of the
 * Tree the table also holds — `primum-mobile`, `zodiac` and `olam-yesodot`,
 * which the sephirot point at through `planetId` but which have a name and
 * nothing else. Which a row is, it says itself, in `kind` (plan 032,
 * decision 14), and the generated declaration states that field as each
 * row's literal, because its schema is a picklist (plan 052, decision 7).
 * So the twelve are read off the data rather than written out, and there is
 * no list to drift from it.
 */
type PlanetId = {
  [K in PlanetKey]: (typeof rows)[K]["kind"] extends "planet" ? K : never;
}[PlanetKey];

/** The twelve, at runtime, in the table's order. */
const PLANET_IDS: readonly PlanetId[] = (
  Object.keys(rows) as PlanetKey[]
).filter((id): id is PlanetId => rows[id].kind === "planet");

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
