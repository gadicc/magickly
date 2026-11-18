# Rose sigil rules and oracle — 18 November 2026

Status: decided 18 November 2026 ([decisions](#decisions)), being built
on `gate/rose-sigil-oracle`. Reviewed by Fable 5.2 on 18 November 2026
([below](#review-18-november-2026)) and revised on its findings. Read
`packages/magick-components/src/gd/roseSigilInternals.ts` (the path rules
and the optimiser's objective) and [plan 080](080-open-source-packages.md)
(decision 7: why the optimiser is its own module) first.

## Why

`/gd/sigils` draws a Hebrew name through the letters of the Golden Dawn
rose: a circle at the first letter, straight lines letter to letter, a bead
where the path runs straight through a letter, a squiggle for a repeated
letter, a bar at the last, and COBYLA nudging the points apart. Its tests
pin geometry (rounding, arcs, one process's determinism) but nothing checks
that a drawing follows the rules, so a sigil can be wrong and pass every
test. The 72 angels pages want these sigils
([plan 031](031-seventy-two-angels.md#follow-ups)): seventy-two published
figures, each of which must read back as its name.

Two later uses shape the design. The rose will gain drawn petals, which
must not touch the rules or the placement (a 4.6-unit disc already stays
inside each ring band). And the same machinery should trace sigils on a
kamea, where a name becomes numbers and the numbers cells.

## The rules

The Order's drawing rules are in one passage, with worked figures: Israel
Regardie, *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940), "Sigils",
archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`: the rules on p. 57
(leaf n51); Metatron and Elohim drawn on p. 58 (leaf n52); the sigils under
Binah on pp. 59–60 (leaves n53, n54). Vol. 3 (1939), p. 53, defers to it;
*The Equinox* and *777* give no drawing rules. Whether the 1940 copyright
was renewed is unverified, so we cite the pages and take facts from them,
nothing more. No modern source was checked.

| # | Rule | Source | Our engine |
| --- | --- | --- | --- |
| R1 | A small circle at the first letter | p. 57; every figure | Done |
| R2 | Straight lines letter to letter, in order, until **the word** ends; several words are several sigils, side by side, each with its circle and bar | p. 57; p. 59 (יהוה אלהים, two), p. 60 (יוד הא ואו הא, four) | `RoseSigil` joins words (`roseLetters` drops spaces); the page and the image contract reject a space |
| R3 | The same letter twice in a row: "a crook or wave in the line at that point", drawn as two small cups meeting in a cusp at the letter, one crook per adjacent pair | p. 57; p. 58 (Metatron's doubled Teth) | One squiggle per pair, but a repeated first letter is never seen, a run of three draws one squiggle and a line, and the bead check runs first |
| R4 | A letter of the name that the line passes through on its way from its predecessor to its successor (Resh in Metatron, ט→ר→ו): a noose, a small closed loop tangent to one side of an unbent line | p. 57 (glyph), p. 58 (figure) | A bead when the turn is within 10° of straight, tested on the *optimised* points, drawn as a loop that straddles the line and grows with the incoming segment |
| R5 | A short bar across the line at the last letter | Not in the text. 10 of the 13 figures have it, the three-letter יוד among them; the three without are all in the composite p. 60 figure (both הא, one stroke each, and ואו, which ends at its own start) | Always drawn |
| R6 | The points are the letters' places on the rose | p. 57 | Letter centres, moved by up to 4.6 units by the optimiser |
| R7 | The GD order of the doubles | The p. 60 Shabbathai figure measures Shin→Tau about 16 units; the GD rose gives 17.4, Regardie 1939's 30.1 | Default `gd`; `roseSigilVersions.ts` must not imply Regardie's own sigils use his swapped rose |

What the figures show where the text is silent:

- **F1 Returning to a letter (A-B-A)** (יהוה, אראלים, זאזל, ואו, both
  Elohims): the return is a narrow wedge, the second visit drawn just beside
  the first, no mark. A letter recurring later (אגיאל's second א) is drawn
  just beside its first place. Regardie's offsets measure about 5.6–8 units
  on our scale.
- **F2 A line through a letter not in the name** (Binah's Nun→He past Shin,
  Elohim's Aleph→Lamed through Daleth): no mark.
- **F3 A line crossing a name letter that is not between its own
  neighbours** (Elohim's Lamed→He back along Aleph→Lamed): no noose; the
  stroke is offset from the first. R4 is not "any name letter the line
  crosses".
- **F4** Lines cross the rose's centre freely.
- **F5** Final forms are drawn at the base letter's place.

Still silent: runs of three or more; a repeat at the start or the end; a
doubled letter that is also a straight pass; a one-letter word; how close
to the line a letter must lie to count as "passed through" (the only
attested case, Resh in Metatron, lies 0.23 units off the Teth→Vau chord on
our rose).

### Fixtures from the primary figures

Recorded by hand, as facts: the expected marks per vertex, the sequence of
turn directions and which strokes cross. Turn directions and crossings pin
the layout as well as the rules, so a mirrored rose or two swapped letters
fail.

| Word | Page | Shows |
| --- | --- | --- |
| מטטרון (Metatron) | 58 | Crook at Teth, noose at Resh |
| אלהים | 58, 59 | F1 wedge at Lamed; F3 no noose past Aleph; F2 through Daleth; final Mem |
| בינה | 59 | Plain; F2 past Shin |
| יהוה | 59 | F1 wedge |
| צפקיאל | 59 | Line near Kaph, no mark |
| אראלים | 59 | F1 wedge; final Mem |
| שבתי | 60 | R7; the figure omits the usual Aleph, so three strokes |
| יוד, הא, ואו, הא | 60 | R2 four sigils; R5's counter-examples |
| אגיאל | 60 | F1 later recurrence |
| זאזל | 60 | F1 wedge under the start circle |

## Vaughan's figures

Piers Vaughan, *Rosicrucian Sigils of the 72 Geniuses* (Rose Circle
Publications, 2020), 73 pages, one raster figure per page; archived at
`https://web.archive.org/web/20250804125717/https://rosecirclebooks.com/wp-content/uploads/2020/07/Roscrucian-Sigils-of-the-72-Geniuses.pdf`.
The copy we use, fetched from the live URL on 18 November 2026: SHA-256
`18a7e0a88d3d08818ac9926a30f53f316c913c27634e92aa6e639680ff676315`,
6,371,897 bytes. Copyrighted and his own drawing: it never enters the
repository, not even as crops, and neither do per-figure annotations or the
side-by-side sheet, which is never published as an artifact or attached to
a PR. It stays in `~/Documents/Magick/RoseSigils/`.

He draws on the GD rose (Kaph's place in #7) with points placed by hand,
so his geometry is no reference. His conventions, checked at native
resolution:

- Start circle, end bar, a bead tangent to the line on a straight pass.
- **One two-lobed wave per adjacent pair**, as Regardie's crook: two lobes
  for every double checked (#6, 12, 19, 24, 29, 30, 40, 52, 53 twice, 57,
  58, 62, 71), four for the triples יייאל and הההאל. A first-letter repeat
  is the start circle followed by the wave.
- A doubled letter on a straight pass (#26 האאיה) is **two beads** on an
  unbent line, not a wave.
- His "straight pass" is not consistent: beads at 4.5–6 units off the chord
  in some names, bends at 4.9–5.85 in others. He cannot settle R4's
  tolerance.

His spellings are his own: 10 of the 72 differ from the triads of Exodus
14:19–21 (#24, 33, 34, 38, 51, 59, 64, 68 have He for Cheth; #30 is ומאאל
for אומאל; #66 ends יה for אל), and his figures follow his spellings.

## What is wrong today (measured 18 November 2026, at `f5128585`)

| Name | Ours | Expected |
| --- | --- | --- |
| ללהאל, יייאל, ננאאל (repeated first letter) | Two or three stray circles | Start circle, then a crook per pair (R3) |
| הההאל (run of three) | A blob of overlapping arcs | Two crooks |
| ללהאל (ל→ה→א→ל on the vertical axis) | One line drawn up and back over itself | Strokes offset (F1, F3) |
| יהוה אלהים (two words) | One path | Two sigils (R2) |
| יבמיה (133° at Beth) | A bead: the optimiser straightens the corner | A plain corner |
| מומיה (162° at Mem) | The optimiser bends the pass to 139° | Decided by R4's tolerance, on unmoved points |
| 63 of the 72 names | The optimised path changes when the letter centres move by one ulp; 29 by a unit or more, up to 4.5; עממיה's marks change | The same drawing in Node, Chromium and the oracle |

Causes, from the code (`roseSigilInternals.ts`):

1. The repeat check compares point `i` with `i + 1` for `i ≥ 1` only, so a
   repeated first letter is never seen.
2. The straight-pass check runs before the repeat check, and after
   optimisation a pair of repeats sits a few hundredths apart in a near
   line, so it draws beads.
3. A run of three draws one squiggle and then a line.
4. Nothing keeps two strokes from lying on each other.
5. `roseLetters` drops spaces, so words are joined.
6. The bead test runs on the optimised points, so the optimiser decides R4.
7. The objective is discontinuous: `if (angle > 180) angle -= 180` scores
   mirror-image corners of one interior angle 153.4 and 26.6, so it rewards
   straightening one way and sharpening the other; the repeat bonus keys on
   `toFixed(2)`; and 19 of the 72 names end with a point riding the 4.6
   cap. With last-bit trig differences between engines (recorded in
   `roseSigilGeometry.test.ts`), this is why browser, server image and
   Node disagree.

## Design

### Layout: places, not letters

A *layout* knows nothing of rules. It maps a token to a place and a place
to geometry:

```ts
interface SigilLayout<Token> {
  place(token: Token): PlaceId | null;   // ש → "ש"; on a kamea, 40 → "r,c"; null: left out
  anchor(place: PlaceId): Point;         // where a first visit is drawn
  slack(place: PlaceId): number;         // how far a visit may move and still read as this place
  placeAt(point: Point): PlaceId | null; // for read-back
  unit: number;                          // layout coordinates per sigil unit (1 on the rose)
  places: readonly PlaceId[];
}
```

The rose (either version, with or without petals) is one layout; a kamea
is another. Repeats, revisits and passes are decided on place ids, so on a
kamea two different letters that reduce to one cell repeat. A *rule
profile* per tradition says which marks exist: the rose profile is R1–R5;
the kamea passage (vol. 4, about p. 75; Regardie calls it "a slightly
different system", p. 60) gives the start circle and the order of the
numbers, and the kamea profile starts from that.

### Plan: what each vertex says

`planSigil(text, layout, profile)` returns one record per word and per
vertex, with no drawing decisions left. The types are in
`packages/magick-components/src/sigil/types.ts`:

```ts
interface SigilVertex {
  place: PlaceId;
  visit: number;   // 0 for the word's first vertex at this place, 1 for the next...
  crooks: number;  // letters merged into this vertex after the first
  marks: readonly SigilMark[]; // "start" | "crook" | "noose" | "end", in that order
}
type SigilPlan = readonly (readonly SigilVertex[])[]; // one array per word
```

The rules, exactly; the blind reference (O1) and `planSigil` are both
written from this list:

1. **Words.** Split the text on whitespace. Map each character of a word
   with `layout.place`; a character with no place (on the rose: anything
   but the 22 letters and the five final forms, which take their base
   letter's place, F5) is dropped. A word left with no places is dropped.
2. **Runs.** Consecutive equal places merge into one vertex, with
   `crooks` = the run's length − 1 (decision 3).
3. **Visits.** `visit` counts the earlier vertices of the same word at the
   same place.
4. **Marks.** `start` on the word's first vertex, `end` on its last
   (decision 6; a one-vertex word has both), `crook` when `crooks` > 0.
   `noose` on an interior vertex V with `crooks` = 0 whose neighbours P and
   N are at different places, when V's anchor lies within
   `nooseTolerance × unit` of the segment from P's anchor to N's anchor
   and its foot on that line falls strictly between them (0 < t < 1).
   Anchors are taken rounded to 0.001 and the comparison is `≤`. A
   doubled letter on a straight pass gets its crook and no noose
   (decision 4).

### Placement: by rule, not by solver

Both sources place revisits by hand just beside the first visit, and the
solver is the source of most measured instability (cause 7). The
recommendation is to replace it with deterministic placement:

- A first visit sits on its anchor.
- A revisit, or the second of a crook, moves by a fixed offset of
  `k × unit` perpendicular to the incoming stroke, on the side away from
  the strokes already drawn at that place, which is what F1 and F3 show.
- If that offset leaves a stroke within ε of another drawn vertex of the
  name, or overlapping another stroke (O2's checks), try a short fixed list
  of candidates in order: the other side, then 2k and 3k × unit on each
  side, capped by the place's slack. Take the first that passes every
  check; if none does, the one that fails fewest, ties to the earlier
  candidate. Vertices are placed one at a time in path order. This is a
  discrete search over a handful of positions, with O2's checks as its
  constraints, so it cannot drift the way a continuous solver does.
- A noose vertex is placed on the chord from its neighbours, at the foot
  of the perpendicular from its anchor, so the line stays unbent (R4).
- Only `+ − × ÷ √` and comparisons in placement, with inputs quantised to
  the SVG's 0.001, so every engine draws the same figure.

The optimiser leaves the drawing path and the package (decision 7). Should
a solver ever return, its preconditions are: quantised inputs, an
objective with no trig and no thresholds, `noose` fixed beforehand and
held collinear, and the 1-ulp check in O2.

### Renderer

Draws a placed plan: circle, lines, crooks (two cups and a cusp), nooses
(a tangent loop of fixed size), bars, words side by side in one SVG with a
per-props viewBox (`viewBoxOf` exists in `src/render/contracts/types.ts`).
Mark sizes are in layout units, not rose constants, so they scale on a
kamea's 10.7–32-unit cells.

### Compatibility

`RoseSigilImage`'s `points` prop and `optimizeSigilPoints` are public
exports of the published `magick-components`. `points` keeps working,
deprecated: given, its points are drawn with today's path rules; absent,
the figure is placed by rule. `optimizeSigilPoints` and the
`gd/roseSigilOptimizer` entry are removed with `nlopt-js` (decision 7),
so the next release is 0.4.0. R2 is additive in the app: the page and the
contract reject spaces today, so accepting them (with whitespace
collapsed) changes no existing link.

## The oracle

The oracle answers "does this figure follow the rules and read as its
name?" without trusting the code under test.

| Check | What it compares | Catches |
| --- | --- | --- |
| **O1 Expected plans** | `planSigil` against plans **encoded by hand** for the primary fixtures and the templates, plus a naive reference implementation (written from the rule list by an agent that has not seen `planSigil`) over the exhaustive corpus | Rule logic; the hand fixtures catch a rule misread in the list itself, which a second implementation would share |
| **O2 Invariants** | The rendered figure against the plan and layout, with thresholds fixed in S1 from legibility at the smallest published size, not tuned to the output: start circle on the first vertex; bar perpendicular to the last stroke; a tangent noose per `noose`; two cups per crook; every vertex within its place's slack; no two strokes overlapping for more than *k* units; no stroke within ε of another drawn vertex of the name except its own ends (strokes through letters outside the name are allowed, F2); every mark inside the outer ring; identical output under a 1-ulp perturbation of the anchors | Placement and renderer bugs, engine disagreement |
| **O3 Read-back from ink** | A decoder that ignores the path's command order: flatten arcs, merge collinear and overlapping segments, find the circle, the bar, cups and loops by shape, take a vertex only at a visible turn or mark, trace from circle to bar going straight at crossings, map vertices with `placeAt`, and fail unless exactly one reading exists | Anything that makes the figure ambiguous, whatever its cause, including a line drawn back over itself or a missing noose |
| **O4 External agreement** (local only) | Our plan for each of Vaughan's figures, keyed on **his** spelling of that figure, against his marks | Conventions we missed; every disagreement classified as our bug, his convention or his slip |

**The oracle is tested too.** A mutation suite renders deliberately broken
figures: no bar, one cup of a crook, a missing noose, two strokes laid on
each other, the rose mirrored, two letters swapped, words joined. Each must
fail O1–O3, and the hand fixtures must pass.

O1–O3 are Vitest suites in the package and run in CI. O4 never runs in CI;
it reads `SIGIL_ORACLE_EXTERNAL=<dir>` and its inputs and outputs stay in
that directory.

### The corpus

- **The primary fixtures** above, by hand.
- **The 72 names**: the triads from Exodus 14:19–21 (each verse checked at
  72 letters) with the יה/אל suffix as Lenain's 1823 printing gives it
  ([plan 033](033-lenain-edition.md)); Vaughan's ten variants as separate
  O4 inputs only.
- **Templates** per rule and edge case, encoded by hand: each letter
  doubled and tripled at start, middle and end; A-B-A and A-B-A-B; a
  doubled letter on a straight pass; collinear runs both ways; through
  the centre; through a letter outside the name; one-letter and multi-word
  texts.
- **Exhaustive**: all 22² pairs and 22³ triples through O1–O3 on both
  roses. The current solver did all 10,648 triples in 3.5 s and the 72
  names in 92 ms (median 200 evaluations, never near the 20,000 cap), so
  nothing needs sampling.
- **Kamea stubs**: a grid layout with Zazel (7, 1, 7, 3) and
  Taphthartharath (40, 8, 40, 20, 40, 20, 40) from vol. 4, pp. 78–79, so
  the layout-agnostic claim is tested in S1, not asserted.
- **Domain**: the contract accepts up to 32 letters; the invariants cover
  at most N visits per place (N fixed in S1 from what still reads).

### Measuring accuracy

`pnpm sigils:oracle` runs every check over the corpus and writes a report
to the scratch directory: per rule, how many cases it applies to and how
many pass; per name, which checks fail; a contact sheet of our 72. With
`SIGIL_ORACLE_EXTERNAL` set it adds O4 and a side-by-side sheet in that
directory only. The Vitest suites carry a known-failures list that may
only shrink. Plan entries record counts and a few decisive examples, never
per-figure annotations of Vaughan's work.

## Stages

| Stage | What | Gate |
| --- | --- | --- |
| S0 | Vaughan's figures annotated twice, independently, at native resolution (crops, as `scripts/seventyTwoAngels/hebrew.ts` learned for Lenain's Hebrew), and reconciled; `names.json`'s #45 (Samekh, not Shin) fixed | Gadi |
| S1 | Oracle first: layout interface with the rose and a kamea stub, hand fixtures, corpus, O1 reference (written blind), O2 with fixed thresholds and a feasibility proof for the worst case (ללהאל: two strokes and a noose within the slack at Aleph), O3 ink decoder, mutation suite, report script | The oracle flags every row of "What is wrong today" and every mutant, and passes the hand fixtures |
| S2 | `planSigil`, rule placement, renderer; R2 (words) in the package, page and contract; the golden tests that pin today's squiggles and one COBYLA layout (`roseSigilGeometry.test.ts:101-113`, `147-156`, `291-306`) replaced by O1–O3; `points` deprecated, the optimiser retired (decision 7); a contact sheet of every corpus vertex 0.5–3 units off its chord, drawn at 1 unit, for judging R4's tolerance | O1–O3 green on the exhaustive corpus, O2 including the 1-ulp check; the image route's cache key changes with the drawing |
| S3 | O4 against Vaughan; disagreements classified and counted here | Gadi reviews the side-by-side sheet locally |
| S4 (later) | The 72 angels pages: sigils rendered at build, cached, linked to `/gd/sigils?text=…`; caching and SEO decided then | Its own section |
| S5 (later) | Kamea profile and layout on `Kamea` | Its own plan |

`/gd/sigils` is not among the docs screenshots, so no capture is needed.

## Decisions

Settled 18 November 2026. Gadi chose 1, 2 and 7 and said to proceed on
the rest as recommended.

1. **Placement by rule**, with the small candidate search above, replaces
   the optimiser on the drawing path.
2. **Noose tolerance (R4): 1 unit, provisional.** A profile setting. At
   about 1 unit only the eight names ending האל qualify, which matches the
   one attested case (0.23 units); at 5 units מומיה, דמביה and יבמיה join,
   two of them 47° corners. Judged on S2's contact sheet, by us and then
   by Gadi, before it is final.
3. **Runs of three or more**: one crook per adjacent pair (Vaughan's
   reading, consistent with R3).
4. **A doubled letter on a straight pass**: a crook on the unbent line,
   with no noose. The crook already marks the stop that R4's noose exists
   to show; Vaughan's two nooses are his convention, counted in S3.
5. **R2 layout**: words side by side, right to left, in one SVG.
6. **End bar**: always, including one-stroke words.
7. **The optimiser leaves the package.** `nlopt-js` is removed as a
   dependency of the package and the app, and the optimiser's source is
   kept in the repository, out of the build, as
   `roseSigilOptimizer.ts.old` for reference. `optimizeSigilPoints` and
   the `gd/roseSigilOptimizer` export go, which is a breaking change for
   the published `magick-components` (0.x, so its next release is 0.4.0).
   `RoseSigilImage`'s `points` prop is kept, deprecated.

## Review (18 November 2026)

Fable 5.2 (high) reviewed the first draft adversarially against the page
images, Vaughan's figures at native resolution and measurements of the
code. The findings, all taken:

- **High.** The draft missed leaf n52, the only primary figure showing a
  crook and a noose, and misspelled Metatron as מטרון from the colour list.
  Its Vaughan facts were wrong in four places (names, hump counts, the
  doubled straight pass, his inconsistent bead criterion); the hump count
  ("three" for a triple; it is four lobes) was the planner's own error,
  confirmed at native resolution. Its read-back (O3) parsed the path's
  command order and so would have read today's ללהאל, a line drawn over
  itself, correctly. And it extended a solver that changes 63 of the 72
  drawings under a one-ulp nudge (reproduced) without listing that.
- **Medium.** O1 shared its errors with the code (hand fixtures and a
  mutation suite added); R4 lacked a tolerance, a drawing position and a
  precedence; the design was not yet layout-agnostic (repeats by token,
  rose constants); the mark type could not hold two marks; R2 had no
  stage; the package's public exports were not addressed; O2's thresholds
  were to be tuned on the output; the test budget was overestimated a
  hundredfold.
- **Low.** R5's wording, R2's effect on links (additive), Vaughan
  annotations kept out of the plan, an archived snapshot for the PDF's
  URL, "inside the rose" undefined, the Shabbathai spelling.

Not checked by anyone yet: six of Vaughan's ten variant spellings on the
figures themselves; about 50 of his figures; Regardie's renewal status;
real Chromium output (the 1-ulp nudge is a proxy).
