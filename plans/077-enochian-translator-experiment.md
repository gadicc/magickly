# An Enochian translator: what an LLM can do with our data — 10 November 2026

Status: draft of 10 November 2026; open questions settled 11 November
2026. Built so far: the grammar notes, the test set, the lookup baseline
(A1), the answer checker, the scorer, the bars with the code that
measures them, the model runner and the judges' step (11 November, not
yet run at scale). Read [current status](000-current-status.md) first; this
plan tests the long-term goal recorded there ("a small neural network for
translating between Enochian and English") before anyone builds it.

## The question

Can a current LLM, given our dictionary, the Keys and notes on how the
language works, translate between Enochian and English well enough to put
in front of readers? If it can, the translator is an LLM call with our data
in its prompt and a script that checks its answer, and the neural network
is shelved. If it cannot, we learn which part fails (vocabulary, grammar or
honesty) before spending more.

## What we have (counted 10 November 2026)

From `packages/magick-data/src/enochian/` after plan 073:

| | Count |
| --- | --- |
| Dictionary entries | 1,911 (meanings from WE, EMPM and the Keys) |
| Key rows | 1,112 in 19 Keys |
| Rows with Casaubon's word and Dee's English | 1,055 |
| Distinct words in those rows | 663 |
| … that have a dictionary entry under the same spelling | 533 |
| … that occur in only one Key | 578 |
| Running words also found in some other Key | 463 of 1,055 (44%) |

The test set's script counts after folding spelling (case, U/V, I/J,
hyphens), so its figures differ a little: 659 distinct words, 550 with
an entry, 569 in only one Key, and 472 running words found in some other
Key (`data-counts.json` in its output).

The dictionary as `WORD<TAB>meaning [source]; …` is 64,533 characters,
and the Keys as `word<TAB>english` rows about 18,000 more; both fit in
one prompt (roughly 25,000 tokens) with room to spare.

**What the counts mean.** The Keys are the only parallel text: about a
thousand words of Enochian with Dee's English beside them. That is several
orders of magnitude short of what neural translation is trained on, so a
model trained or fine-tuned on it would learn the Keys and little else.
And the Keys rarely repeat themselves: over all nineteen, 592 of the
1,055 running words (56%) are found in no other Key. This varies by Key,
though: Keys 14 and 15 share almost every word with others, while
most of Key 19 is its own. WE and EMPM drew many of their meanings
from the Keys in the first place: 466 of those 592 single-Key words
still have a dictionary entry under the same spelling. So testing on a
Key whose words are already in the dictionary measures lookup, not
translation. The design below separates the two, and the thresholds
are set above what lookup alone already scores.

## Outside evidence

Tanzer et al., "A Benchmark for Learning to Translate a New Language from
One Grammar Book" (MTOB, ICLR 2024, arXiv:2309.16575): given one grammar
book, a word list and a few hundred example sentences for Kalamang, a
language with almost no text online, long-context models translated far
better than without them, and later models came close to a person who
studied the same material. Our case is similar in shape and easier in one
way: Laycock observed that Enochian word order follows English closely, so
most of the work is choosing words and forms, not reordering.

## The books (local copies, never in the repository)

Gadi's copies are in `~/Documents/Magick/Enochian/` and
`~/Documents/Ebooks/` (`Kindle-PDF/`, and `Kindle/` for vol. II). All are in
copyright except as noted; per the repository's rules, none of their text
enters the repository, prompts we ship, or committed results. Facts taken
from them (a word, its meaning, a rule) may, in our own words, with a page
reference.

| Book | File | Use here |
| --- | --- | --- |
| *The Whole Enochian Dictionary* (anonymous) | `Magick/Enochian/`, 81 pp., text | Already our "WE" source |
| Schueler, *Enochian Magic: A Practical Manual* | `Magick/Enochian/`, 146 pp., text | Already our "EMPM" source |
| Laycock, *The Complete Enochian Dictionary* | `Magick/Enochian/`, 145 pp., text | Grammar notes (its introduction; grammar terms cluster on pp. 24–38 of the PDF); cross-check of meanings |
| Leitch, *The Angelical Language*, vol. I | `Ebooks/Kindle-PDF/`, 383 pp., text | History, Loagaeth, the reception of the Keys. Almost no grammar. A finding aid for words Dee was given outside the Keys |
| Leitch, *The Angelical Language*, vol. II (lexicon) | `~/Calibre Library/Aaron Leitch/…(36)/…htmlz` | The best single source on roots, affixes and compounds, and the only one with an English → Angelical index. See below |
| Schueler, *Enochian Magic: The Angelic Language Revealed* | `Magick/Enochian/`, 141 pp., scanned images | Schueler's own later system; would need OCR. Low value for translation |
| Crowley, DuQuette and Hyatt, *Enochian World of Aleister Crowley* | `Magick/Enochian/`, 156 pp., text | Crowley's Aethyr visions; little for translation |
| *Enochiana*, Frater Apollonius | `Magick/Enochian/`, 161 pp., text | A private compilation; not in the list Gadi gave. Not used unless he says so |

