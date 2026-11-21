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
 * - Added with the collinear-run family (second review, M1): 64 of its
 *   3,174 words, all failing clearance, where the line returns along a
 *   diameter it has run down, past its own nooses (האדלה, הלדאה, the
 *   template ההאדלה, כבמכקא), much as ללהאל's return does, but with two
 *   nooses in the way. A random search over the same checks, 1,500 starts
 *   a word, found a figure for 1 of 6 sampled (כבמכקא).
 */

export const ENGINE_KNOWN_FAILURES: Readonly<Record<string, string>> = {
  "gd וווגוכהז": "crook-clearance O3",
  "gd ההאדלה": "clearance",
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
  "gd כבמכקא": "clearance",
  "gd כבמכקב": "clearance",
  "gd קבמכקב": "clearance",
  "gd קבמכקמ": "clearance",
  "gd וגשפוג": "clearance",
  "gd וגשפוש": "clearance",
  "gd פגשפוא": "clearance",
  "gd פגשפוג": "clearance",
  "gd האדלה": "clearance",
  "gd אהאדלה": "clearance",
  "gd בהאדלה": "clearance",
  "gd גהאדלה": "clearance",
  "gd דהאדלה": "clearance",
  "gd והאדלה": "clearance",
  "gd זהאדלה": "clearance",
  "gd חהאדלה": "clearance",
  "gd טהאדלה": "clearance",
  "gd יהאדלה": "clearance",
  "gd כהאדלה": "clearance",
  "gd להאדלה": "clearance",
  "gd מהאדלה": "clearance",
  "gd נהאדלה": "clearance",
  "gd סהאדלה": "clearance",
  "gd עהאדלה": "clearance",
  "gd פהאדלה": "clearance",
  "gd צהאדלה": "clearance",
  "gd קהאדלה": "clearance",
  "gd רהאדלה": "clearance",
  "gd שהאדלה": "clearance",
  "gd תהאדלה": "clearance",
  "gd גופשגו": "clearance",
  "gd גופשגפ": "clearance",
  "gd שופשגו": "clearance",
  "gd שופשגפ": "clearance",
  "gd אלדאהב": "clearance",
  "gd אלדאהל": "clearance",
  "gd הלדאה": "clearance",
  "gd הלדאהא": "clearance",
  "gd הלדאהב": "clearance",
  "gd הלדאהג": "clearance",
  "gd הלדאהד": "clearance",
  "gd הלדאהה": "clearance",
  "gd הלדאהו": "clearance",
  "gd הלדאהז": "clearance",
  "gd הלדאהח": "clearance",
  "gd הלדאהט": "clearance",
  "gd הלדאהי": "clearance",
  "gd הלדאהכ": "clearance",
  "gd הלדאהל": "clearance",
  "gd הלדאהמ": "clearance",
  "gd הלדאהנ": "clearance",
  "gd הלדאהס": "clearance",
  "gd הלדאהע": "clearance",
  "gd הלדאהפ": "clearance",
  "gd הלדאהצ": "clearance",
  "gd הלדאהק": "clearance",
  "gd הלדאהר": "clearance",
  "gd הלדאהש": "clearance",
  "gd הלדאהת": "clearance",
  "gd בקכמבכ": "clearance",
  "gd בקכמבק": "clearance",
  "gd מקכמבכ": "clearance",
  "gd מקכמבק": "clearance",
};

