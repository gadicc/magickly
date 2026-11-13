# An Enochian translator: what an LLM can do with our data — 10 November 2026

Status: draft of 10 November 2026; open questions settled 11 November
2026; redesigned 12 November 2026 to test on new text, after the recall
probe showed that Opus recites all 19 Keys (see "What the recall probe
found"), and revised the same day after review showed that lookup in
the Keys solves almost all of Dee's text. Built so far: the grammar
notes, the held-out-Key test set, the lookup baseline (A1), the answer
checker, the scorer, the bars with the code that measures them, the
model runner and the judges' step; and for the new text (12 November)
the generator and its set, A1k, the new scoring, task 3's machinery,
the code that measures the new bars, and the page's list of
limitations. Run on the new text 12 and 13 November 2026 (see
"Results"): Opus A3 meets every bar for tasks 1 and 2 and fails three
of task 3's four (acceptance, round trip and attested forms). Spent: $25.74 of the $100.
Round 2 was designed, then stopped by Gadi on 13 November 2026 (see
"Round 2"): under "never coin", English into Enochian is mostly a
lookup problem. The product is planned separately.
Read [current status](000-current-status.md) first; this plan tests the
long-term goal recorded there ("a small neural network for translating
between Enochian and English") before anyone builds it.

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
the Keys as the runner writes them (with row ids and Golden Dawn forms)
36,705 more, and the grammar notes 28,520; together about 130,000
characters, which fit in one prompt (roughly 74,000 tokens, counted
cautiously) with room to spare.

**What the counts mean.** The Keys are the only parallel text: about a
thousand words of Enochian with Dee's English beside them. That is several
orders of magnitude short of what neural translation is trained on, so a
model trained or fine-tuned on it would learn the Keys and little else.
And the Keys rarely repeat themselves: over all nineteen, 592 of the
1,055 running words (56%) are found in no other Key. This varies by Key,
though: Keys 14 and 15 share almost every word with others, while
most of Key 19 is its own. WE and EMPM drew many of their meanings
from the Keys in the first place: 466 of those 592 single-Key words
still have a dictionary entry under the same spelling. So a test made
of words already in our data measures lookup, not translation. The
design below says which of its tests can show more than lookup, and
measures the rest against what lookup alone already scores.

## Outside evidence

Tanzer et al., "A Benchmark for Learning to Translate a New Language from
One Grammar Book" (MTOB, ICLR 2024, arXiv:2309.16575): given one grammar
book, a word list and a few hundred example sentences for Kalamang, a
language with almost no text online, long-context models translated far
better than without them, and later models came close to a person who
studied the same material. Our case is similar in shape and easier in one
way: Laycock observed that Enochian word order follows English closely, so
most of the work is choosing words and forms, not reordering. It is
harder in another: Kalamang was chosen because models hadn't seen it,
and the Keys are all over the web.

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
816 Angelical words). It covers 621 of the 659 Key words (94%; 663
before folding U/V and I/J); for 495 of 550 comparable words its gloss
shares a word with Dee's English.

Laycock and Leitch are the two that matter. Schueler and the GD-derived
works describe a later tradition. They are kept as labelled sources, as
the dictionary already does, and not used as evidence of what a word
means in Dee.

## What the recall probe found (11 November 2026)

The first design (see "The first design: held-out Keys") translated
each Key with that Key taken out of the context, and used a **recall
probe** to see whether the model knew the Keys anyway: given a Key's
number and first line, recite its English, then its Enochian. A Key is
flagged when either recital gets at least half its rows right in order.

Opus 5.5 (medium effort) was flagged on **all 19 Keys**. It recited
Key 1's English 84 rows of 87 in order and its Enochian 83 of 85, Key 2
50 of 51 and 50 of 52, and Key 19's Enochian 149 of 162. The lowest was
Key 15, 16 of 31 English rows, with its Enochian reply blocked. Five of
the 38 replies were blocked by the provider's content filter and count
as incomplete; every Key is flagged without them. The probe cost $1.24
(run `20261111-141524-probe-opus-37be`, outside the repository).

So holding a Key out of the context tests nothing: the model brings it
back from memory, and the cipher control (A2c) can't help, because the
first design needed at least five unflagged Keys and there are none. The
experiment therefore tests on **text the model has never seen**, built
from our data (below). Swapping words in Dee's clauses isn't enough on
its own, as the review below found, because lookup in the Keys still
answers them.

The held-out-Key code stays: a cheaper model that does not recite the
Keys (Sonnet 5.5 or Haiku 5.5, in a later round) can still be tested
that way, and the probe, at about $1 a model, says whether it can.

## Proposal: an experiment, not a product

### What a test with an answer key can show (reviewed 12 November 2026)

Dee's English is the only answer key, and Opus knows it. Hold a Key out
of the prompt and the model recalls it; leave the Keys in and a script
can look the answer up. With all 19 Keys in the prompt, giving each word
its commonest gloss in the Keys is right on 1,029 of 1,055 rows (97.5%)
into English, and giving each English row its commonest form is right
on 996 (94.4%) into Enochian. That lookup also solves 176 of the 197
rows that dictionary lookup (A1) gets wrong. Swapping words between
clauses doesn't change this: the swapped-in word's own Key row is in the
prompt too.

So on Dee's words the experiment can show only that the model is **no
worse than lookup, honest, and not misled by memory**. Made-up words
whose meaning exists only in the prompt's dictionary show that it reads
the prompt rather than its memory, though lookup reads them too.
Whether it does **more than lookup** is tested where no lookup can
reach:
- **new joins**: words built by the grammar notes' rules that occur
  nowhere;
- **task 3**: new English, compared with what lookup produces for the
  same sentences.

### The new text (built by script, before any model runs)

About **60 sentences, 600 rows**. Each sentence joins two passages from
different Keys: runs of three to eight consecutive rows, ending where
Dee's English has a stop (`;`, `:`, `.`, `?`) where possible. The Keys
break into 103 such clauses (median 7 rows); longer ones are cut into
runs. Every Key gives at least one passage, no row is used twice, and
Key 19's Aethyr-name slot is never used. A little over a third of the
rows are changed:

| Rows | About | What the key is |
| --- | --- | --- |
| Unchanged | 380 | Dee's English and Casaubon's word (or the Equinox reading) for that row |
| Swapped | 120 | The same, for the row the swapped-in word came from |
| Planted unknowns | 40 | "unknown": the word exists nowhere |
| Planted knowns | 20 | The meaning given in the prompt's dictionary and nowhere else |
| New joins | 40 | Both parts' meanings, in turn |

About 50 of the rows are given in their Golden Dawn spelling, since
readers paste those.

**Swaps.** A row is replaced by a row from another Key whose English
has the same shape: a noun phrase for a noun phrase ("the seats" for
"the horns"), a verb for a verb. Rows that are only function words
("and", "are", "of") are never swapped. A word may be swapped in only if:
- every gloss Dee gives it agrees, by the scorer's rule (13 of the 75
  words that occur more than once fail this, among them QAA, OTHIL,
  CAOSG, FAFEN and OL);
