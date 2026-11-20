import rows from "../../dist/astrology/planetaryNameCharacters.js";
import type { Links, Raw } from "../types.ts";

/** A character's key: the name's id and the witness's, `agiel-agrippa1533`. */
type PlanetaryNameCharacterId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type. It
 * is one of Agrippa's characters of a planetary name, as his 1533 printing
 * or Regardie's 1940 redrawing gives it, with our verdict on whether it is
 * the name traced on its planet's square.
 */
type PlanetaryNameCharacter = Raw<"planetaryNameCharacter"> &
  Partial<Links<"*", "planetaryNameCharacter">>;

/** Every character, by key. */
type PlanetaryNameCharacters = Record<
  PlanetaryNameCharacterId,
  PlanetaryNameCharacter
>;

export type {
  PlanetaryNameCharacter,
  PlanetaryNameCharacterId,
  PlanetaryNameCharacters,
};
export default rows;
