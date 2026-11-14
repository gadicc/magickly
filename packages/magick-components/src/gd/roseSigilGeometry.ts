/**
 * The rose's letters and where a sigil's letters stand on it: what a page
 * needs to check a text or to draw the sigil with `RoseSigilImage`. The
 * rose has versions (`ROSE_VERSIONS`), which place Kaph and Tau
 * differently; each function takes one, and draws the default's
 * (`DEFAULT_ROSE_VERSION`, the Golden Dawn's) without it. The layout
 * optimiser is `roseSigilOptimizer`.
 */
export {
  DEFAULT_ROSE_VERSION,
  letterPoint,
  ROSE_LETTERS,
  ROSE_VERSIONS,
  type RoseVersionId,
  roseLetters,
  roseRings,
  roseVersion,
  type SigilPoint,
  sigilPoints,
} from "./roseSigilInternals.ts";
export {
  type DrawingSource,
  ROSE_VERSION_NOTES,
  type RoseVersionNote,
} from "./roseSigilVersions.ts";