**Leitch vol. II in Calibre (checked 10 November 2026).** The HTMLZ is
one HTML file: about 80,000 words of Leitch's commentary as text, and
3,181 lines drawn as glyph images (SVG). The image lines are the
entries themselves (headword, pronunciation, part of speech, gloss),
his Key citations, the Loagaeth word tables and an English → Angelical
index near the end. Tesseract reads them cleanly (a sample of 80).
Calibre's PDF export fails because its renderer gives up on the one
huge HTML file after 61 seconds; we don't need a PDF. A script can
OCR every image line and join it with the text around it, yielding
one row per entry: word, pronunciation, part of speech, gloss, Key
references, root and compound notes, and the book's page. That table
is facts, and it stays outside the repository. Where we take a fact
from it, the dictionary cites Leitch as it cites WE and EMPM.

**Extracted 10 November 2026** to
`~/Documents/Magick/Enochian/derived/leitch-vol2/` (its README gives
the method, the source's SHA-256 and the checks): 933 entries (122
compounds) and 366 forms, and Leitch's English index (661 headings,
816 Angelical words). It covers 621 of the 659 Key words (94%; 663 before folding U/V and
I/J); for
495 of 550 comparable words its gloss shares a word with Dee's
English.

Laycock and Leitch are the two that matter. Schueler and the GD-derived
works describe a later tradition. They are kept as labelled sources, as
the dictionary already does, and not used as evidence of what a word
means in Dee.

## Proposal: an experiment, not a product

### Tasks

1. **Enochian → English, a held-out Key.** Translate one Key with that Key
   removed from the context. The input is the Key's Enochian as running
   text in row order. Scored **per Key row**: each Enochian word against
   Dee's English for that row. 614 of the 1,055 rows have several English
   words ("and the Lord"), so a row is the unit, not an English word.
2. **English → Enochian, a held-out Key.** Translate Dee's English back,
   given **row by row**. This leaks where the word boundaries fall, so it is
   easier than real use; task 3 covers running text. The row's form counts
   as correct if it is Casaubon's word or the row's Equinox (1912)
   reading, after normalising spelling (U/V, I/J, case, hyphens). There
   are two more outcomes, each reported separately and not counted as
   correct:
   - **"synonym"**: another form the remaining Keys or the dictionary use
     for the same English. About 230 rows have an English string that the Keys
     render with more than one Enochian form.
   - **"near"**: within two letters of the right form, for forms of five
     letters or more; shorter forms are right or wrong.
   Rows lacking either side (57, of which 49 are in Keys 14–16) are left
   out. That leaves Keys 14–16 with only 17, 18 and 26 scoreable rows.
3. **New English.** About 30 sentences with no answer key: ten of the
   kind a practitioner would want in Enochian, ten everyday ones, and ten
   that use only words attested in the Keys. Drafted with the test set;
   Gadi may edit or replace any. Judged by models (see Scoring), since
   there is no answer key and no Enochian expert on the project yet.

Tasks 1 and 2 run twice:

- **Open book**: the dictionary stays whole; only the held-out Key's rows
  leave the context. This is the realistic case: text made of known
  words. It tests choice of sense, form and order.