- its English maps to that one form in the Keys, so task 2 has one right
  answer (84 candidate rows fail this);
- the dictionary's meaning agrees with Dee's gloss (45 words fail);
- no sense of it shares a content word with the gloss it replaces.

Words with no dictionary entry are allowed, since their Key rows are in
the prompt. That leaves 588 rows of 474 words, of which only 48 words
(162 rows) occur more than once; the rest occur once. Each word is
swapped in once at most. Results on the two kinds are reported apart.
Any gloss Dee gives the word counts as right, and the judges see every
attested sense.

**Planted unknowns.** Made-up words, four to eight letters, built from
the letter pairs Enochian uses. A simple distance rule isn't enough: of
4,000 such words that are two letters from every form in our data, half
are "near" a real form by the scorer's own rule, and about a quarter
split wholly into real forms, so a model could fairly derive a meaning.
A plant must therefore be:
- at least three letters from every form in our data (headwords,
  Casaubon's words, the Golden Dawn's forms);
- free of any attested form of three or more letters inside it;
- not splittable wholly into attested forms of two or more letters
  and the small words of G26 ("DS", "I" and the like);
- not within one letter of any form after folding C/K, I/Y and U/V/W.

About a quarter of candidates pass. A one-off check against Leitch's
lexicon (local, private) is recorded with the set. In task 2 the plants
are English words nothing in our data translates, checked against every
meaning and Dee's English: some everyday ("bicycle"), some in the Keys'
register, chosen by script where no form exists ("lantern" and
"harvest", for instance, both have one).

**Context-only rows.** Two kinds:
- **20 planted knowns**: made-up words built by the same rule as plants,
  given an English meaning as ordinary entries in the prompt's
  dictionary, in alphabetical order with the rest; only the test-set
  files mark them. Their meanings are plain nouns of the Keys' register
  that our data lacks (a vessel, a garment, a tool, a plant, a part of
  a building: "ewer", "jerkin", "auger", "rowan", "rafter"), since
  modern words would stand out. Like the real entries they carry a
  source tag ("WE"); that tag is false, and exists only in the test
  prompt. No model can know them, so A0 should score at most
  one: they test whether the model reads the prompt rather than its
  memory. Lookup over the same prompt gets them too, so they don't show
  more than lookup. Their meanings share no word with the task-2 plants.
  The answer checker's context includes them. Task 3, its round trip
  and its judges use the prompt without them, so a made-up word can't
  be used there for its English.
- **40 new joins**: a small word joined to an attested word by the
  grammar notes' rules (G26, "small words join the next word", and G27,
  "a shared letter is written once"), where that join is attested
  nowhere: for example DS "which" or CHIS "are" before a word that
  never takes it in the Keys. Of 4,656 such joins, 84 are attested and
  are left out, and a join is used only if it splits into attested
  parts in exactly one way and has no form within one letter of it;
  1,056 remain. That rule rules out every join with a one-letter small
  word (I "is", L "one"), since such a join is always one letter from
  its base, so the joins use CHIS, OI, AG, DS, AR and TA. A join is
  right only when both parts are rendered. In task 2, the joined or the
  separate forms both count (G30: word boundaries differ between
  copies). This is the only test where neither lookup nor memory has
  the answer, and the only place the grammar notes can show an effect.

Fable and GPT-6.1 run on 300 rows (below), so the generator puts every
planted known and new join into the first 30 sentences, which are
therefore about 40% changed. The 150 rows for Opus's repeat runs are
also fixed by the seed.

**Review.** Gadi reads the English of all 60 sentences, changes
included, and rejects any that can't be read as English at all. They
need not make sense; Dee's own often barely do. The script, its seed and
the generated set are committed: they are our own data.

### Tasks

1. **Enochian → English, the new text.** The input is each sentence's
   Enochian as running text. Scored per row against the answer key: a
   row is right when it shares a content word with the key's English,
   after stemming and normalising archaic spelling; where the key is
   only function words, the answer must use the same set of them. For a
   swapped row, an answer that agrees with any gloss of the replaced
   word (its row, its other rows, its dictionary entry) and not with the
   key is **"recalled"**: wrong, and counted apart.
2. **English → Enochian, the new text.** The same sentences, given row
   by row in English. This leaks where the word boundaries fall, so it
   is easier than real use; task 3 covers running text. Right means the
   key's Casaubon form or Equinox reading after normalising spelling.
   "Synonym" (another form our data uses for the same English) and
   "near" (within two letters, for forms of five letters or more) are
   reported and don't count. "Recalled" isn't scored here: the model is
   shown the swapped-in English, so recall can't mislead it.
3. **New English.** About 60 sentences with no answer key: 20 of the
   kind a practitioner would want in Enochian, 20 everyday ones, and 20
   that use only words attested in the Keys. Drafted with the new text,
   before any model runs; Gadi may edit or replace any. Judged by models
   (see Scoring), and also translated by lookup (A1) for comparison.

Every model sees the whole of our data: nothing is held out, so one
context serves every call and can be cached. Each task is sent in parts
of about 75 rows, broken at sentence ends.

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
that fails only the third goes to the judge, except on a planted row:
a plant marked "attested" is a silent invention by rule, in either task.

Items marked "derived" or "coined" are never inventions. On a planted
unknown, "unknown", "derived" and "coined" all pass and are reported
apart; a "derived" answer must cite a ref of three letters or more
whose form is actually inside the word, or it is an **unsupported
guess**, which counts against the plant bar like a plant given as
attested. Plants contain no attested form that long, so a derived
reading of a plant is always an unsupported guess: the honest answers
are "unknown" and a coinage marked as one. Elsewhere, derived and
coined items are scored on whether they are right, and the number of
attested rows the model hedges as derived or unknown is reported, so a
model can't pass the honesty bar by hedging everything.

### Arms

| Arm | Context |
| --- | --- |
| A0 | Nothing: what the model already knows |
| A1 | No model: a script glosses each word with its first dictionary meaning, and reverses the index for English |
| A1k | No model: as A1, but it first looks the word (or the English) up in the Keys, matching Casaubon's words and the Golden Dawn's forms, and takes its commonest gloss (or form) |
| A2 | Our data: the dictionary and all 19 Keys |
| A3 | A2 plus grammar notes we wrote ourselves from Laycock and Leitch: rules, not text, with page references |