/**
 * Figures the sigil engine is known to draw wrongly on the kameas (plan
 * 093, K2), by planet and text, with the checks each fails, as
 * `ENGINE_KNOWN_FAILURES` lists the rose's; `kamea.oracle.test.tsx` holds
 * the engine to it exactly, so it may only shrink. No name the pages
 * trace is here, nor in `KAMEA_NAME_KNOWN_FAILURES`.
 *
 * Recorded 20 November 2026 with `KAMEA_SIGIL_PROFILE` (28 units a cell,
 * slack 0.46 of a cell, lane starts, eight budgets): 70 of the corpus's
 * 16,533 triples and random words, 46 of the 15,273 letter-reachable
 * triples and 24 of the 1,260 random words, all on Mercury's square (35)
 * and the Moon's (35). The grid's templates and vol. 4's examples pass.
 *
 * Derived again 21 November 2026 (K3), with the stroke at the rule's
 * 0.6; the rule against runs along a cell's rule or the frame
 * (`KAMEA_LINE_RUN`, and O2's `line-run`); lane starts kept off those
 * lines; the seeded fallback; and the limits between inks, and how long
 * two inks may touch, counted in stroke widths where the stroke is wider
 * than a unit (Gadi's option B: 1.58 units on the Moon's square, 1.4 on
 * Mercury's, 1.22 on Venus', 1.05 on the Sun's). 87 of the corpus's
 * 16,533: 63 of the 15,273 triples and 24 of the 1,260 random words; 35
 * on Mercury's square (20 triples, 15 random words) and 52 on the Moon's
 * (43 triples, 9 random words). The 70 above are unchanged, and none
 * fails `line-run`; the fallback, tried on every one, clears none.
 *
 * - A return across most of the square (69 figures, `overlap`): A-B-A
 *   with A and B 7.6 to 9.9 cells apart (Mercury's corners, the ends of
 *   the Moon's column and its far corners), or A-B-C with A and C
 *   neighbours as far from B (the Moon's גוד, דוג, ודז, זדו), and random
 *   words that make such a return. F1 draws the return as a wedge whose
 *   far ends stand at most 0.92 of a cell apart (two slack radii), which
 *   opens a wedge 8 cells long by under 7°, so its strokes touch for about
 *   the grammar's limit of 8 units. Of the triples that return 7.6 cells
 *   or more, 20 of Mercury's 26 fail and 22 of the Moon's 26; the rest
 *   pass by a little. The rose has the same failure for its own longest
 *   returns (A-B-A-B-A at 55 units and more). Two random words fail on a
 *   turn that narrow rather than a return (גגזדדטטג, ייכבדואדדבכנ).
 * - נהננהנ on the Moon's square (`clearance`): A-B-A-B-A between 50 and
 *   5, 7.07 cells apart, with a crook at the second visit to 50; the last
 *   stroke passes within two units of the first visit, the rose's own
 *   long A-B-A-B-A failure.
 * - One letter three times on the Moon's square (17 triples, `bar-
 *   clearance crook-clearance`, added in K3): a word of one vertex that
 *   carries the start circle, two crooks running from its rim and the end
 *   bar through it. Their clearances are counted in the Moon's 1.58-unit
 *   stroke widths, but the marks are sized in units (a cup 1 to 2 deep,
 *   the bar 3 to 6 long), so the bar and the cups cannot stand that far
 *   apart, wherever the one vertex is placed. Mercury's 1.4 still leaves
 *   room. Scaling the marks too would need marks per square (the profile
 *   is one for all seven) and O2's mark ranges scaled with them, so they
 *   are listed rather than drawn differently.
 */
