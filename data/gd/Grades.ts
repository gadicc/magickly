import rows from "../dist/gd/grades.json";
import type { Links, Raw } from "../types";

/** A grade's key, Portal included. */
type GDGradeId = keyof typeof rows;

/**
 * A row, which may carry the links `assemble()` makes: the barrel's rows have
 * them and a bare import's do not, and both are read through this type.
 */
type GDGrade = Raw<"gdGrade"> & Partial<Links<"*", "gdGrade">>;

/** Every grade, by key. */
type GDGrades = Record<GDGradeId, GDGrade>;

export type { GDGrade, GDGradeId, GDGrades };
export default rows;
