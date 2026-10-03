import rows from "../../dist/body/parts.js";
import type { Links, Raw } from "../types.ts";

/** A part of the body's key, as the sephirot are laid on it. */
type BodyPartId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type BodyPart = Raw<"bodyPart"> & Partial<Links<"*", "bodyPart">>;

/** Every part of the body, by key. */
type BodyParts = Record<BodyPartId, BodyPart>;

export type { BodyPart, BodyPartId, BodyParts };
export default rows;
