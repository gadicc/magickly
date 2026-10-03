import rows from "../../dist/kabbalah/souls.js";
import type { Links, Raw } from "../types.ts";

/** A part of the soul's key: yechidah to guph. */
type SoulId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Soul = Raw<"soul"> & Partial<Links<"*", "soul">>;

/** Every part of the soul, by key. */
type Souls = Record<SoulId, Soul>;

export type { Soul, SoulId, Souls };
export default rows;
