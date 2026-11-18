/**
 * Figures the sigil engine is known to draw wrongly (plan 088), by rose
 * version and text (`kamea` and the stub's id for a kamea stub), with
 * every check each fails: O2's checks by name, and
 * O3 when read-back refuses it. `engine.oracle.test.tsx` holds the engine
 * to it exactly, so the list may only shrink: a new failure fails the
 * suite, and so does a figure that now passes until it is taken off.
 *
 * First recorded 18 November 2026, at 628 figures, when the end bar's
 * and crooks' clearance checks and the random corpus joined the oracle.
 * Placement then learnt those checks, to draw crooks and nooses on either
 * side and to search again from other starts, which left the five words
 * below, all from the random corpus or at the grammar's domain edge:
 * long words with three or four visits to a place and crooks among them.
 * None is shown infeasible under the grammar; placement's bounded search
 * does not find a figure for them. With 25 times the work budget it finds
 * לולוסצצרפ and no other.
 *
 * - לולוסצצרפ: two returns along the rose's long diagonals, whose strokes
 *   lie on each other for 8.8 units, just over the 8 allowed.
 * - ללקלטטחללעל, ללהללהללהל: four visits to Lamed, three with crooks,
 *   whose strokes and cups crowd its slack.
 * - פגפבאאאפסממ, תזעטצשעעותתת: a stroke from a revisit runs through a
 *   crook drawn at the place's earlier visit.
 */
export const ENGINE_KNOWN_FAILURES: Readonly<Record<string, string>> = {
  "gd לולוסצצרפ": "overlap",
  "gd ללקלטטחללעל": "crook-clearance overlap O3",
  "gd פגפבאאאפסממ": "crook-clearance O3",
  "gd תזעטצשעעותתת": "clearance crook-clearance O3",
  "gd ללהללהללהל": "crook-clearance outer-ring overlap O3",
  "regardie1939 לולוסצצרפ": "overlap",
  "regardie1939 ללקלטטחללעל": "crook-clearance overlap O3",
  "regardie1939 פגפבאאאפסממ": "crook-clearance O3",
  "regardie1939 ללהללהללהל": "crook-clearance outer-ring overlap O3",
};