A1k is the baseline for tasks 1 and 2, because a model with the Keys in
its prompt can do what it does. Its answers go through the judges like
any arm's, and its figure is the judged one: counted generously, it
would be right on every row it can't settle by script. A1 stays for comparison with the first
design. A0 shows what memory alone does. A2 against A3 shows whether the
grammar notes help, mainly on the new joins.

Dropped from the first design: A2c (the cipher) and the closed book,
because the swapped, planted and context-only rows test memory and
honesty directly; and A4 (the books), because on these tasks it would
sit at the same ceiling as A3, and the books can't know planted words.
A4 can return in a later round if the grammar notes fall short.

### Models and budget (settled 11 November 2026, revised 12 November)

The cap is **$100** for the whole experiment, of which $25.74 is spent
(the probe and one test call, $1.33, then lookup's judging and round
trips on the new text and task 3; see "Running order"). Prices checked 11 November 2026, per
million tokens in/out: Opus 5.5 $4/$20, Fable 5.2 $8/$40, Sonnet 5.5
$2/$10, GPT-6.1 Sol $2/$10; batch halves them, and a cached prompt is
read at a twentieth of the input price. Every call goes through Vercel
AI Gateway (below).

- **`anthropic/claude-opus-5.5` does the main run**: A0, A2 and A3 once
  each on all 600 rows, tasks 1 and 2, at `medium` effort. One large
  text gives more distinct items than repeats would; A3 runs a second
  time on 150 rows to measure run-to-run noise, and once at `high`
  effort on the same 150, to see whether `high` is worth its price.
- **`anthropic/claude-fable-5.2` and OpenAI `openai/gpt-6.1-sol`** (high
  effort) run A3 on the first 30 sentences (300 rows), which hold every
  context-only row. GPT
  is also the second judge (see Scoring), so the results aren't one
  model family's opinion of its own work. Astra is held for one special
  case if one arises, not planned.
- **Task 3** runs on Opus with A0, A2 and A3, on Fable and GPT-6.1 with
  A3, and through A1, each with its round trip. Its prompt leaves out
  the planted knowns, so it is cached separately (under $1 more).
- **Sonnet 5.5 and Haiku 5.5 wait** until Opus passes; they are the
  cheaper production candidates, tested in a later round, each after
  its own recall probe.

The prompt is larger than first counted: the Keys as the runner writes
them (row ids and Golden Dawn forms, both needed) are 36,705 characters,
so A2 is about 101,000 characters and A3 about 130,000, roughly 74,000
tokens at the runner's cautious 1.8 characters a token. Output, mostly
thinking, is allowed 12,000 tokens a call at `medium`.

What is left, as the runner projects it (`budget --offline`, 12 November
2026, after steps 1 to 3 of the running order, 180 calls):

| Part | With cache reads | Without |
| --- | --- | --- |
| The cache check (two A3 calls) | $1 | $1 |
| Opus, tasks 1 and 2 (about 40 calls with context, 16 for A0) | $16 | $26 |
| Fable 5.2, A3 on 300 rows | $9 | $13 |
| GPT-6.1 Sol, A3 on 300 rows | $2 | $3 |
| Task 3: five models' translations and their round trips | $12 | $16 |
| Judges, both families (about 330 task-3 translations and 300 round trips, and task-1 rows) | $9 | $15 |
| The one top-up, if needed (see Scoring) | $2 | $3 |
| **Total** | **about $50** | **about $77** |

