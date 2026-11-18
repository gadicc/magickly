/**
 * Figures the sigil engine is known to draw wrongly (plan 088), by rose
 * version and text (`kamea` and the stub's id for a kamea stub), with
 * every check each fails: O2's checks by name, and
 * O3 when read-back refuses it. `engine.oracle.test.tsx` holds the engine
 * to it exactly, so the list may only shrink: a new failure fails the
 * suite, and so does a figure that now passes until it is taken off.
 *
 * First recorded 18 November 2026, at 628 figures, when the end bar's
 * and crooks' clearance checks and the random corpus joined the oracle,
 * and grown to 134 with loop clearance, the re-pass and crossed-crook
 * templates and the A-B-A-B-A corpus (at `c2ca523a`). Placement has since
 * learnt loop clearance, a start with the first letter drawn ahead or back
 * along its first stroke, and nooses in a row settled together, which
 * leaves these. None is proven infeasible under the grammar.
 *
 * - A-B-A-B-A, 116 figures (102 on the gd rose): all with A and B at least
 *   55 units apart, where only 4 words (at 58 units) pass; every word
 *   closer passes. Each of its three wedges must open about 7° (8 units of
 *   touching ink), so its far ends stand (D − 9.2) / 8 apart, 5.7 or more
 *   at 55 units, inside 9.2-unit slack discs; the third visit to A must
 *   then clear both the start circle and the first stroke with its bar,
 *   and the last stroke the start circle. A random search over the same
 *   checks, 1,500 starts a word, found a figure for 2 of 21 sampled
 *   (תזתזת, זתזתז) and none for the other 19, so most are likely
 *   infeasible and a few are beyond placement's local search.
 * - וווגוכהז: the last stroke runs through the first letter's crook. A
 *   random search finds a figure (the first visit moved ahead with the
 *   revisit beside it); placement's starts do not reach it.
 * - לולוסצצרפ: two returns along the rose's long diagonals, whose strokes
 *   lie on each other for 8.8 units, just over the 8 allowed; found with
 *   25 times the work budget.
 * - ללקלטטחללעל, ללהללהללהל: four visits to Lamed, three with crooks,
 *   whose strokes and cups crowd its slack.
 * - פגפבאאאפסממ, תזעטצשעעותתת: a stroke from a revisit runs through a
 *   crook drawn at the place's earlier visit.
 */