- **Closed book**: the dictionary entries for the held-out Key's words
  that occur in no other Key are removed too. The model cannot know those
  words. The right answer is "unknown", or a guess from a known root,
  marked as one. This tests honesty and morphology. The list is computed
  per fold from `keys.json5`. Removal goes beyond same spelling: an entry
  goes if its headword matches after normalising (case, U/V, I/J, hyphens,
  spaces), or if one contains the other and the shorter is at least four
  letters long. A headword found in any of the remaining 18 Keys is
  never removed: 105 such headwords, in 180 rows of the other Keys,
  would otherwise be caught by the containment rule while still counted
  as knowable (`exemptions.tsv` in the test set's output).
  Without the wider rule, about 180 rows would still find a variant
  headword glossed with Dee's word. The test set lists every removal so
  it can be audited. Closed-book scores are reported in two parts:
  - accuracy on the rows still knowable,
  - precision and recall of "unknown".
  A single accuracy figure would mislead. In Key 19, for instance, 117 of
  163 rows become unknowable.

A0 has no context, so it runs once per task, not open and closed. It
also runs a **recall probe**: given a Key's number and first line, recite
its English, and then its Enochian. A Key is **flagged** when either
recital gets at least half its rows right in order. Results are reported
separately for flagged and unflagged Keys. If fewer than five Keys are
unflagged, the A2c threshold below can't be tested. The result is then
reported as "memorised: can't separate memory from use of the context",
and no build decision is made on these data alone.

### What each answer must look like

Structured output, one item per word:
`{source, target, basis: "attested" | "derived" | "coined" | "unknown",
ref}`. Here `ref` names a dictionary entry or a Key row in the context.
A script checks every item marked "attested":
- `ref` must exist in the context;
- its word must match the Enochian side after normalising;
- its meaning (or the Key row's English) must share a content word
  with the English side, after stemming and normalising archaic
  spelling ("Raign" → "reign").

An item that fails the first two checks is an **invention**. An item
that fails only the third goes to the judge.

Items marked "derived" or "coined" are never inventions; they are
scored on whether they are right. This matters in open book: 125
distinct words found in only one Key have no dictionary entry, so when
their Key is held out, a right answer for them can only be derived.
Inventions marked as such are the behaviour we want, and are counted
separately from silent ones.

### Arms

| Arm | Context |
| --- | --- |
| A0 | Nothing: what the model already knows |
| A1 | No model: a script glosses each word with its first dictionary meaning, and reverses the index for English |
| A2 | Our data: the dictionary and the other 18 Keys |
| A2c | A2 with every Enochian form in the context and the test (headwords, pronunciations, Golden Dawn forms, Enochian quoted inside meanings) under one fixed letter substitution |
| A3 | A2 plus grammar notes we write ourselves from Laycock and Leitch: rules, not text, with page references. Each fold drops the notes' examples taken from the held-out Key |
| A4 | A2 plus the books themselves (Laycock, Leitch vol. II). Local only, never a design for production |

A0 and A2c are there because the Keys and their translations are all over
the web. If A0 already scores well, the model remembered the Keys. A2c
hides the Enochian forms from that memory, so A2c and A2 together show
how much is real use of the context. A2c has limits:
- **Dee's English isn't hidden.** In task 1 the other 18 Keys identify
  the text, so a model may recall the missing Key's English.
- **The cipher can be worked out.** In task 2 a model could recall the
  real Enochian and then apply a cipher it infers from 1,900 enciphered
  headwords.
So A2c counts for the decision only in task 1, and only together with
the recall probe.

A4 isn't a clean ceiling either: the books print the Keys with their
glosses, the held-out one included. It answers a narrower question: do
the books add anything our data and notes lack? If A3 comes close to
A4, our own notes carry what the books add, and production never needs
the books.

### Models and budget (settled 11 November 2026)

The cap is **$100** for the whole experiment. Prices checked 11 November
2026, per million tokens in/out: Opus 5.5 $4/$20, Fable 5.2 $8/$40,
Sonnet 5.5 $2/$10, GPT-6.1 Sol $2/$10; the Batch API halves them. Every
call goes through Vercel AI Gateway (below).

- **`anthropic/claude-opus-5.5` does the main run** on all 19 Keys: A2 and A3 in
  both directions, open and closed book (152 calls); A2c in task 1, open
  book only (19); A0 once per Key and direction, plus the recall probe
  (57). That is about 230 calls. Everything goes through
  the Batch API, because results aren't needed within the hour. Each
  prompt puts the dictionary first, so it can be cached across folds,
  and the other Keys after it. Cache hits inside a batch aren't
  guaranteed, so the estimates assume none. Output, mostly thinking, is
  the costly part: the first fold runs at `high` and at `medium` effort,
  and the sweep uses `medium` unless `high` is clearly better.
- **Five Keys, fixed now: 3, 6, 9, 12 and 18.** They are spread through
  the Keys, each has at least 37 scoreable rows, and none is one of the
  thin Keys 14–16. The arms below run on these five only.
- **A4 (the books) runs on Opus only.** At about 270,000 tokens a call
  it is the most expensive arm. Before running it, check whether a
  prompt that long is charged more.
- **`anthropic/claude-fable-5.2` runs A3** to show the ceiling. Further Fable runs
  only for a specific question, within the cap.
- **A3 on Opus runs a second time on the five Keys**, to measure how
  much scores vary from run to run. The thresholds use the first,
  full 19-Key run; the second only sets how big a difference counts as
  noise.
- **Task 3** runs on Opus with A0, A2 and A3, and on Fable and GPT-6.1
  with A3.
- **OpenAI `openai/gpt-6.1-sol` at high effort makes occasional checks**, so
  the results aren't one model family's opinion of its own work. It
  runs A3 on the five Keys and is the second judge (see Scoring).
  It never receives the books (A4). It goes through the same gateway
  as the Claude calls. OpenAI's Astra is held for one special case if one
  arises, not planned.
- **Sonnet 5.5 and Haiku 5.5 wait** until Opus passes; they are the
  cheaper production candidates, tested in a later round.

Rough allowance within the $100, batched:

| Part | Allowance |
| --- | --- |
| Opus A0–A3, 19 Keys, and the A3 repeat (about 250 calls; input about $20, the rest output) | $50 |
| A4 on five Keys | $15 |
| Fable A3 on five Keys | $12 |
| GPT-6.1 (A3 on five Keys and judging) | $10 |
| Task 3, round trips and Opus judging | $10 |

At `high` effort, output alone could exceed the Opus allowance (10,000
to 30,000 thinking tokens a call), which is why the sweep defaults to
`medium`. The first Key runs alone. If it projects past $100, the run
stops and the plan is cut before the rest.

### Scoring

Task 2 is scored by script (see Tasks). Task 1 is scored by script
first, and model judges handle the rest. Task 3 is scored by model
judges, because Gadi doesn't read Enochian and there is no expert on the
project yet:

- **Task 1 has an answer key** (Dee's English). A row is correct by
  script if the answer shares a content word with Dee's, after stemming
  and normalising archaic spelling. Where Dee's English is only function
  words ("is", "as", "I"), the answer must use the same set of them
  ("unto you" matches "to you"). Rows the script can't
  settle go to the judges, who also check near-synonyms. A row the
  judges disagree on counts as wrong, and the number of such rows is
  reported, so the true score is somewhere between that figure and that
  figure plus those rows. Gadi reads a random tenth of the judged rows
  for obvious misjudgements, which needs English, not Enochian.
- **Two judges from different model families.** Every row or sentence
  that reaches a judge is judged by both GPT-6.1 and Opus. Neither
  family is the only judge of its own work, and agreement between the
  judges is reported.
- **Task 3 has no answer key.** Each judge gets the English, the
  translation, its word-by-word basis and our dictionary, and scores
  against a short rubric: words exist with the meaning used, inventions
  are marked, the forms follow the grammar notes, and the meaning is
  preserved. A round trip adds evidence that isn't a judge's opinion: a
  separate call, with no sight of the English, translates the Enochian
  back using only the dictionary, and the two English versions are
  compared.
- **Expert queue.** Anything the judges disagree on, and anything only
  an Enochian expert could settle, goes to a list (see "For an expert"
  below) instead of being decided by a model.

For every arm we report row accuracy (open book; closed book as above),
silent inventions per 100 rows, marked inventions, and "unknown"s that
were in fact knowable. Each figure is given in three ways:
- pooled over all scoreable rows,
- per Key, with the spread,
- separately for the "hard" rows, where A1's lookup is wrong.
Nineteen folds is a small sample, and the five-Key arms smaller still,
so differences of a few points between arms are noise.

### Thresholds (settled 11 November 2026)

The numbers live in one place,
[`src/app/enochian/translate/bars.ts`](../src/app/enochian/translate/bars.ts):
the experiment's results are checked against it (`measureBars` in
`scripts/enochian-translate-eval/bars.ts`, once the runner and the
judges' step exist), and the translator page, if one is built, shows the
same bars beside the measured figures. A bar that can't be measured on
the results (say, too few Keys left once memorised ones are set aside)
shows why, and is never counted as met. The list
below quotes it word for word; `bars.test.ts` fails if they differ, so
a bar changes in the code and here together, with a new date.

Build the LLM translator if all of these hold:

- **Enochian to English: at least 90% of rows right.** Arm A3, open
  book, pooled over the 19 held-out Keys. A row is right when it shares
  a content word with Dee's English (where his English is only words
  like "of" or "I", when it uses the same ones), by script or by both
  judges; a row the judges disagree on counts as wrong.
- **Enochian to English: at least 50% of the rows that word-by-word
  dictionary lookup gets wrong.** Arm A3, open book, on the rows where
  A1 (lookup, no model) is wrong: wrong by script, or sent to the judges
  and not accepted by both.
- **English to Enochian: at least 75% of rows right.** Arm A3, open
  book, pooled, given Dee's English row by row. Right means Casaubon's
  form or the Equinox reading after normalising spelling; synonyms and
  near misses don't count.
- **With the Enochian scrambled, Enochian-to-English accuracy drops by
  at most 10 points.** A2 minus A2c (the same context under a letter
  substitution), task 1, open book, pooled over the Keys the recall
  probe does not flag. It needs at least five unflagged Keys.
- **At most 2 unmarked invented words per 100 rows, in every task.**
  Arm A3, open book. Words given as found in our data that aren't: the
  reference is missing or not in the context, it isn't the word being
  translated, or the word isn't in the input at all. Counted per 100
  scoreable rows (in task 3, per 100 English words); unreadable
  references are counted apart. The worst of the three tasks counts.
- **New English sentences: both judges accept at least two thirds.**
  Task 3, about 30 sentences, arm A3; judged by Opus and GPT-6.1 against
  the rubric, and a sentence counts only if both accept it.
- **New English sentences: translating back keeps the meaning of at
  least two thirds.** A separate call translates the Enochian back using
  only the dictionary, and both judges compare the two English versions.

**Why these numbers.** A1, the lookup script with no model, already
scores (11 November 2026, open book) 81.3% in task 1, or 89.1% if
every row it sends to the judges were accepted, and 51.9% in task 2,
with 130 more rows a synonym and 45 near. The first draft's bar of 85%
in task 1, and its margin of 10 points over A1 on the hard rows, could
be met by a model that adds little to lookup. So the bars are set
above what lookup does: 90% overall, so the model keeps the easy rows;
half of the rows lookup gets wrong (115 wrong by script, up to 197 with
the rows A1 sends to the judges), where translation actually happens;
and 75% in task 2, which the first draft had no bar for. The bars were
fixed before any model ran, so they can't be fitted to the results.
Closed book has no bar: it measures honesty about unknown words, and is
reported with the rest.

If only A4 passes, write better grammar notes and rerun A3. If nothing
beats A1, the translator is a better lookup tool (the dictionary's English
search, built in [plan 074](074-enochian-dictionary-search.md)) and the
idea waits.

## Where the work lives

- The test set: generated by a script from `keys.json5` and
  `dictionary.json5`, all our own data. It may be committed.
- The runner: a script under `scripts/enochian-translate-eval/`, run with
  pnpm (`loom.json`'s recorded runner). It calls every model through
  Vercel AI Gateway (`https://ai-gateway.vercel.sh`, model ids such as
  `anthropic/claude-opus-5.5`; the gateway writes versions with a dot), with `AI_GATEWAY_API_KEY` from
  `.env.local` read through `loom env --`; no key is ever committed. It keeps a running cost total and stops at the cap. It is a
  development tool only: nothing in the app calls a model. Its budget
  check and cap read one ledger in one output directory, as one process
  sees it, so runs must never be concurrent and must all share one
  `--out` (the default).
- The judges' step (built, `judge.ts`): folds both judges' verdicts into
  the scores before any bar is measured, and `measureBars` refuses a
  task-1 report with rows still waiting for them. A row both judges
  accept becomes correct; one both turn down is "rejected", and one they
  split on is "split"; both count as wrong. A1's to-judge rows are judged
  once the same way (`judge-a1`), since they decide which rows are hard.
- The grammar notes for A3: a Markdown file beside the dictionary, in our
  own words, each rule with its page in Laycock or Leitch and, where Dee's
  text shows it, a Key row as an example. It is committed: facts and
  citations, like the dictionary.
- Raw model output: outside the repository, because A4's could echo the
  books. The plan records only the scores and a few short examples, never
  from A4.
- Book citations, in the notes and the dictionary, give the edition
  (publisher and year) beside the page.

How the books are read: by scripts that extract the facts needed (a page
range's rules, a word's entry), never by printing or quoting long
passages into an agent's context. That once ended an agent's run on
21 October 2026, and it is against the repository's rules anyway.

## If it works: the shape of the translator (a later plan)

- A page, `/enochian/translate`, and a route that sends the reader's text
  with our dictionary, Keys and grammar notes as a cached prompt, and
  asks for the structured answer above.
- The same checking script runs on the server before anything is shown.
  Every Enochian word links to its dictionary entry or Key row. Coined and
  derived words are marked as such.
- The page says plainly that translation beyond the Keys is
  reconstruction, and that the text is sent to Anthropic.
- The page shows how accurate the translator is and where it falls
  short: every bar from `src/app/enochian/translate/bars.ts` beside the
  figure measured for the model it uses, lookup's figure for comparison,
  the closed-book honesty figures, the date and the model. The figures
  come from a small results file the runner writes beside `bars.ts`
  (numbers only, no model output), so the page never states a number by
  hand. A bar the model in use hasn't been measured against shows as
  "not measured", never as met.
- It builds on the dictionary's English search
  ([plan 074](074-enochian-dictionary-search.md)), which becomes its
  lookup step, and serves the "enochian translator" search target of
  [plan 071](071-on-site-search.md).
- Costs: rate limits per visitor and a monthly cap.

## Also found: words outside the Keys

Leitch vol. I collects the meanings Dee was given in his journals for
words outside the Keys: Loagaeth table titles and names glossed during the
sessions. Those are parallel text we do not have. Taken from the
public-domain primary (Casaubon 1659, page and leaf, as plan 073 does),
with Leitch only as the finding aid, they would extend both the
dictionary and the test set. This is a separate follow-up, not part of
the experiment.

## For an expert

Gadi knows an Enochian expert who might consult. The expert is **not a
blocker for the experiment**. Tasks 1 and 2 have Dee's text as the
answer key, and the build-or-not decision rests on them and the
thresholds above. The expert is a gate **before a translator is shown
to readers**: the later product plan cannot ship without their review of
a sample. Whether to bring them in earlier is decided again when the
results are in. Until then, questions only an expert can settle go on
this list, which the experiment adds to as it runs:

- Task 3: the sentences the two judges disagree on, and a sample of
  those both accepted.
- Derived and coined words: are the forms plausible by the grammar
  notes, or do they just look like Enochian?
- Glosses where Leitch and Dee's English disagree (about 55 of the 550
  comparable Key words).
- Each rule in the A3 grammar notes, especially those resting on a
  single example in the Keys.
- Where the Golden Dawn reading of a word differs from Dee's, which one
  the translator should prefer by default.

## Settled questions (11 November 2026)

1. Leitch vol. II: extracted to
   `~/Documents/Magick/Enochian/derived/leitch-vol2/` (10 November).
2. Thresholds: as proposed, then raised above lookup once A1 was
   measured (see "Thresholds"). The "Gadi accepts" test became judges
   plus a round trip, because Gadi doesn't read Enochian. They live in
   `bars.ts`, so the plan, the scorer and the page can't drift apart.
3. Budget: $100, mostly Opus 5.5 with limited Fable 5.2. See "Models
   and budget".
4. Spelling: scoring accepts Casaubon's spelling and the Golden Dawn
   form after normalising. What readers see is decided in the product
   plan, not here.
5. Judging: by models, cross-family, with an expert queue. Gadi checks
   a tenth of task 1 for obvious misjudgements and may edit the task-3
   sentences.
6. Providers: mostly Claude. OpenAI `openai/gpt-6.1-sol` (high) for occasional
   checks and as second judge, never with the books. Astra only as a
   one-off.

## Risks

- **Memorisation.** The recall probe and A2c measure it, and a
  threshold requires A2c to stay close to A2. They don't remove it: Dee's
  English stays visible, and if the model recites most Keys the
  experiment can't separate memory from use of the context (see the
  recall probe).
- **A small test set.** About a thousand words. Differences of a few
  points between arms are noise.
- **Whose Enochian.** Leitch's lexicon includes his own etymologies, and
  Schueler and the Golden Dawn add later readings. Each rule and meaning
  keeps its source, as the dictionary does, so the translator can say
  whose reading it used.
- **Copyright.** Covered above: books stay local, notes are our own words,
  raw output stays out of the repository.
- **Model judges.** Without an expert, task 3 is models grading models.
  Cross-family judging, the round trip and the expert queue limit this.
  They don't remove it, so task 3 alone never decides the build.
- **Expectations.** Beyond the Keys, any translation is reconstruction.
  The experiment measures how honest the model is about that, not only
  how accurate it is.
