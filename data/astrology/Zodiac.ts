import rows from "../dist/astrology/zodiac.json";
import type { Links, Raw } from "../types";

/** A sign's key. */
type ZodiacId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type Zodiac = Raw<"zodiac"> & Partial<Links<"*", "zodiac">>;

/** Every sign, by key. */
type Zodiacs = Record<ZodiacId, Zodiac>;

export type { Zodiac, ZodiacId, Zodiacs };
export default rows;
