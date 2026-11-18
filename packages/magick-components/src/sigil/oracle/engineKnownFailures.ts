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
 *
 * Added 18 November 2026 with loop clearance, the re-pass, crossed-crook
 * and A-B-A-B-A templates and the A-B-A-B-A corpus (at `c2ca523a`):
 *
 * - אבהאל, אגהאל: the return's noose on the start circle (loop-clearance).
 * - מממדתב, כככוההגג, וווגוכהז: the last strokes run through the first
 *   letter's crook (crook-clearance).
 * - A-B-A-B-A, 104 letter pairs on the gd rose (פלפלפ, טצטצט), and on
 *   Regardie's rose, where only words with Kaph or Tau differ and run, a
 *   few more: the third visit to A crowds the strokes into and out of the
 *   second visit to B (clearance), some lying on each other (overlap).
 */

export const ENGINE_KNOWN_FAILURES: Readonly<Record<string, string>> = {
  "gd אבהאל": "loop-clearance O3",
  "gd אגהאל": "loop-clearance O3",
  "gd בעבעב": "clearance",
  "gd בצבצב": "clearance",
  "gd בקבקב": "clearance",
  "gd גוגוג": "clearance",
  "gd גזגזג": "clearance",
  "gd גחגחג": "clearance",
  "gd דהדהד": "clearance",
  "gd דודוד": "clearance",
  "gd דקדקד": "clearance",
  "gd הדהדה": "clearance",
  "gd הטהטה": "clearance",
  "gd היהיה": "clearance overlap",
  "gd הלהלה": "clearance overlap",
  "gd הנהנה": "clearance overlap",
  "gd הסהסה": "clearance",
  "gd וגוגו": "clearance",
  "gd ודודו": "clearance",
  "gd וווגוכהז": "crook-clearance O3",
  "gd ויויו": "clearance",
  "gd ולולו": "clearance overlap",
  "gd ונונו": "clearance overlap",
  "gd וסוסו": "clearance overlap",
  "gd ועועו": "clearance",
  "gd זגזגז": "clearance",
  "gd זלזלז": "clearance",
  "gd זנזנז": "clearance overlap",
  "gd זסזסז": "clearance overlap",
  "gd זעזעז": "clearance overlap",
  "gd זצזצז": "clearance",
  "gd זתזתז": "clearance",
  "gd חגחגח": "clearance",
  "gd חנחנח": "clearance",
  "gd חסחסח": "clearance overlap",
  "gd חעחעח": "clearance overlap",
  "gd חצחצח": "clearance overlap",
  "gd חקחקח": "clearance",
  "gd חתחתח": "clearance",
  "gd טהטהט": "clearance",
  "gd טכטכט": "clearance",
  "gd טסטסט": "clearance",
  "gd טעטעט": "clearance overlap",
  "gd טצטצט": "clearance overlap",
  "gd טקטקט": "clearance overlap",
  "gd טתטתט": "clearance",
  "gd יהיהי": "clearance overlap",
  "gd יויוי": "clearance",
  "gd יכיכי": "clearance",
  "gd יעיעי": "clearance",
  "gd יציצי": "clearance overlap",
  "gd יקיקי": "clearance overlap",
  "gd יתיתי": "clearance",
  "gd כטכטכ": "clearance",
  "gd כיכיכ": "clearance",
  "gd כככוההגג": "crook-clearance O3",
  "gd כלכלכ": "clearance",
  "gd להלהל": "clearance overlap",
  "gd לולול": "clearance overlap",
  "gd לולוסצצרפ": "overlap",
  "gd לזלזל": "clearance",
  "gd לכלכל": "clearance",
  "gd ללהללהללהל": "crook-clearance outer-ring overlap O3",
  "gd ללקלטטחללעל": "crook-clearance overlap O3",
  "gd לפלפל": "clearance",
  "gd לצלצל": "clearance",
  "gd לקלקל": "clearance overlap",
  "gd מממדתב": "crook-clearance O3",
  "gd נהנהנ": "clearance overlap",
  "gd נונונ": "clearance overlap",
  "gd נזנזנ": "clearance overlap",
  "gd נחנחנ": "clearance",
  "gd נפנפנ": "clearance",
  "gd נקנקנ": "clearance",
  "gd נרנרנ": "clearance",
  "gd סהסהס": "clearance",
  "gd סוסוס": "clearance overlap",
  "gd סזסזס": "clearance overlap",
  "gd סחסחס": "clearance overlap",
  "gd סטסטס": "clearance",
  "gd ספספס": "clearance",
  "gd סרסרס": "clearance",
  "gd עבעבע": "clearance",
  "gd עועוע": "clearance",
  "gd עזעזע": "clearance overlap",
  "gd עחעחע": "clearance overlap",
  "gd עטעטע": "clearance overlap",
  "gd עיעיע": "clearance",
  "gd ערערע": "clearance",
  "gd פגפבאאאפסממ": "crook-clearance O3",
  "gd פלפלפ": "clearance",
  "gd פנפנפ": "clearance",
  "gd פספספ": "clearance",
  "gd צבצבצ": "clearance",
  "gd צזצזצ": "clearance",
  "gd צחצחצ": "clearance overlap",
  "gd צטצטצ": "clearance overlap",
  "gd ציציצ": "clearance overlap",
  "gd צלצלצ": "clearance",
  "gd צרצרצ": "clearance",
  "gd קבקבק": "clearance",
  "gd קדקדק": "clearance",
  "gd קחקחק": "clearance",
  "gd קטקטק": "clearance overlap",
  "gd קיקיק": "clearance overlap",
  "gd קלקלק": "clearance overlap",
  "gd קנקנק": "clearance",
  "gd רנרנר": "clearance",
  "gd רסרסר": "clearance",
  "gd רערער": "clearance",
  "gd רצרצר": "clearance",
  "gd תזעטצשעעותתת": "clearance crook-clearance O3",
  "gd תזתזת": "clearance",
  "gd תחתחת": "clearance",
  "gd תטתטת": "clearance",
  "gd תיתית": "clearance",
  "regardie1939 זכזכז": "clearance",
  "regardie1939 חכחכח": "clearance",
  "regardie1939 טכטכט": "clearance",
  "regardie1939 טתטתט": "clearance",
  "regardie1939 יכיכי": "clearance",
  "regardie1939 יתיתי": "clearance",
  "regardie1939 כזכזכ": "clearance",
  "regardie1939 כחכחכ": "clearance",
  "regardie1939 כטכטכ": "clearance",
  "regardie1939 כיכיכ": "clearance",
  "regardie1939 לולוסצצרפ": "overlap",
  "regardie1939 ללהללהללהל": "crook-clearance outer-ring overlap O3",
  "regardie1939 ללקלטטחללעל": "crook-clearance overlap O3",
  "regardie1939 לתלתל": "clearance",
  "regardie1939 פגפבאאאפסממ": "crook-clearance O3",
  "regardie1939 תטתטת": "clearance",
  "regardie1939 תיתית": "clearance",
  "regardie1939 תלתלת": "clearance",
};
