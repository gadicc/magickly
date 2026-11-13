/**
 * Types for the two dependencies that ship none (plan 080, decision 7),
 * covering only what this package calls. Nothing exported names them, so
 * a consumer's type check never reads this file.
 */

declare module "lune" {
  /** The Moon at `date` (now when omitted), from lune 0.4's `phase()`. */
  export function phase(date?: Date): {
    /** Its phase, 0 to 1: new at 0, full at 0.5. */
    phase: number;
    /** The fraction of its disc lit, 0 to 1. */
    illuminated: number;
    /** Its age in days since the new moon. */
    age: number;
    /** Its distance in kilometres. */
    distance: number;
    /** Its angular diameter in degrees. */
    angular_diameter: number;
    /** The Sun's distance in kilometres. */
    sun_distance: number;
    /** The Sun's angular diameter in degrees. */
    sun_angular_diameter: number;
  };
  const lune: { phase: typeof phase };
  export default lune;
}

declare module "nlopt-js" {
  /**
   * The Emscripten module; roseSigilGeometry types the part it uses where
   * it loads it, after `ready` has attached the classes.
   */
  const nlopt: unknown;
  export default nlopt;
}