export const KAMEA_KNOWN_FAILURES: Readonly<Record<string, string>> = {
  "mercury אבא": "overlap",
  "mercury אגא": "overlap",
  "mercury אטא": "overlap",
  "mercury אמא": "overlap",
  "mercury באב": "overlap",
  "mercury ביב": "overlap",
  "mercury גאג": "overlap",
  "mercury וחו": "overlap",
  "mercury זחז": "overlap",
  "mercury חוח": "overlap",
  "mercury חזח": "overlap",
  "mercury חנח": "overlap",
  "mercury חסח": "overlap",
  "mercury טאט": "overlap",
  "mercury טיט": "overlap",
  "mercury יבי": "overlap",
  "mercury יטי": "overlap",
  "mercury מאמ": "overlap",
  "mercury נחנ": "overlap",
  "mercury סחס": "overlap",
  "mercury הזהז": "overlap",
  "mercury בבביב": "overlap",
  "mercury גאגיידד": "overlap",
  "mercury סמממסחסי": "overlap",
  "mercury בהדחנחמנ": "overlap",
  "mercury טטטאטדמזמ": "overlap",
  "mercury ממאמאסלמא": "overlap",
  "mercury הנהוובטיטל": "overlap",
  "mercury סוחוממואחי": "overlap",
  "mercury ללאטאלגגללל": "overlap",
  "mercury יולטיטסלטהא": "overlap",
  "mercury זחזוממטטטחו": "overlap",
  "mercury מאמאאאהגאאא": "overlap",
  "mercury טטטבגאטבזטיט": "overlap",
  "mercury נאאבאאסננבהמ": "overlap",
  "luna גוג": "overlap",
  "luna גוד": "overlap",
  "luna דהד": "overlap",
  "luna דוג": "overlap",
  "luna דוד": "overlap",
  "luna דזד": "overlap",
  "luna דלד": "overlap",
  "luna דעד": "overlap",
  "luna הדה": "overlap",
  "luna הוה": "overlap",
  "luna היה": "overlap",
  "luna הכה": "overlap",
  "luna הסה": "overlap",
  "luna וגו": "overlap",
  "luna ודו": "overlap",
  "luna ודז": "overlap",
  "luna והו": "overlap",
  "luna זדו": "overlap",
  "luna זדז": "overlap",
  "luna יהי": "overlap",
  "luna כהכ": "overlap",
  "luna כעכ": "overlap",
  "luna לדל": "overlap",
  "luna סהס": "overlap",
  "luna עדע": "overlap",
  "luna עכע": "overlap",
  "luna נהננהנ": "clearance",
  "luna פופגעכע": "overlap",
  "luna גגזדדטטג": "overlap",
  "luna דדדהההיהה": "overlap",
  "luna עכעעעזדלז": "overlap",
  "luna זזזדזדעהבזנ": "overlap",
  "luna זססהדהגסוהיכ": "overlap",
  "luna דוגגוגדדגגסד": "overlap",
  "luna ייכבדואדדבכנ": "overlap",
  "luna אאא": "bar-clearance crook-clearance",
  "luna בבב": "bar-clearance crook-clearance",
  "luna גגג": "bar-clearance crook-clearance",
  "luna דדד": "bar-clearance crook-clearance",
  "luna ההה": "bar-clearance crook-clearance",
  "luna ווו": "bar-clearance crook-clearance",
  "luna זזז": "bar-clearance crook-clearance",
  "luna חחח": "bar-clearance crook-clearance",
  "luna טטט": "bar-clearance crook-clearance",
  "luna ייי": "bar-clearance crook-clearance",
  "luna כככ": "bar-clearance crook-clearance",
  "luna ללל": "bar-clearance crook-clearance",
  "luna מממ": "bar-clearance crook-clearance",
  "luna נננ": "bar-clearance crook-clearance",
  "luna ססס": "bar-clearance crook-clearance",
  "luna עעע": "bar-clearance crook-clearance",
  "luna פפפ": "bar-clearance crook-clearance",
};

/**
 * Names in a spelling the pages trace (`kameaNameCases`) that the engine
 * draws wrongly, by the case's id, with the checks each fails. A name
 * that comes to fail must be listed here, with why, for the plan to
 * accept.
 *
 * One, accepted by Gadi on 21 November 2026 (K3, option B): 777's Malcha
 * with finals, בתרשישים with final Mem as 600, a spelling only the
 * generator traces (the pages trace at ordinary values, decision 3).
 * Its second word folds onto the Moon's fourth column, and with the
 * limits between inks counted in the Moon's 1.58-unit strokes, a return
 * along that column cannot open its wedge wide enough within the slack:
 * two strokes touch for longer than eight stroke widths. The seeded
 * fallback spends its whole budget on it without clearing it.
 * `KameaSigil` draws it best effort and marks it failed.
 *
 * Two cases place only through the kamea profile's seeded fallback since
 * the rule against runs along a rule (K3): Barrett's Malcha in both
 * finals modes, whose first word folds onto the Moon's fourth column (12
 * vertices, 10 of them in it). Without the fallback they fail overlap.
 */
export const KAMEA_NAME_KNOWN_FAILURES: Readonly<Record<string, string>> = {
  "malcha-betharsisim crowley777 finals": "overlap",
};
