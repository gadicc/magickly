# An Enochian translator: what an LLM can do with our data — 10 November 2026

Status: draft of 10 November 2026; open questions settled 11 November
2026; redesigned 12 November 2026 to test on new text, after the recall
probe showed that Opus recites all 19 Keys (see "What the recall probe
found"), and revised the same day after review showed that lookup in
the Keys solves almost all of Dee's text. Built so far: the grammar
notes, the held-out-Key test set, the lookup baseline (A1), the answer
checker, the scorer, the bars with the code that measures them, the
model runner and the judges' step. Not yet built: the new text, A1k,
the new bars and the page's list of limitations. Spent so far: $1.33
of the $100.
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
  files mark them. No model can know them, so A0 should score at most
  one: they test whether the model reads the prompt rather than its
  memory. Lookup over the same prompt gets them too, so they don't show
  more than lookup. Their meanings share no word with the task-2 plants.
  The answer checker's context includes them. Task 3, its round trip
  and its judges use the prompt without them, so a made-up word can't
  be used there for its English.
- **40 new joins**: a small word joined to an attested word by the
  grammar notes' rules (G26, "small words join the next word", and G27,
  "a shared letter is written once"), where that join is attested
  nowhere: for example DS "which" or I "is" before a word that never
  takes it in the Keys. Of 4,504 such joins, 75 are attested and are
  left out, and a join is used only if it splits into attested parts in
  exactly one way and has no form within one letter of it. A join is
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
apart; a "derived" answer must cite a ref whose form is actually inside
the word, or it is an **unsupported guess**, which counts against the
plant bar like a plant given as attested. Elsewhere, derived and
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

The cap is **$100** for the whole experiment, of which $1.33 is spent
(the probe and one test call). Prices checked 11 November 2026, per
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

| Part | With cache reads | Without |
| --- | --- | --- |
| The cache check (two A3 calls) | $1 | $1 |
| Opus, tasks 1 and 2 (about 40 calls with context, 16 for A0) | $16 | $28 |
| Fable 5.2, A3 on 300 rows | $5 | $10 |
| GPT-6.1 Sol, A3 on 300 rows | $3 | $4 |
| Task 3: six translations and their round trips | $11 | $15 |
| Judges, both families (about 375 task-3 judgements, and task-1 rows) | $11 | $14 |
| The one top-up, if needed (see Scoring) | $5 | $8 |
| **Total** | **about $52** | **about $80** |

Both fit in the $98.67 left, with room for blocked parts to be retried,
but no call so far has read from the cache. So **the
first paid step is two A3 calls**, checking that the second reads the
prompt from the cache; if it doesn't, Opus runs by batch. The first full
A3 run then goes alone, and its cost is checked against this table
before anything else runs.

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
  versions. A word-for-word lookup round-trips well by construction,
  which is why every task-3 bar is measured against A1's figure.
- **The judges are checked.** About 15 deliberately damaged
  translations go in among the task-3 answers: wrong attested words,
  unmarked coinages, a dropped clause. If the judges accept more than 3
  of them, the task-3 bars can't be measured.
- **Blocked replies.** A part the provider's filter blocks is retried
  once; if it is blocked again its rows count as wrong, and the number
  of Opus translation calls blocked is reported against its bar. The probe had 5 of 38 replies blocked, and
  a translator that is often blocked is no use to readers.
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
allowed, declared now: 200 more rows of the same mix, made by the same
script with the next seed, run once on Opus A3 and A1k, and the bar
decided on all the rows together. There is no second top-up.

### Bars for the new text (proposed 12 November 2026)

The bars of 11 November (below) were set for held-out Keys and can't be
measured now. The new text gets its own, in the same file
([`src/app/enochian/translate/bars.ts`](../src/app/enochian/translate/bars.ts)),
quoted word for word here by the same test, and shown on the translator
page beside the measured figures. Proposed, for arm A3 on Opus:

| Bar | Proposed | What it shows |
| --- | --- | --- |
| Enochian to English, unchanged and swapped rows | at least A1k's judged figure less 2 points | no worse than lookup |
| English to Enochian, unchanged and swapped rows | at least A1k's figure less 3 points | no worse than lookup |
| Swapped rows right, task 1 | at least 90% (108 of 120) | reads the word in front of it |
| Recalled answers, task 1 | at most 5% of swapped rows (6 of 120) | not misled by memory |
| Planted unknowns given as attested, or guessed without support | at most 10% (4 of 40), each task | honest about words that don't exist |
| Planted knowns right, task 1 | at least 18 of 20, with A0 at most 1 | reads the prompt, not its memory |
| New joins right, both parts, task 1 | at least 80% (32 of 40) | more than lookup: applies the grammar |
| Silent inventions | at most 2 per 100 rows, every task | honest about its sources |
| Task 3, both judges accept | at least A1's share plus 15 points, or 90%, whichever is lower | composes better than lookup |
| Task 3, round trip keeps the meaning | at least two thirds, and no more than 10 points below A1 | the meaning survives |
| Task 3, content words given an attested form where one exists | at least 90% (a floor: A1 scores 100% by construction) | uses our data when it can |
| Opus translation calls blocked by the provider's filter | at most 5%, counted over every call | usable at all |

These sizes give the bars some power. On 120 swapped rows, a model that
is truly 95% right passes 99% of the time and one that is 85% right
passes 7%; on 40 planted unknowns, one that claims 5% as attested passes
95% of the time and one that claims 20% passes 8%; on 40 joins, one
that is truly 70% right passes 11% of the time. The round trip is a
floor rather than a margin over A1, because word-for-word lookup round
trips almost perfectly by construction, and a model that follows the
grammar notes (no articles, an unwritten "of") may round trip a little
worse for being more Enochian.

**They are settled after A1 and A1k are scored on the new text (task 3
through A1 as well, judged), and before any model runs on it.** A1k's
and A1's figures and the settled bars go into this plan and `bars.ts`
together, with the date, so the bars can't be fitted to model results.

What a pass means: the model is no worse than lookup on Dee's words, is
honest, isn't misled by memory, reads our data for words it can't know,
applies the grammar to new joins, and composes better than lookup by
the judges' measure without losing meaning in the round trip. It does not mean the Enochian it writes is right: without an
expert, nothing here can show that (see "For an expert").

If the planted knowns and joins pass but task 3 doesn't, the model reads our
data but can't compose: the translator stays a lookup tool with a
model's help in choosing senses. If nothing beats A1k, the translator is
a better lookup tool (the dictionary's English search, built in
[plan 074](074-enochian-dictionary-search.md)) and the idea waits.

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

These bars were set for the held-out Keys. They stay in
[`src/app/enochian/translate/bars.ts`](../src/app/enochian/translate/bars.ts)
until the new text's bars replace them (see "Bars for the new text"),
and are quoted here because `bars.test.ts` keeps the two equal: a bar
changes in the code and here together, with a new date. The
experiment's results are checked against them by `measureBars` in
`scripts/enochian-translate-eval/bars.ts`. A bar that can't be measured
on the results shows why, and is never counted as met.

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
- Before the first paid run, from the runner's last review (12 November
  2026): append a batch item's ledger line before its saved reply, so a
  crash can't leave it saved but unbooked; book a sync reply with no
  cost and no output at its worst case, as batch already does; treat a
  cost of $0 looked up for a failed call as unknown; and check the first
  real batch, including failed items booked at $0, against the
  gateway's own spend report. Nothing locks out a second run at once;
  don't start one.
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
   bars are settled once A1 and A1k are scored on it.
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
- **Expectations.** Beyond the Keys, any translation is reconstruction.
  The experiment measures how honest the model is about that, not only
  how accurate it is.
