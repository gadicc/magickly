/*!
 * The lit part's path is adapted from phase_junk() in moon-phase.js:
 * https://github.com/tingletech/moon-phase/blob/643015a83509ca6a662d1af6e1ac14661852cedb/moon-phase.js
 * Copyright (c) 2012, Regents of the University of California.
 * All rights reserved. Used under the BSD 3-Clause License, whose
 * conditions and disclaimer are in this package's LICENSE.txt; this file
 * is under that licence as well as MIT.
 */

/**
 * The Moon drawing's geometry, apart from the client component that draws
 * it, so that it can be imported anywhere (plan 080, decision 7).
 */

/** The Moon's orbit's mean inclination to the ecliptic, in degrees. */
export const moonMeanInclination = 5.15;

// Ported from moon-phase's phase_junk() (above), which also draws the
// disc; the hemisphere, the inclination and the glow are ours.

/** SVG path of the moon's lit part for a `lune` phase (0 to 1, 0.5 is full). */
export function moonPath(phase: number): string {
  let mag, sweep;

  // the "sweep-flag" and the direction of movement change every quarter moon
  // zero and one are both new moon; 0.50 is full moon
  if (phase <= 0.25) {
    sweep = [1, 0];
    mag = 20 - 20 * phase * 4;
  } else if (phase <= 0.5) {
    sweep = [0, 0];
    mag = 20 * (phase - 0.25) * 4;
  } else if (phase <= 0.75) {
    sweep = [1, 1];
    mag = 20 - 20 * (phase - 0.5) * 4;
  } else if (phase <= 1) {
    sweep = [0, 1];
    mag = 20 * (phase - 0.75) * 4;
  } else {
    throw new Error("Invalid phase: " + phase);
  }

  return `m85,5 a${mag},20 0 1,${sweep[0]} 0,150 a20,20 0 1,${sweep[1]} 0,-150`;
}
