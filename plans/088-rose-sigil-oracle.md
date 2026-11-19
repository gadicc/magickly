# Rose sigil rules and oracle — 18 November 2026

Status: S0–S2 built on `gate/rose-sigil-oracle` (18 November 2026), not
merged; S3 in part ([stages](#stages)); S4 built on `gate/angel-sigils`
(19 November 2026), not merged. Decided with Gadi
([decisions](#decisions)); the design and the build each reviewed
adversarially ([below](#review-18-november-2026)). Read
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
*The Equinox* and *777* give no drawing rules. Vol. 4 was never renewed
and is public domain in the US, but in copyright elsewhere to the end of
2055 ([plan 091](091-regardie-golden-dawn-copyright.md)), so we cite the
pages and take facts from them, nothing more. No modern source was
checked.

| # | Rule | Source | The engine before this plan (`f63f14eb`) |
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

He draws on the GD rose's places (Kaph's place in #7) with points placed
by hand, so his geometry is no reference. His conventions, checked at
native resolution:

- Start circle, end bar, a bead tangent to the line on a straight pass.
- **One two-lobed wave per adjacent pair**, as Regardie's crook: two lobes
  for every double checked, four for the triples יייאל and הההאל. A
  first-letter repeat is the start circle followed by the wave.
- A doubled letter on a straight pass (#26 האאיה) is **two beads** on an
  unbent line, not a wave.
- His "straight pass" is not consistent: beads at 4.5–6 units off the chord
  in some names, bends at 4.9–5.85 in others. He cannot settle R4's
  tolerance.

His spellings are his own: 10 of the 72 differ from the triads of Exodus
14:19–21 (eight have He for Cheth; one reorders its letters; one ends יה
for אל), and his figures follow his spellings.

### S0: the annotations (18 November 2026)

Two annotators (Opus 5.5 high and Fable 5.2 high), working apart, recorded
every figure's marks per letter; the files stay in
`~/Documents/Magick/RoseSigils/` (`annotation-A.json`, `annotation-B.json`,
`annotation-reconciled.json`). They agree on every mark of all 72
figures. What they found:

- **He prints no rose.** Each page shows only the name's letters spaced
  round a band, with the sigil drawn inside; letters are known by position.
  Fitted (scale and shift) to one shared 22-place layout, his points come
  out as the Golden Dawn rose, within about 0.1 of the outer radius of
  their places (worst 0.22).
- Start circle on the first letter and bar on the last in all 72; every
  revisit (36, in 32 figures) is drawn beside the earlier visit, never on
  it; every wave has two lobes per repeat except #43 (one arch); the two
  triples are four lobes in a row; 13 beads in 12 figures.
- His slips: in five figures from #53 on, Nun is drawn at Gimel's place
  (earlier Nuns are in place), and #70 visits its letters out of order.

Marks compared with the reference plan of each of his spellings (a
preview of S3; placement is not compared): at a 1-unit tolerance 67 of
72 agree, at 3 units 67, at 5 units 68, at 6 units 67. The five
disagreements at 1 unit are all his conventions or slips: a bead for a
revisit on a near-straight line (#7 אכאיה, #72 מומיה), two beads for a
doubled letter on a straight pass (#26, decision 4), the one-arch wave
(#43) and #70's order. A wider tolerance buys #72 and costs #65 דמביה, a
bead on a 47° corner, so the comparison does not argue for widening it.

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

1. **Words.** Split the text on whitespace (JavaScript's `\s`, so a
   no-break or em space splits and a hyphen, maqaf or joiner does not). Map each character of a word
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
solver was the source of most measured instability (cause 7). It is
replaced by rules and a bounded, deterministic search
(`src/sigil/placeSigil.ts`). The first draft here proposed a short fixed
list of candidates for revisits alone; S2 found that not enough, since
ללהאל needs He and both Lameds moved to the edge of their slack, and the
tightened oracle's bar and crook checks need other vertices moved too.

- **Rules.** A first visit sits on its anchor. A revisit sits 3 units
  beside its anchor, square to the stroke into it, on the side farther
  from the visits and strokes already at the place (F1, F3). A noose
  vertex sits on its neighbours' chord at the foot of its anchor, kept at
  least 2.25 units (its loop and a unit of line) from either end, so the
  line stays unbent (R4). A crook's cups and a noose's loop start on the
  outside of the turn.
- **Checks.** Placement judges the figure as O2 does: overlap, clearance
  from vertices and loops, the bar's and the crooks' clearance from other
  ink, loops' clearance from each other, unmarked corners under 12°, a
  crook without room, ink outside the outer ring, a vertex outside its
  slack. A vertex stays a stroke width (1 unit) from strokes of its own
  place, as O2's same-place floor requires; a stroke into or out of a
  noose must keep to the chord (0.01 units). The score is one per failure
  plus how far it misses; a stroke crossing a crook or the bar counts how
  far the crossing must move to clear.
- **Search.** While a check fails, each round tries every move of every
  vertex the failures involve: a crook or noose on its other side, then a
  step of 1.5 or 3 units or to the slack's edge (less 0.05) square to
  its incoming stroke either way, back and forward along it, and on the
  four diagonals. A noose vertex does not move itself; its failures
  involve its neighbours, and a run of nooses in a row is settled
  together onto the chord between the run's outer neighbours, in order
  and spaced for their loops. The move that lowers the score most is made,
  the earliest on a tie, if it gains at least 0.01; otherwise the search
  ends. If failures remain, it starts again from up to ten starts —
  revisits beside, on the other side and towards the layout's centre, at
  3 units and at the slack's edge; then, at the edge, the first letter
  of a revisited place, or a first letter with crooks, drawn 3 units
  ahead or back along its first stroke — skipping a start whose
  positions repeat an earlier one, and keeps the best figure.
- **Budget.** Checking is incremental (the figure's elements are judged
  by pair, and a move re-checks only what it changed), and a budget of
  300,000 units of that work (an element looked at or a pair checked,
  weighted by cups) bounds every word. A text's words share twice one
  word's budget, every new word getting at least an eighth of a budget
  (ללהאל needs about 4%), and a word met again in the same text costs
  nothing; so a text is bounded by two budgets and an eighth for each
  further word. The floor is sized for the names: every one of the 72
  draws clear in any position, but of the random 4–12-letter words that
  draw clear alone, 74 of 356 do not when placed after two words that
  spend their budgets; the engine flags them, so the page says so. Placed words are cached, frozen, 256 per layout and
  profile (by object identity, so a layout or profile must not change
  after first use) and keyed by the budget they were given, so a text
  draws the same figure cold or warm and a keystroke re-places only the
  word it changes. The worst text found, three of the known failures in
  32 letters, renders through the image route in 147 ms cold and 4–18 ms
  warm.
- **Failures.** A figure carries the checks each word still fails
  (`SigilFigure.failures`); the page then says the sigil is drawn best
  effort and may be hard to read (decision 8). The image route draws it
  as it is.
- **Sizes** (`DEFAULT_SIGIL_MARKS`, sigil units): start circle radius
  1.5, cups 2.6 wide (down to 2 on a short stroke) and 1.2 deep, noose
  radius 1.25, bar 4 long, a unit of straight line beside marks. Deeper
  or wider cups read barely better at 125 px and cost feasibility: with
  cups 1.5 deep 12 corpus figures fail, 3 wide and 1.5 deep 17, against 9
  at the time.
- Only `+ − × ÷ √` and comparisons, on inputs quantised to the SVG's
  0.001, so every engine draws the same figure. No continuous optimiser
  and no randomness.

Of the report's 24,271 figures (fixtures, templates, the 72 names, every
pair and triple, the seeded random words of 4–12 letters, every
A‑B‑A‑B‑A, on both roses, and the two kamea stubs), 217 fail, every one a
listed known failure, and the engine itself flags each one
(`SigilFigure.failures`). CI also runs the 3,174 words of 4–6 letters
around the six collinear runs of the rose (במכק, גשפו, האדל and their
reverses), 64 of them known failures. `oracle/engineKnownFailures.ts`
holds 190 entries (a failing gd word also counts on Regardie's rose
when it has no Kaph or Tau). All 72 names and the fixtures pass, and all
but 7 of the 720 random words. The failures:

- **A‑B‑A‑B‑A with A and B at least 55 units apart** (116 entries). Each
  of the three wedges must open about 7° to keep touching ink under
  8 units, which puts the far ends 5.7 units or more apart inside 9.2-unit
  slack discs, and the start circle, the bar and the last stroke then
  conflict. Every closer pair passes and four pairs at 58 units do; a
  random search with 1,500 starts per word found figures for 2 of 21
  sampled, so the class is mostly infeasible under the grammar, not
  proven so.
- **A return along a diameter past its own nooses** (64 entries, all
  vertex clearance): האדלה, הלדאה, כבמכקא; like ללהאל's return with two
  nooses in the way. A random search found a figure for 1 of 6 sampled.
- **Ten others**: four or more visits to one place with crooks among them
  (ללהללהללהל, ללקלטטחללעל), a stroke from a revisit through the crook at
  the place's earlier visit (פגפבאאאפסממ, תזעטצשעעותתת), two returns along
  long diagonals overlapping 8.8 units against 8 (לולוסצצרפ), and one
  crossed crook (וווגוכהז) that a random search can draw but placement's
  starts do not reach.

Words of 13–32 letters, beyond the tested domain, pass in 85 of 100 at
13–17 letters, 26 at 18–22, 1 at 23–27 and none at 28–32 (the report's
seeded set, both roses). The 72 names' and the templates' drawings are
pinned by a digest under the image profile, so any change to them must
bump `ROSE_SIGIL_IMAGE_PROFILE`.

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
collapsed) changes no existing link. The contract keeps a text spelled as
Hebrew writes it, a final form at the end of a word of two letters or
more and nowhere else (מטטרון, not the folded מטטרונ it kept before), so
the page shows a shared sigil as it was typed; a link in the old spelling
still parses and draws the same sigil.

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
  roses, and every A‑B‑A‑B‑A (462 pairs; on Regardie's rose only those
  with Kaph or Tau, the rest being the same figures). The old solver did
  all 10,648 triples in 3.5 s, so nothing needs sampling.
- **Seeded random words** of 4–12 letters (40 a length, seed 88, runs of
  at most three and at most four visits to a place, with repeats and
  returns weighted up) and two domain-edge words, in CI; 13–32 letters in
  the report only, as beyond the tested domain.
- **Kamea stubs**: a grid layout with Zazel (7, 1, 7, 3) and
  Taphthartharath (40, 8, 40, 20, 40, 20, 40) from vol. 4, pp. 79–80
  (leaves n73–n74; the figures are on p. 81, n75, and p. 85, n79), so
  the layout-agnostic claim is tested in S1, not asserted.
- **Domain**: the contract accepts up to 32 letters; the grammar covers
  at most 2 crooks at a vertex and 4 visits to a place, and the tested
  domain is words of up to 12 letters (decision 8).

### Measuring accuracy

`pnpm sigils:oracle` runs every check over the whole corpus and writes a
report to `output/sigil-oracle/` (gitignored): per rule, how many cases
it applies to and how many pass; per name, which checks fail; each
failure as a known failure or a regression, and known failures that now
pass; the beyond-domain words apart; contact sheets of the 72, the
hardest triples and R4's borderline vertices. With
`SIGIL_ORACLE_EXTERNAL` set it adds O4, writing its per-figure comparison
in that directory only. The Vitest suites carry a known-failures list that may
only shrink. Plan entries record counts and a few decisive examples, never
per-figure annotations of Vaughan's work.

## Stages

| Stage | What | Gate |
| --- | --- | --- |
| S0 (done) | Vaughan's figures annotated twice, independently, at native resolution (crops, as `scripts/seventyTwoAngels/hebrew.ts` learned for Lenain's Hebrew), and reconciled; `names.json`'s #45 (Samekh, not Shin) fixed | Gadi |
| S1 (done) | Oracle first: layout interface with the rose and a kamea stub, hand fixtures, corpus, O1 reference (written blind), O2 with fixed thresholds and a feasibility proof for the worst case (ללהאל: two strokes and a noose within the slack at Aleph), O3 ink decoder, mutation suite, report script | The oracle flags every row of "What is wrong today" and every mutant, and passes the hand fixtures |
| S2 (done) | `planSigil`, rule placement, renderer; R2 (words) in the package, page and contract; the golden tests that pin today's squiggles and one COBYLA layout (`roseSigilGeometry.test.ts:101-113`, `147-156`, `291-306`) replaced by O1–O3; `points` deprecated, the optimiser retired (decision 7); a contact sheet of every corpus vertex 0.5–3 units off its chord, drawn at 1 unit, for judging R4's tolerance | O1–O3 green on the exhaustive corpus, O2 including the 1-ulp check; the image route's cache key changes with the drawing |
| S3 (built) | O4 against Vaughan; disagreements classified and counted here. Marks compared (67 of 72 agree, [S0](#s0-the-annotations-18-november-2026)); the side-by-side sheet is built, outside the repository ([S3](#s3-the-side-by-side-sheet-19-november-2026)) | Gadi reviews the side-by-side sheet locally |
| S4 (built) | The 72 angels pages: sigils rendered at build, cached, linked to `/gd/sigils?text=…`; caching and SEO decided then | [Its own section](#s4-the-angels-pages-19-november-2026); Gadi reviews the decisions |
| S5 (later) | Kamea profile and layout on `Kamea`. What S1 found: Zazel's figure (p. 81) has a circle at both ends and no bar, Taphthartharath's (p. 85) neither circle nor bar, and both draw a return to a cell as a rounded U beside the outgoing stroke; p. 85's printed Mercury square swaps three pairs of cells against Agrippa's (none the name uses); a 1-unit noose tolerance is 0.1 cell, which on a 9×9 square catches near-diagonal passes | Its own plan |

`/gd/sigils` is not among the docs screenshots, so no capture is needed.
Below the generator, the page sets out the rules, what Regardie's figures
show and how the generator applies them (`SigilsText.tsx`, in English and
Hebrew), with Regardie's pp. 57–60 linked on archive.org rather than
mirrored: the volume is public domain in the US but in copyright
elsewhere ([plan 091](091-regardie-golden-dawn-copyright.md)), and
`src/sources/mirroredPages.ts` holds only works out of copyright
everywhere.

## Decisions

Settled 18 November 2026. Gadi chose 1, 2 and 7 and said to proceed on
the rest as recommended.

1. **Placement by rule**, with the bounded search described under
   [Placement](#placement-by-rule-not-by-solver), replaces the optimiser
   on the drawing path. (Proposed as a few candidates for revisits; built
   as a larger search, still discrete and deterministic, because ללהאל and
   the clearance checks need other vertices moved.)
2. **Noose tolerance (R4): 1 unit, provisional.** A profile setting. At
   about 1 unit only the seven names ending האל qualify, at Aleph, which
   matches the one attested case (0.23 units); at 5 units מומיה, דמביה and יבמיה join,
   two of them 47° corners. Judged on S2's contact sheet, by us and then
   by Gadi, before it is final. Our reading of the sheet: below 1 unit
   the line is visibly straight with its noose; above it, placement turns
   the pass into a corner of at least 12°, so no figure falls in between.
3. **Runs of three or more**: one crook per adjacent pair (Vaughan's
   reading, consistent with R3).
4. **A doubled letter on a straight pass**: a crook on the unbent line,
   with no noose. The crook already marks the stop that R4's noose exists
   to show; Vaughan's two nooses are his convention, counted in S3.
5. **R2 layout**: words side by side, right to left, in one SVG. (Regardie's
   p. 60 sets its four YHVH sigils left to right, in an English book;
   ours follow the Hebrew.)
6. **End bar**: always, including one-stroke words.
7. **The optimiser leaves the package.** `nlopt-js` is removed as a
   dependency of the package and the app, and the optimiser's source is
   kept in the repository, out of the build, as
   `roseSigilOptimizer.ts.old` for reference. `optimizeSigilPoints` and
   the `gd/roseSigilOptimizer` export go, which is a breaking change for
   the published `magick-components` (0.x, so its next release is 0.4.0).
   `RoseSigilImage`'s `points` prop is kept, deprecated.
8. **Tested domain: words of up to 12 letters.** The contract and the page
   take 32 letters in all; a longer word is drawn best effort, and the page
   says when a figure fails its own checks. (Orchestrator's call, 18
   November, on the beyond-domain rates above; confirmed by Gadi on
   19 November.) The longest word among magick-data's Hebrew names is
   8 letters, the Moon's בתרשיתים; the longest word in the Hebrew Bible
   (Esther 9:3, והאחשדרפנים) has 11. A name written with a maqaf
   (אלהים־גיבור) is refused today and has to be typed with a space.

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

Not checked by anyone yet at that point: six of Vaughan's ten variant
spellings on the figures themselves; about 50 of his figures; Regardie's
renewal status; real Chromium output (the 1-ulp nudge is a proxy). S0 has
since annotated all 72 figures twice.

### Reviews of the build

The oracle (S1) was written by two agents before the engine, the blind
reference planner by an author who never saw `planSigil`, and the engine
by a third agent barred from reading the reference until its own planner
passed the hand fixtures; it then matched the reference on every text.

- **Independent review (Opus 5.5 high)** of the engine at `f755764d`.
  High: the end bar ran into the start circle in seven of the 72 names
  (a word ending beside its start), and strokes could cross a crook or the
  bar, because neither placement nor O2 checked the bar or the cups
  against other ink. Medium: the search was not the one proposed here;
  placement cost grew quadratically (618 ms for 32 letters); the 1-ulp
  check nudged already-rounded anchors and could not fail; nothing tested
  words longer than five letters. The oracle was tightened first
  (`6d4699c9`: bar, crook and loop clearance, nudges before rounding with
  a rounding-margin check on every layout's anchors, a seeded random
  corpus), which put 628 figures on the known-failures list; the engine
  round (`ca793805`–`cf33775e`) brought that to 9, made checking
  incremental with a work budget, and drew each subpath in order, which
  headless Chromium showed the single path had not (the dash restarts at
  every subpath).
- **Final adversarial review (Fable 5.2 high)** of the branch at
  `3e7d9417`. High: a noose drawn through the start circle (אבהאל) passed
  placement, O2 and O3. Medium: short words and A‑B‑A‑B‑A failing outside
  the corpus; the report hiding the known failures; the package's
  Provenance row rewritten under Gadi's old sign-off date. Low: per-word
  cost and caching, `FAR` unscaled, loose ends in the published API,
  stale coverage config, two i18n wordings, R7 not acted on, stale
  counts here, Vaughan figure numbers in this plan, and image pins not
  tied to the image profile. All taken (`e00cc8a8`–`468f6f09`, and this
  revision) except the Provenance date, left for Gadi to re-sign.
- **Second Fable 5.2 (high) review** of the delta to `4d1fb168`. Nothing
  high; the earlier high fixed. Medium: two nooses in a row drew a bent
  line the engine reported clear (1,048 of 3,174 short words around the
  collinear runs failed the oracle silently); same-place clearance,
  relaxed to 0.5, rescued nothing and drew corners into strokes; the
  text budget could leave a later word none (ללהאל drawn broken after two
  hard words). Low: the cache handed out its own objects, the image pins
  covered four drawings, comments and README stale, a margin in units
  unscaled in the oracle, bare i18n ids. All taken (`152e49b0`–`a21a4f4c`
  and this revision).

Still unchecked: Safari and Firefox (headless Chromium only, for the
draw-on); the side-by-side sheet against Vaughan (built since, [S3](#s3-the-side-by-side-sheet-19-november-2026));
Regardie's renewal status (settled since, plan 091).

## S3: the side-by-side sheet (19 November 2026)

With `SIGIL_ORACLE_EXTERNAL` set, `pnpm sigils:oracle` now also writes
`side-by-side.html` into that directory: each of Vaughan's figures,
cropped by `pdftoppm` from the PDF in the directory into its
`side-by-side/` folder, beside our figure of his spelling on the Golden
Dawn's rose, with O4's differences, the annotators' notes and a mark
where his spelling is not the site's. The figures that disagree are
linked at the top. Like O4's files, the page and the crops stay in that
directory, never in `--out` or the repository; without a PDF or
`pdftoppm` the page has our figures alone. The smoke test checks the
page on its made-up annotation. Run on 19 November: 67 of 72 agree, as
in S0; the five that do not are #7, #26, #43, #70 and #72.

## S4: the angels' pages (19 November 2026)

Each of the 72 angels' pages (`/kabbalah/angel/<slug>`) shows its sigil,
served as two static files, with the structured data and sitemap entries
the temple halls have. It follows [plan 062](062-gd-hall-seo.md)'s
decisions 3, 7, 10 and 13. Built on `gate/angel-sigils`, not merged. The
orchestrator decided, for Gadi to review:

1. **Files.** `<slug>-rose-cross-sigil.png` and `.svg` under each page,
   144 in all, prerendered at build by a route handler
   (`src/app/kabbalah/angel/[slug]/[file]/route.ts`, beside the page's
   components; the page itself is in `(public)`, at the same URL) with
   `generateStaticParams` over the 72 and `dynamicParams = false`. Each is
   drawn in process by `renderComponentImage("rose-sigil", …)` from the
   site's spelling (`name.he`), on the Golden Dawn's rose, rose shown; the
   PNG at the contract's raster default, 1,024 pixels square. The headers
   are the halls' (`public, max-age=0, must-revalidate`, an ETag from the
   SHA-256, `nosniff`, an inline `Content-Disposition` with the file
   name). Both files are indexable. `src/seo/angelSigils.ts` names them.
2. **The page.** A "Rose Cross sigil" section after the table: the PNG
   as an `<img>` with its intrinsic size and alt text in our own words
   ("The Rose Cross sigil of Vehuiah, והויה, traced on the Golden Dawn's
   rose of 22 letters"), on the light plate in the dark scheme (plan
   076); a sentence linking the generator with the name in it
   (`/gd/sigils?text=…`, encoded as the generator's own examples are);
   and "Download PNG" and "Download SVG". The new copy, the alt text
   included, is marked for Lingui and translated into Hebrew, though the
   page itself is not translated yet; the section is a small client
   component so that the alt attribute can be. Ariel's golden is
   regenerated for the new text, the only change.
3. **Structured data.** The page's JSON-LD is one graph: the
   `BreadcrumbList` it already had, then an `ImageObject` for the PNG and
   one for the SVG, each `contentUrl` exactly the page's URL for it. The
   caption is the alt text's English, from the same message. Licence,
   credit and notice are those the About page states for every image a
   component draws (CC BY 4.0, "Magick.ly, drawn by magick-components
   (MIT)"), as the halls state them; `isBasedOn` is Regardie, vol. 4,
   p. 57 (leaf n51), the only source of the rules. The SVG has only a
   viewBox, so its node gives no pixel size.
4. **Sitemap.** Each angel's entry lists its PNG and SVG, the PNG first.
5. **API copies.** The `rose-sigil` contract gains `indexed: false`. The
   route already sent `X-Robots-Tag: noindex` for every sigil, because the
   contract is `personal`; the flag records the new reason.
6. **Internal links: held back.** A sentence in the generator's text
   saying every angel's page shows its sigil, linking the list and
   Vehuiah's page, changes `/gd/sigils`'s indexed prose. That moves the
   search catalogue's digest, and `src/search/embeddings/manifest.test.ts`
   and `src/search/semantic.test.ts` fail until the embeddings are
   refreshed with `pnpm search:publish`, a paid call not made here. The
   commit (`46a201bc`, with its Hebrew) is kept on
   `gate/angel-sigils-generator-link`, on top of this branch's fourth
   commit, for Gadi to take with a refresh. Until then the generator
   still links the list, and each angel's page links the generator. The
   list page is unchanged.
7. **Pins.** No new byte pins: the registry's digest over the 72 names
   already holds the drawings under `magickli-rose-sigil-image-v1`. Tests
   hold the 144 files' params and names to the slug table, and the route's
   bytes to `renderComponentImage`'s for Vehuiah.

The search index is unchanged: the angels' pages enter the catalogue by
their titles and descriptions, which S4 leaves alone.

### Commits

| Commit | Change |
| --- | --- |
| 528b9fda | The 144 static files, their route and names |
| 7468e8ce | The section on each angel's page, in English and Hebrew |
| 4373841d | The JSON-LD graph and the sitemap's image entries |
| f4889048 | `indexed: false` on the `rose-sigil` contract |