It leaves out what is done (lookup's judging and round trips); the
judges' check is in it, its 30 candidates among the rubric's. Both
totals fit in the $97.05 left, with
room for blocked parts to be retried. Only the judges' calls have read
from the cache so far: after each judge's first rubric call, about
57,000 of Opus's 63,000 input tokens, and 34,000 of GPT's 39,000, came
from it. No translation call has yet.

### Running order

Every step is done (12 and 13 November 2026). Spent: $25.74 of the
$100, the recall probe and the first test call included.

1. Done: A1 and A1k on the new text, and their to-judge rows judged
   ($0.15).
2. Done: task 3 through A1, its round trips and its judging ($1.46).
   The controls made from A1's translations couldn't be used (see
   "Bars for the new text").
3. Done: the bars settled from those figures, in `bars.ts` and this
   plan, with the date. No model has translated the new text yet.
4. Done: the judges' check ($0.65). Both judges accepted 13 of the 15
   undamaged pairs, so 13 controls count, and they accepted none of
   those 13 damaged copies (wrong word 0 of 4, coinage 0 of 4, dropped
   clause 0 of 5): the task-3 bars can be measured. Of the two pairs not
   accepted, one is a split on BIAB ("stand" or "are"). In the other,
   both judges rejected TILB before IALPOR under G22, which says TILB
   follows its noun. That TILB ends a Key 19 passage ("and her") and
   the pair puts the next passage after it, but Key 19 itself has TILB
   before its noun (OD TILB ADPHAHT DAMPLOZ, "and her unspeakable
   variety"), so G22 was too strong as written. G22 now says TILB also
   stands before its noun, citing that line, and keeps the expert flag.
   The change came after the check and before any model translated the
   new text, so every A3 run and every later rubric judging sees the new
   wording. The rubric's judges saw the old wording in steps 2 and 4;
   those verdicts stand (the grammar notes are not part of a verdict's
   key), so the TILB pair stays uncounted and the controls stay at 13.
5. Done: the cache check ($0.62). The second call read 99.3% of its
   input from the cache, so every run went by sync.
6. Done: Opus A3 on all 600 rows ($1.89, against $4.61 expected with
   cache reads).
7. Done: Opus A0 and A2 ($4.09); the repeat and `high`-effort runs on
   the repeat set ($1.35); Fable ($2.93) and GPT-6.1 ($0.54) on the first 30
   sentences; task 3 on every model ($5.61) and its round trips
   ($1.03); then the judges ($4.09). No call was blocked. No bar was
   marginal, so there is no top-up.

### Scoring

Tasks 1 and 2 are scored by script first; in task 1, model judges handle
the rows the script can't settle. Task 3 is scored by model judges,
because Gadi doesn't read Enochian and there is no expert on the project
yet:

- **Task 1 has an answer key** (above). Rows the script can't settle go
  to the judges, who also check near-synonyms. A row the judges disagree
  on counts as wrong, and the number of such rows is reported. Gadi
  reads a random tenth of the judged rows for obvious misjudgements,
  which needs English, not Enochian.
- **Two judges from different model families.** Every row or sentence
  that reaches a judge is judged by both GPT-6.1 and Opus. A row both
  accept is right; one both turn down is "rejected", and one they split
  on is "split"; both count as wrong. Agreement between the judges is
  reported.
- **Task 3 has no answer key.** Each judge gets the English, the
  translation, its word-by-word basis and our dictionary, and scores
  against a short rubric: words exist with the meaning used, inventions
  are marked, the forms follow the grammar notes, and the meaning is
  preserved. The judges don't know which translations came from lookup.
  A round trip adds evidence that isn't a judge's opinion: a separate
  call, with no sight of the English, translates the Enochian back
  using only the dictionary, and both judges compare the two English
  versions. The round trip is barred only on the practitioner and
  attested sentences (see the bars).
- **The judges are checked.** 15 stretches of Dee's own Enochian from
  the new text go in among the task-3 answers, each with a damaged copy:
  five each of a wrong attested word, an unmarked coinage and a dropped
  clause, made by script with seed 77. A passage qualifies only if all
  its rows are unchanged or swapped, none in the Golden Dawn's spelling;
  38 do (only 7 whole sentences do). The script pairs them by seed, two
  passages from different Keys, joined as the new text joins its
  sentences: the first's rows, then the second's, their English
  joined. No passage is used twice; the 38 make 19 pairs, and 15 are
  used. The original is right by construction: each word is Dee's,
  marked attested, citing its Key row, beside the English the new text
  gives. A wrong word or a coinage replaces the word of a row whose
  English has a content word, keeping the row's English, "attested" and
  Key-row reference, so it reads as a misquote of that row, the way a
  model would slip; nothing in its form sets it apart. A dropped clause
  ends at the last clause end that keeps at least three rows and leaves
  out at least two, or, failing one, keeps the first three fifths. The originals are judged blind like any translation,
  with the same rubric and the same verdict store. A control counts
  only when both judges accepted its original. If fewer than 8 count,
  or the judges accept more than a fifth of those that do, the task-3
  bars can't be measured. The first controls, made from A1's
  translations, are dropped: the judges rejected 13 of their 15
  originals, so only 2 counted.
- **Judging context.** A1's translations were judged first; the
  controls and their originals are judged next, among themselves; the
  models' later, among themselves. Each round sends only what both
  judges haven't ruled on, with the same rubric and the same verdict
  store. No answer is judged beside the others from its sentence, so
  this shouldn't matter, but the figures say so.
- **Blocked replies.** A part the provider's filter blocks is retried
  once; if it is blocked again its rows count as wrong, and the number
  of Opus translation calls blocked is reported against its bar. The
  same holds for a round trip: blocked twice, it is recorded as blocked,
  never asked again, and counts as not keeping the meaning. The probe
  had 5 of 38 replies blocked, and a translator that is often blocked
  is no use to readers.
- **Expert queue.** Anything the judges disagree on, and anything only
  an Enochian expert could settle, goes to a list (see "For an expert"
  below) instead of being decided by a model.

For every arm we report row accuracy, silent inventions per 100 rows,
marked inventions, hedged rows, and "unknown"s that were in fact
knowable, separately for unchanged, swapped (single- and
multi-occurrence), planted, planted-known and join rows, and pooled;
and A3 minus A0 on the swapped rows, which shows how much of that
figure the prompt adds. Each figure has a 95% Wilson interval beside
it. Bars are decided on the counts below, whose power is given; an
interval doesn't decide a bar, since at these sizes it would leave
most bars out of reach. A figure within one row of its bar is
reported as **marginal**. If any bar is marginal, one top-up is
allowed, declared now: 200 more rows of the same mix (20 sentences),
made by the same script with the next seed (78), run once on Opus A3
and A1k, and the bar decided on all the rows together. There is no second top-up.

### Bars for the new text (settled 12 November 2026)

The bars of 11 November (below) were set for held-out Keys and can't be
measured now. The new text has its own, settled on 12 November 2026,
after A1 and A1k were scored on it and before any model translated it.
They live in one file
([`src/app/enochian/translate/bars.ts`](../src/app/enochian/translate/bars.ts)),
are quoted word for word here by `bars.test.ts`, and will be shown on
the translator page beside the measured figures. All are for arm A3 on
Opus:

| Bar | How it is measured | What it shows |
| --- | --- | --- |
| Enochian to English, unchanged and swapped rows: at least 96.8% (484 of 500). | Arm A3 on Opus, task 1, judged; a row the judges disagree on counts as wrong. A fixed figure: A1k's judged 98.8% (494 of 500) less 2 points. | no worse than lookup |
| English to Enochian, unchanged and swapped rows: at least 93% (465 of 500). | Arm A3 on Opus, task 2. Right means Casaubon's form or the Equinox reading after normalising spelling. A fixed figure: A1k's 96.0% (480 of 500) less 3 points. | no worse than lookup |
| Swapped rows right, task 1: at least 90% (108 of 120). | Arm A3 on Opus. Any gloss Dee gives the swapped-in word counts as right. | reads the word in front of it |
| Recalled answers, task 1: at most 5% of swapped rows (6 of 120). | Arm A3 on Opus. An answer is recalled when it agrees with the word that stood there before the swap, and not with the key. | not misled by memory |
| Planted unknowns given as attested, or guessed without support: at most 10% (4 of 40), each task. | Arm A3 on Opus, tasks 1 and 2, each on its own. A derived reading must cite a form of three letters or more found inside the word. | honest about words that don't exist |
| Planted knowns right, task 1: at least 18 of 20 (90%), with A0 at most 1. | Arm A3 on Opus. The knowns are made-up words given a meaning only in the prompt's dictionary. With a top-up pooled in, the line is 90% of all the knowns. A0 is Opus with no context, on the 20 knowns of the main set. | reads the prompt, not its memory |
| New joins right, both parts, task 1: at least 80% (32 of 40). | Arm A3 on Opus. A join is right only when both its parts are rendered. | more than lookup: applies the grammar |
| Silent inventions: at most 2 per 100 rows, every task (task 3: per 100 words given). | Arm A3 on Opus, each task on its own. A silent invention is a word given as found in our data that isn't: the reference is missing or not in the context, or names another word. | honest about its sources |
| Task 3, both judges accept: at least two thirds of all 60 sentences (40). | Arm A3 on Opus, judged by Opus and GPT-6.1 against the rubric; a missing translation counts as rejected. It is measured only if the judges pass the damaged controls. | composes well enough for the judges |
| Task 3, round trip keeps the meaning: at least two thirds of the 40 practitioner and attested sentences (27 of 40). | Arm A3 on Opus. A separate call puts the Enochian back into English with only the dictionary, and both judges compare the two. The 20 everyday sentences are reported but not barred: a coined word can't survive a round trip through a dictionary. | the meaning survives |
| Task 3, content words given an attested form where one exists: at least 90%. | Arm A3 on Opus. A word has a form where dictionary lookup (A1) finds one. A floor: A1 scores 100% by construction. | uses our data when it can |
| Opus translation calls blocked by the provider's filter: at most 5%, counted over every call. | Every Opus translation call in the experiment: the cache check, every task, the repeats, the top-up and the round trips. It is measured once Opus A3 has run on the new text. | usable at all |

A bar is met on whole rows: 484 of 500 meets the first bar and 483
doesn't. A figure within one row of its line is marginal (see Scoring).
A top-up pooled in (see Scoring) moves each line with the rows, the
knowns' too: 90% of 27 knowns is 25. A bar fails closed: with no rows
to measure, or task 3 on other than its 60 sentences (40 for the round
trip), it is unmeasurable, never met. The blocked-calls bar waits until
Opus A3 has run on the new text.

The judges' check: 15 damaged controls, a third of each kind; at least 8 must count, and the judges may accept at most a fifth of those that do, or neither judged bar of task 3 can be measured.

**Which run counts.** Each bar is measured on the first run of its arm.
A part blocked twice counts as wrong and stands (see "Blocked
replies"): a run is never replaced because of blocked parts. Parts
that were never run, or whose call failed in transport (no reply), are
finished in the same run: `run --resume RUN` sends the parts never run,
and `run --retry-failed RUN` sends again every part whose reply didn't
finish normally (a failed call, an error, or a first block, which is its
one retry), but never one cut off at the length limit or blocked twice. A fresh run replaces a measured one
only if this plan records why before its results are seen. The scorer
refuses two runs of one arm on the same set unless one is named with
`--runs`, so no run is chosen among complete ones by its results.

**What they were set from** (12 November 2026, no model run):
- A1k, task 1, judged: 494 of 500 unchanged and swapped rows right
  (98.8%).
- A1k, task 2: 480 of 500 (96.0%).
- A1, task 3: both judges accepted 2 of 60 sentences (3.3%); the round
  trip kept the meaning of 0 of 60; it gave an attested form for 196 of
  the 196 content words that have one, with no silent inventions.

The first two bars are now fixed figures: A1k's less 2 and 3 points.
A1 and A1k are still reported beside the bars, as context.

**Three changes to task 3, made with the bars:**
- **The damaged controls come from the new text.** The first controls
  were made from A1's translations, but the judges rejected 13 of their
  15 originals for wrong senses and omissions, so only 2 counted and 8
  were needed. The new controls are pairs of passages of Dee's own
  Enochian, which are right by construction (see Scoring).
- **The accept bar is absolute: two thirds of all 60 sentences.** It was
  to be A1's share plus 15 points, or 90%. With A1 at 3.3%, that would
  have been 18%, too low to mean anything.
- **The round trip is barred on the 40 practitioner and attested
  sentences only.** A coined word can't survive a round trip through a
  dictionary, so everyday sentences, which need coinages, are reported
  but not barred. The clause "no more than 10 points below A1" is
  dropped: A1 scored 0.

**Power.** On 120 swapped rows, a model that is truly 95% right passes
99% of the time and one that is 85% right passes 7%; on 40 planted
unknowns, one that claims 5% as attested passes 95% of the time and one
that claims 20% passes 8%; on 40 joins, one that is truly 70% right
passes 11% of the time. The two task-3 bars, by the exact binomial:

| Bar | A model truly at 80% passes | At 55% |
| --- | --- | --- |
| Both judges accept 40 of 60 | 99.5% | 4.5% |
| Round trip keeps 27 of 40 | 98.1% | 7.5% |

What a pass means: the model is no worse than lookup on Dee's words, is
honest, isn't misled by memory, reads our data for words it can't know,
applies the grammar to new joins, and writes new sentences that both
judges accept and whose meaning survives the round trip. It does not
mean the Enochian it writes is right: without an expert, nothing here
can show that (see "For an expert").

If the planted knowns and joins pass but task 3 doesn't, the model reads our
data but can't compose: the translator stays a lookup tool with a
model's help in choosing senses. If nothing beats A1k, the translator is
a better lookup tool (the dictionary's English search, built in
[plan 074](074-enochian-dictionary-search.md)) and the idea waits.

## Results (13 November 2026)

The runs, their replies and the judges' verdicts are in
`~/Documents/Magick/Enochian/derived/translate-eval/` (outside the
repository); `newbars --runs` with the three Opus runs named below gives
the bars' table.

| Bar | Opus A3 | Line | Met |
| --- | --- | --- | --- |
| Into English, unchanged and swapped | 493 of 500 | at least 484 | yes |
| Into Enochian, unchanged and swapped | 497 of 500 | at least 465 | yes |
| Swapped rows right | 120 of 120 | at least 108 | yes |
| Recalled answers | 0 of 120 | at most 6 | yes |
| Plants given as attested or guessed | 1 and 0 of 40 | at most 4 each | yes |
| Planted knowns (A0: 0 of 20) | 20 of 20 | at least 18 | yes |
| New joins | 40 of 40 | at least 32 | yes |
| Silent inventions, tasks 1, 2 and 3 | 0, 0 and 0 | at most 2 per 100 | yes |
| Task 3, both judges accept | 18 of 60 | at least 40 | no |
| Task 3, round trip | 9 of 40 | at least 27 | no |
| Task 3, attested forms | 124 of 196 (63%) | at least 90% | no |
| Blocked calls | 0 of 85 | at most 5% | yes |

Runs, in `runs/`: Opus A3 `20261112-153758-newtext-opus-8590`; Opus A0
and A2 `20261113-072537-newtext-opus-c603`; the repeat set at `medium`
`20261113-073228-newtext-opus-a5db` and at `high`
`20261113-073349-newtext-opus-b8f0`; GPT-6.1
`20261113-073524-newtext-gpt-63b8`; Fable
`20261113-073834-newtext-fable-21bb`; task 3
`20261113-074117-task3-opus-13fe`, `20261113-074458-task3-fable-523e`
and `20261113-075416-task3-gpt-3c8d`; their round trips
`20261113-080112-roundtrip-opus-1936`.

**Tasks 1 and 2, every arm** (unchanged and swapped rows, judged; the
knowns and joins columns give task 1, then task 2):

| Arm | Rows | Into English | Into Enochian | Knowns | Joins |
| --- | --- | --- | --- | --- | --- |
| A1k (lookup) | 500 | 494 (98.8%) | 480 (96%) | 20, 20 of 20 | 0, 0 of 40 |
| Opus A0 | 500 | 436 (87.2%) | 346 (69.2%) | 0, 0 of 20 | 13, 0 of 40 |
| Opus A2 | 500 | 494 (98.8%) | 495 (99.0%) | 20, 18 of 20 | 40, 20 of 40 |
| Opus A3 | 500 | 493 (98.6%) | 497 (99.4%) | 20, 18 of 20 | 40, 36 of 40 |
| Opus A3 again, repeat set | 133 | 131 (98.5%) | 132 (99.2%) | 4, 4 of 4 | 8, 8 of 8 |
| Opus A3 `high`, repeat set | 133 | 132 (99.2%) | 132 (99.2%) | 4, 4 of 4 | 8, 7 of 8 |
| Fable A3 `high`, first 30 | 231 | 228 (98.7%) | 230 (99.6%) | 20, 18 of 20 | 40, 39 of 40 |
| GPT-6.1 A3 `high`, first 30 | 231 | 229 (99.1%) | 230 (99.6%) | 20, 17 of 20 | 39, 35 of 40 |

(The repeat set is 154 rows and the first 30 sentences 307; the Rows
column counts their unchanged and swapped rows.)

- Memory. With nothing in its prompt (A0), Opus gives 87% of Dee's
  words in English, as the recall probe predicted. The knowns show the
  context at work: 0 of 20 without it, 20 of 20 with it. The swapped
  rows show less, since A0 already gets 106 of 120 of them right; A3
  minus A0 there is 11.7 points (6.1 to 18.6).
- Grammar. The barred join measure (task 1) doesn't show the notes at
  work: A2, without them, also gets 40 of 40, and A0 gets 13 from
  memory, so the plan's "neither lookup nor memory has the answer" holds
  only for lookup (0 of 40). The notes show into Enochian, where joins
  go from 20 of 40 (A2) to 36 of 40 (A3); that figure has no bar. On
  Dee's own words A2 and A3 are level.
- Noise and effort. The repeat set's second run and its `high` run
  differ from the first run by a row or two. `high` changed neither the
  scores nor, as run, the cost ($0.48, against $0.87 for the `medium`
  repeat, which paid the cache write). Fable and GPT-6.1 score as Opus
  does on the same rows (228 and 229 against Opus's 227 of 231 into
  English, all three 230 into Enochian).
- Lookup. On Dee's own words no model beats A1k by much (98.8% and
  96%); the models' gain is on rows lookup can't do: the joins.
- Judges, task 1. Of Opus A3's 12 judged rows, both judges accepted 5,
  rejected 5 and split on 2. Opus A3 hedged 18 rows into English, all
  in the Golden Dawn's spelling (18 of 50).

**Task 3, every model** (60 sentences, 20 of each kind, both judges
accepting; round trip on the 40 practitioner and attested ones):

| Source | Both accept | Practitioner | Everyday | Attested | Split | Round trip | Attested forms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 (lookup) | 2 | 0 | 0 | 2 | 1 | 0 | 100% |
| Opus A0 | 1 | 0 | 0 | 1 | 2 | 1 | 0% |
| Opus A2 | 16 | 3 | 0 | 13 | 7 | 8 | 57% |
| Opus A3 | 18 | 3 | 0 | 15 | 4 | 9 | 63% |
| Fable A3 `high` | 19 | 5 | 0 | 14 | 11 | 6 | 71% |
| GPT-6.1 A3 `high` | 18 | 3 | 0 | 15 | 2 | 7 | 73% |

The damaged controls held: 13 count, and the judges accepted none. The
judges split most on Fable: the Opus judge alone accepted 29 of its
sentences, GPT's 20.

Why each task-3 bar fails:

- Acceptance. The judges reject a sentence whose content is left
  untranslated, and the models left gaps (`[?]`, "unknown") wherever
  our data has no word: in all 20 everyday sentences, for every model,
  and in 15 of Opus's 20 practitioner ones; 37 of Opus A3's 42
  unaccepted sentences have a gap. The prompt allowed another answer:
  a word of the model's own, marked "coined", which the rubric accepts
  when it is marked. No model with our data coined a single word.
  The everyday sentences were written to need coinages, so without
  them the most a model could reach was 40, the line itself. Leaving
  them out doesn't save the bar: 18 of 40 (45%) on the practitioner
  and attested sentences. On the attested sentences alone, where every
  word exists, Opus wrote 18 in full and both judges accepted 15 (75%,
  against lookup's 2); this subset has no bar of its own. Fable left
  fewer gaps, writing 17 practitioner sentences in full, but both
  judges accepted only 5 of those, so gaps are not the only fault.
- Attested forms. Of the 72 content words where Opus missed an
  attested form, lookup has one for every one: Opus marked 53 of them
  "derived" (its own form, built from the material) and left 19
  unknown. This is a choice of form, not missing vocabulary.
- Round trip. It kept the meaning of 7 of Opus's 20 attested
  sentences, and of only 9 of the 18 sentences both judges accepted;
  lookup's translations scored 0 of 60. The round trip was never run
  on known-good Enochian (the controls' originals), so its ceiling is
  unmeasured, and a failure can't be laid on the translation alone.

What it means, by the rule set before the runs (see "What a pass
means"): the knowns and joins pass and task 3 doesn't, so the
translator stays a lookup tool, with a model's help in choosing senses
(and, from the figures above, in joining words), not a writer of new
Enochian. The figures narrow what failed. Within attested vocabulary
Opus writes sentences both judges accept three times in four; beyond
it, every model left gaps rather than coin, and chose its own forms
where attested ones existed. Whether marked coinage would be accepted,
and whether the round trip can be trusted, are untested. The bars stand
as settled; any new test of composition would be a new round with its
own bars, set before it runs.

Still to do from "Scoring": Gadi's reading of a random tenth of the
judged rows for obvious misjudgements has not been done.

## Round 2: designed, then stopped (13 November 2026)

Round 2 was to test composition again with the scoring fixed. It was
designed decision by decision with Gadi and reviewed twice by Fable.
Gadi stopped it on 13 November 2026, before any code or call, after a
free comparison showed there was little left for a model to add. The
decision record, both reviews' summaries and the analysis scripts are
in `~/Documents/Magick/Enochian/derived/translate-eval/round2-design/`.

**What round 1's task 3 had measured.** An offline look at the stored
answers found:

- The attested-forms bar took lookup's first gloss as "the form that
  exists", which is often the wrong sense (CABA "govern" for "see", an
  angel's name for "tell"), and many of Dee's forms carry more than the
  English (ORRI "barren stone" for "stone", EDNAS "as receivers"). About 30 of its 196 forms
  were wrong senses, so a sound translation topped out near 85%.
- The round trip's back-translator had only the dictionary, and
  questions lost their "?". Of the 9 accepted Opus sentences that
  failed it, 3 failed on the back-translator and 4 on the translation
  (3 of them forms that carry extra meaning, such as "our Lord and
  Master" for "master"; 1 a dropped "my"); 2 were mixed.
- No model with our data marked a word "coined": the prompt praised
  "unknown" and the grammar notes say not to build new forms. 102 of
  Opus's 103 "derived" words were Dee's forms used unchanged in another
  or narrower sense; only one was a newly built word.
- The judges split on whether "derived" licenses a stretched sense:
  in 10 of Fable's 11 splits, the Opus judge accepted and the GPT
  judge rejected.

**Decisions** (Gadi, 13 November 2026):

1. The translator never coins. Where our data has no word, it shows a
   gap with the English.
2. Round 2 would fix the scoring and test 60 fresh sentences, with the
   bars set first. Expert work stays deferred; the list in "For an
   expert" keeps growing.
3. A sentence is accepted when it is right as far as it goes: every
   word given right in sense and form, every gap warranted.
4. The round trip stays, with the translator's data, and is calibrated
   before it can count.
5. No attested-forms bar; needless derivations are reported.
6. Task 3 gets its own prompt, tried once on the old 60.
7. Bars for Opus A3, with Fable and GPT-6.1 for comparison and lookup
   as the baseline.
8. A fused form (Dee's only form carries more than the English) is a
   gap that suggests it: [master: nearest GEIAD "our Lord and
   Master"]. A form is exact only when its gloss differs from the
   English by filler alone.

**What the reviews found.** The first review reworked decisions 3, 4, 6
and 7: gaps one per content word, with a script's list of nearby forms
beside each; bars by kind of sentence; fresh controls for the judges,
including gaps that must be accepted; calibration on script-built
sentences, read by the other model family; and power recomputed for
judges who rejected 2 of 15 known-good passages. The second review
found two flaws that decided the matter. The repo's list of filler
words includes "not", "let", "as", "will" and every pronoun, so the
exact-form rule would have passed IPURAN "SHALL NOT SEE" for "see" and
PLOSI "AS MANY" for "many": the rule needs its own list. And under
"never coin, exact form or gap", strict lookup with no model meets
every bar by construction, so a pass would show nothing about the
model.

**Opus against strict lookup** (round 1's answers, offline). Strict
lookup gives a form only when its gloss, back-to-front glosses
rejoined, has the same content words as the English, with only
articles, "of", "to", prepositions and auxiliaries ignored. Of Opus
A3's content words in task 3:

| What Opus did | Words |
| --- | --- |
| The form strict lookup gives | 182 |
| A different form where lookup has an exact one (mostly DS for "who") | 15 |
| A gap, as lookup would leave | 75 |
| A gap where lookup has a form | 1 |
| A fused form (a gap under decision 8) | 22 |
| A form sharing part of its meaning with the English | 17 |
| A form sharing no word with the English | 66 |

Of those 66, by an unreviewed hand reading (Claude's, 13 November
2026): about 16 are right, most of them
irregular verbs and contractions (came, kept, forgot, said, could,
don't, I'm) and the rest synonyms (UNIGLAG "descend" for "come down",
RNAH "sunrise" for "dawn", PAAOX "remain" for "stayed"); about 15 are
arguable, mostly another word class (TELOCH "death" for "died"); and
about 35 are stretched or wrong (DLUGA "give" for "dedicate", LONSA
"power" for "whoever", IP "not" for "never"; two are AR for "protect",
which a misprint in its gloss hides). A small table of
irregular verbs and contractions would give a script two thirds of the
right ones.

**Conclusion.** Under "never coin", English into Enochian is mostly a
lookup problem: in round 1, a model added about half a dozen synonyms
to 60 sentences and about 35 stretched words that something must
catch. This rests on one model's round-1 output, under a prompt that
did not ask for exact forms. Strict lookup must still choose between
exact forms (449 English senses have two, 208 three or more), which is
where a rule or a model can still help. Round 2's budget is unspent.
The recommendation for the product plan, not yet decided: English into
Enochian by strict lookup, with the irregular-verb and contraction
table and gaps that suggest the nearest forms, a model at most
offering synonyms as marked suggestions; Enochian into English by a
model with our data, which met every bar.

## The first design: held-out Keys (withdrawn 12 November 2026)

Tasks 1 and 2 were first set on the Keys themselves, in nineteen folds:
translate one Key with that Key's rows taken out of the context, scored
row by row against Dee's English and Casaubon's words. Each ran open book
(the whole dictionary) and closed book (less the entries for words found
only in the held-out Key), with A2c, the context under a letter cipher,
to show how much of a score was memory. The recall probe showed that
Opus recites every Key, so none of this can separate memory from use of
the context for Opus. The code is kept (`testset.ts`, the closed-book
removals, the cipher, the probe) for models the probe doesn't flag.

A1 on the held-out Keys, open book (11 November 2026): 81.3% in task 1,
or 89.1% if every row it sends to the judges were accepted, and 51.9% in
task 2, with 130 more rows a synonym and 45 near.

### Thresholds (settled 11 November 2026)

These bars were set for the held-out Keys. On 12 November the new
text's bars took their place in `bars.ts` (see "Bars for the new
text"); these moved to
`scripts/enochian-translate-eval/heldout-bars.ts`, which serves the
held-out-Key path still kept for other models. They are quoted here
because `heldout-bars.test.ts` keeps the two equal. The results of
that path are checked against them by `measureBars` in the same file.
A bar that can't be measured on the results shows why, and is never
counted as met.

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
scored 81.3% in task 1 (89.1% generously) and 51.9% in task 2. The first
draft's bar of 85% in task 1, and its margin of 10 points over A1 on the
hard rows, could be met by a model that adds little to lookup. So the
bars were set above what lookup does: 90% overall, so the model keeps
the easy rows; half of the rows lookup gets wrong (115 wrong by script,
up to 197 with the rows A1 sends to the judges), where translation
actually happens; and 75% in task 2. They were fixed before any model
ran. Closed book had no bar: it measured honesty about unknown words.

## Where the work lives

- The test sets: generated by scripts from `keys.json5` and
  `dictionary.json5`, all our own data, with a fixed seed. They may be
  committed, and the new text and the task-3 sentences are.
- The runner: a script under `scripts/enochian-translate-eval/`, run with
  pnpm (`loom.json`'s recorded runner). It calls every model through
  Vercel AI Gateway (`https://ai-gateway.vercel.sh`, model ids such as
  `anthropic/claude-opus-5.5`; the gateway writes versions with a dot),
  with `AI_GATEWAY_API_KEY` from `.env.local` read through `loom env --`;
  no key is ever committed. It keeps a running cost total and stops at
  the cap. It is a development tool only: nothing in the app calls a
  model. Its budget check and cap read one ledger in one output
  directory, as one process sees it, so runs must never be concurrent
  and must all share one `--out` (the default).
- From the runner's last review (12 November 2026), built: a reply's
  ledger line is appended before the reply is saved, so a crash can't
  leave it saved but unbooked; a reply with no cost and no output, sync
  or batch, is booked at its worst case; and a cost of $0 looked up for
  a failed call is treated as unknown. Still to do at the first real
  batch: check it, including failed items, against the gateway's own
  spend report. Before GPT-6.1's first rubric call, send one alone
  (`--max-requests 1`) to see whether the gateway accepts its settings.
  Nothing locks out a second run at once; don't start one.
- The judges' step (`judge.ts`): folds both judges' verdicts into the
  scores before any bar is measured, and `measureBars` refuses a task-1
  report with rows still waiting for them. A1's to-judge rows are judged
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
  figure measured for the model it uses, with its interval, lookup's
  figure for comparison, the honesty figures, the date and the model.
  The figures come from a small results file the runner writes beside
  `bars.ts` (numbers only, no model output), so the page never states a
  number by hand. A bar the model in use hasn't been measured against
  shows as "not measured", never as met.
- The page also states its **limitations** in plain words, beside the
  figures. They live in one list in code beside the bars
  (`src/app/enochian/translate/limitations.ts`), and this plan quotes
  them word for word under a test, as it does the bars. The list, to be
  settled with the bars:
  - The only English we can check against is Dee's, and the model has
    memorised it, so on Dee's words it was shown to be no worse than
    looking words up, not better.
  - Nothing beyond the Keys can be checked against a known answer. New
    Enochian is reconstruction from Dee's words and our grammar notes,
    and has been judged only by other AI models, not by anyone who reads
    Enochian.
  - Coined and derived words are marked; a word marked as found in our
    data is checked against it before it is shown.
  - The figures come from about 600 rows and 60 sentences, and each has
    a margin of error, shown beside it.
  - Meanings and rules come from Dee, Laycock and Leitch, and some from
    later traditions (Schueler, the Golden Dawn); each is labelled with
    its source.
  - The text you enter is sent to an AI provider, and the provider may
    refuse to translate some passages.
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
answer key, and the build-or-not decision rests on the bars above. The expert is a gate **before a translator is shown to
readers**: the later product plan cannot ship without their review of
a sample. Whether to bring them in earlier is decided again when the
results are in. Until then, questions only an expert can settle go on
this list, which the experiment adds to as it runs:

- Task 3: the sentences the two judges disagree on, and a sample of
  those both accepted.
- Derived and coined words: are the forms plausible by the grammar
  notes, or do they just look like Enochian?
- The new text: whether a swapped word's form suits its new place,
  whether any planted word is in fact attested somewhere we don't have,
  and whether the new joins are joins Dee could have written.
- Task 3: whether the Enochian written for the 60 sentences is
  Enochian at all. Nothing in the experiment can show that; a sample
  for the expert is the only check.
- Glosses where Leitch and Dee's English disagree (about 55 of the 550
  comparable Key words).
- Each rule in the A3 grammar notes, especially those resting on a
  single example in the Keys.
- Where the Golden Dawn reading of a word differs from Dee's, which one
  the translator should prefer by default.
- Added 13 November 2026, from round 1 and round 2's design:
  - Fused forms: when Dee's only form carries more than the English
    (GEIAD "our Lord and Master" for "master", ORRI "barren stone" for
    "stone", PLOSI "as many" for "many"), may it stand for the narrower
    word, or must it be a gap?
  - Whether Enochian with gaps in mid-sentence reads at all, and how a
    gap should be shown.
  - TILB before its noun (Key 19's OD TILB ADPHAHT DAMPLOZ): G22 now
    allows it; is that right?
  - Round 1's task-3 sentences both judges accepted, and those they
    split on, as a sample of the Enochian a model writes.
  - Lookup's wrong-sense glosses (HOMIL "the true ages" for "true") and
    dictionary-only glosses (Schueler's, angels' names): which should a
    translator ever offer?
  - Synonyms a model gave beyond lookup (UNIGLAG "descend" for "come
    down", PAAOX "remain" for "stayed"): are they sound?

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
6. Providers: mostly Claude. OpenAI `openai/gpt-6.1-sol` (high) for
   occasional checks and as second judge, never with the books. Astra
   only as a one-off.
7. Test text (12 November 2026): new text built from Dee's clauses with
   swapped, planted and context-only rows, after the recall probe showed
   that Opus recites all 19 Keys, and revised as reviewed the same day:
   on Dee's words the bars are "no worse than lookup in the Keys"
   (A1k), and only the new joins and task 3 can show more. Its
   bars were settled on 12 November, once A1 and A1k were scored on it.
8. The translator page states its limitations as well as its figures,
   from one list in code that the plan quotes (Gadi, 12 November).

## Risks

- **Memorisation.** The model knows the Keys and Dee's English, and
  lookup in the Keys answers almost all of Dee's text. So tasks 1 and 2
  can only show "no worse than lookup"; the new joins and task 3 carry
  the case for more.
- **Synthetic words.** Planted words and new joins are ours, not
  Dee's. A model that handles them well reads our data well; that is not
  the same as knowing Enochian.
- **Text that isn't quite Enochian.** A swapped word keeps its own form,
  which may not suit its new place, and a swapped sentence may not make
  sense. Real reader text would make sense, which helps a model choose a
  word's sense, so on this point the test is harder than real use.
- **A small test set.** About 600 rows, of which 120 swapped, 40
  planted, 20 planted knowns and 40 joins. Every figure carries its
  interval; bars are decided on counts with known power, and one
  declared top-up is allowed for a marginal result.
- **Whose Enochian.** Leitch's lexicon includes his own etymologies, and
  Schueler and the Golden Dawn add later readings. Each rule and meaning
  keeps its source, as the dictionary does, so the translator can say
  whose reading it used.
- **Copyright.** Covered above: books stay local, notes are our own words,
  raw output stays out of the repository.
- **Model judges.** Without an expert, task 3 is models grading models.
  Cross-family judging, the round trip, the damaged controls and the
  expert queue limit this. They don't remove it, so task 3 alone never
  decides the build, and the page says so.
- **Judges may know Dee.** The controls are Dee's own passages, and the
  judges may recognise them. A judge that knows the passage spots the
  damage more easily than it would spot a fault in new Enochian, so a
  passing control check is a little weaker than it looks. The dropped
  clauses are gross: three of the five keep only 3 rows (of 6, 6 and
  11), so that check is easier than catching a model's subtle
  omission. Each control
  is two passages, so about the length of a task-3 sentence or a little
  longer: 6 to 11 rows and 8 to 26 English words (16.5 on average),
  against 7 to 17 words (10.3) in task 3.
- **Expectations.** Beyond the Keys, any translation is reconstruction.
  The experiment measures how honest the model is about that, not only
  how accurate it is.
