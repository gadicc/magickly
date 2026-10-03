/**
 * The helpers, under one subpath: `magick-data/tools` (plan 052,
 * decision 5). Each also keeps a subpath of its own.
 *
 * `pathTarget` imports every table, and is here anyway: both bundlers drop
 * it, and the tables with it, from a `tools` import that does not use it.
 */
export {
  accessorName,
  assemble,
  type Problem,
  problemsOf,
} from "./assemble.ts";
export { type PathTarget, pathTarget } from "./pathTarget.ts";
export { rowOf } from "./rowOf.ts";
