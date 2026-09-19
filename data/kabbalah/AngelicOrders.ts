import rows from "../dist/kabbalah/angelicOrders.json";
import type { Links, Raw } from "../types";

/** An order's key. */
type AngelicOrderId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type AngelicOrder = Raw<"angelicOrder"> & Partial<Links<"*", "angelicOrder">>;

/** Every angelic order, by key. */
type AngelicOrders = Record<AngelicOrderId, AngelicOrder>;

export type { AngelicOrder, AngelicOrderId, AngelicOrders };
export default rows;
