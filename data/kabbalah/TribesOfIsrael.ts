import rows from "../dist/kabbalah/tribesOfIsrael.json";
import type { Links, Raw } from "../types";

/** A tribe's key, Ephraim and Manasseh included. */
type TribeOfIsraelId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type TribeOfIsrael = Raw<"tribeOfIsrael"> &
  Partial<Links<"*", "tribeOfIsrael">>;

/** Every tribe, by key. */
type TribesOfIsrael = Record<TribeOfIsraelId, TribeOfIsrael>;

export type { TribeOfIsrael, TribeOfIsraelId, TribesOfIsrael };
export default rows;
