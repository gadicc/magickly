import rows from "../../dist/gd/godForms.js";
import type { Links, Raw } from "../types.ts";

/** A god's key: the name in lower case (`osiris`). */
type GDGodFormId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type. It
 * is one of the fifteen gods the Golden Dawn gives a mix of elements on a
 * servient square's four sides (Regardie, The Golden Dawn, vol. 4, 1940,
 * p.315), with its Coptic name and Neophyte station.
 */
type GDGodForm = Raw<"gdGodForm"> & Partial<Links<"*", "gdGodForm">>;

/** Every god, by key. */
type GDGodForms = Record<GDGodFormId, GDGodForm>;

export type { GDGodForm, GDGodFormId, GDGodForms };
export default rows;
