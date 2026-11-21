import rows from "../../dist/astrology/planetaryNameExceptions.js";
import type { Links, Raw } from "../types.ts";

/** An exception's key: the name's id and the witness's, `kedemel-agrippa1533`. */
type PlanetaryNameExceptionId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type. It
 * is a number a witness prints beside a planetary name that is not the sum
 * of the Hebrew it prints, with whose the difference is.
 */
type PlanetaryNameException = Raw<"planetaryNameException"> &
  Partial<Links<"*", "planetaryNameException">>;

/** Every exception, by key. */
type PlanetaryNameExceptions = Record<
  PlanetaryNameExceptionId,
  PlanetaryNameException
>;

export type {
  PlanetaryNameException,
  PlanetaryNameExceptionId,
  PlanetaryNameExceptions,
};
export default rows;