export const ENGINE_KNOWN_FAILURES: Readonly<Record<string, string>> = {
  "gd וווגוכהז": "crook-clearance O3",
  "gd פלפלפ": "overlap",
  "gd טצטצט": "clearance overlap",
  "gd לולוסצצרפ": "overlap",
  "gd ללקלטטחללעל": "crook-clearance overlap O3",
  "gd פגפבאאאפסממ": "crook-clearance O3",
  "gd תזעטצשעעותתת": "clearance crook-clearance O3",
  "gd ללהללהללהל": "crook-clearance outer-ring overlap O3",
  "gd פנפנפ": "clearance",
  "gd פספספ": "clearance",
  "gd רנרנר": "overlap",
  "gd רסרסר": "clearance",
  "gd רערער": "clearance",
  "gd רצרצר": "clearance",
  "gd בעבעב": "clearance",
  "gd בצבצב": "clearance",
  "gd בקבקב": "overlap",
  "gd דהדהד": "clearance",
  "gd גוגוג": "overlap",
  "gd גזגזג": "clearance",
  "gd גחגחג": "clearance",
  "gd תזתזת": "clearance",
  "gd תחתחת": "clearance",
  "gd תטתטת": "clearance",
  "gd תיתית": "overlap",
  "gd כטכטכ": "clearance",
  "gd כיכיכ": "clearance",
  "gd כלכלכ": "overlap",
  "gd הדהדה": "clearance",
  "gd הטהטה": "clearance",
  "gd היהיה": "clearance overlap",
  "gd הלהלה": "clearance overlap",
  "gd הנהנה": "clearance overlap",
  "gd הסהסה": "clearance",
  "gd וגוגו": "overlap",
  "gd ויויו": "clearance",
  "gd ולולו": "clearance overlap",
  "gd ונונו": "clearance overlap",
  "gd וסוסו": "clearance overlap",
  "gd ועועו": "clearance",
  "gd זגזגז": "clearance",
  "gd זתזתז": "clearance",
  "gd זלזלז": "clearance",
  "gd זנזנז": "clearance overlap",
  "gd זסזסז": "clearance overlap",
  "gd זעזעז": "clearance overlap",
  "gd זצזצז": "clearance",
  "gd חגחגח": "clearance",
  "gd חתחתח": "clearance",
  "gd חנחנח": "clearance",
  "gd חסחסח": "clearance overlap",
  "gd חעחעח": "clearance overlap",
  "gd חצחצח": "clearance overlap",
  "gd חקחקח": "clearance",
  "gd טתטתט": "clearance",
  "gd טכטכט": "clearance",
  "gd טהטהט": "clearance",
  "gd טסטסט": "clearance",
  "gd טעטעט": "clearance overlap",
  "gd טקטקט": "clearance overlap",
  "gd יתיתי": "overlap",
  "gd יכיכי": "clearance",
  "gd יהיהי": "clearance overlap",
  "gd יויוי": "clearance",
  "gd יעיעי": "clearance",
  "gd יציצי": "clearance overlap",
  "gd יקיקי": "clearance overlap",
  "gd לפלפל": "overlap",
  "gd לכלכל": "overlap",
  "gd להלהל": "clearance overlap",
  "gd לולול": "clearance overlap",
  "gd לזלזל": "clearance",
  "gd לצלצל": "clearance",
  "gd לקלקל": "clearance overlap",
  "gd נפנפנ": "clearance",
  "gd נרנרנ": "overlap",
  "gd נהנהנ": "clearance overlap",
  "gd נונונ": "clearance overlap",
  "gd נזנזנ": "clearance overlap",
  "gd נחנחנ": "clearance",
  "gd נקנקנ": "clearance",
  "gd ספספס": "clearance",
  "gd סרסרס": "clearance",
  "gd סהסהס": "clearance",
  "gd סוסוס": "clearance overlap",
  "gd סזסזס": "clearance overlap",
  "gd סחסחס": "clearance overlap",
  "gd סטסטס": "clearance",
  "gd ערערע": "clearance",
  "gd עבעבע": "clearance",
  "gd עועוע": "clearance",
  "gd עזעזע": "clearance overlap",
  "gd עחעחע": "clearance overlap",
  "gd עטעטע": "clearance overlap",
  "gd עיעיע": "clearance",
  "gd צרצרצ": "clearance",
  "gd צבצבצ": "clearance",
  "gd צזצזצ": "clearance",
  "gd צחצחצ": "clearance overlap",
  "gd צטצטצ": "clearance overlap",
  "gd ציציצ": "clearance overlap",
  "gd צלצלצ": "clearance",
  "gd קבקבק": "overlap",
  "gd קחקחק": "clearance",
  "gd קטקטק": "clearance overlap",
  "gd קיקיק": "clearance overlap",
  "gd קלקלק": "clearance overlap",
  "gd קנקנק": "clearance",
  "regardie1939 לולוסצצרפ": "overlap",
  "regardie1939 ללקלטטחללעל": "crook-clearance overlap O3",
  "regardie1939 פגפבאאאפסממ": "crook-clearance O3",
  "regardie1939 ללהללהללהל": "crook-clearance outer-ring overlap O3",
  "regardie1939 כזכזכ": "clearance",
  "regardie1939 כחכחכ": "clearance",
  "regardie1939 כטכטכ": "clearance",
  "regardie1939 כיכיכ": "overlap",
  "regardie1939 תטתטת": "clearance",
  "regardie1939 תיתית": "clearance",
  "regardie1939 תלתלת": "overlap",
  "regardie1939 זכזכז": "clearance",
  "regardie1939 חכחכח": "clearance",
  "regardie1939 טכטכט": "clearance",
  "regardie1939 טתטתט": "clearance",
  "regardie1939 יכיכי": "overlap",
  "regardie1939 יתיתי": "clearance",
  "regardie1939 לתלתל": "overlap",
};
