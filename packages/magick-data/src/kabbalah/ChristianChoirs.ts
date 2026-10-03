import rows from "../../dist/kabbalah/christianChoirs.js";
import type { Links, Raw } from "../types.ts";

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type ChristianChoir = Raw<"christianChoir"> &
  Partial<Links<"*", "christianChoir">>;

/** In Lenain's order, so that the nth choir is at index n - 1. */
type ChristianChoirs = readonly ChristianChoir[];

export type { ChristianChoir, ChristianChoirs };
export default rows;
