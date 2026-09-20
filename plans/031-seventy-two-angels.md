# The seventy-two angels

Plan, 19 September 2026. Read [current status](000-current-status.md) first.

`/kabbalah/yhvh/72angels` has shipped since September 2023 with **3 of its 72
angels**. The page itself is finished: it renders an accordion per angel and a
Tropical/Sidereal radio that shifts the dates. Only
`data/kabbalah/seventyTwoAngels.json5` is short.
This plan fills it, splits the prose out of the client bundle, and fixes four
defects the investigation turned up along the way.

## The source and its copyright boundary

`public/docs/Lenain - La Science Cabalistique (1823) - Google.txt` is an
OCRmyPDF sidecar of the Google Books scan of Lazare Lenain's *La Science
Cabalistique* (Amiens, 1823). Lenain died in 1877, so the French is public
domain, and a faithful scan of a public-domain work creates no new copyright in
the text.

**The cleaned French and the English translation must both be derived only from
this OCR.** Piers A. Vaughan's 2021 translation, which the page links to and
recommends, is in copyright; nothing in this pipeline may consult it. The whole
point of the exercise, as the page already says, is a copyright-free rendering
of the same public-domain material.

### What the OCR actually looks like

All 72 entries are present, at lines 2367–4400 (~97 KB, averaging ~1,350
characters each). The damage is consistent and mostly mechanical:

- **The book appears twice.** Lines 164–6503 and 6504–12843 are byte-identical;
  only the 163-line header and OCR log are unique. Half the 528 KB is redundant.
- Digits degrade into letters: `16`→`le`, `165`→`les`, `06`→`de`, `11`→`Il`.
  Hebrew runs are scrambled into Latin.
- Headings are mangled — `I'r`, `r8e`, `219`, `369` (46), `g1€` (51), `J;e`
  (53), `$5*` (55). **Entry 22 lost its heading entirely** at a page break and
  begins mid-sentence. **Entry 42** uses different phrasing and never says
  `Son attribut`.
- Page headers `( 47 )`, footnotes, running-head noise and hyphenated
  line-breaks (`do-\nmine`) interrupt every entry.
- The Chapter IV names table is destroyed for rows 1–62; only 63–72 survive, so
  it is useless as a cross-check.

Each entry carries: ordinal, roman and Hebrew name, attribute, the nation ruled
and that nation's name for God, the 5° range, the decade and its decan-genius
under a ruling planet, the choir, five presiding days, a twenty-minute
invocation window, a Psalm verse in Latin, what the genius governs, the
character of one born under it, and the "contrary genius".

## The arithmetic is a free validator

Lenain's own four tables make most of each entry derivable. That is what makes
an LLM pass safe here: nearly every field can be *checked* rather than trusted.

| Field | Rule for n = 1…72 | Confirmed against |
| --- | --- | --- |
| Degrees | `[(n−1)·5+1, n·5]` | prose, every entry sampled |
| Governing days | five calendar days from 20 March | second table |
| Presiding days | 20 March + (n−1), then +72 four times | third table |
| Invocation | minutes `20(n−1)` to `20n` after midnight | fourth table |
| Decade | `ceil(n/2)` | prose |
| Planet | Chaldean order — Mars, Sol, Venus, Mercury, Luna, Saturn, Jupiter — by decade | prose, decades 9, 13, 21, 25 |
| Choir | `ceil(n/8)` | all nine declarations read |
| Zodiac | `floor((n−1)/6)`, quinance `(n−1) mod 6` | prose ("son signe est le bélier") |

The 72 genii cover 360°, so five days each leaves five days over; Lenain assigns
15–19 March to the epagomenal days and does not give them a genius.

### Errors it already caught

Seven entries were checked by hand against the rules. Four disagreed:

- The **shipped data** gives Vehuiah `[4, 30]`. The third table says **31 May**,
  and the +72-day rule agrees. The OCR read *31 mai* as *31 avril*, and the
  translation carried "April 31" through.
- Entry **17** reads 5:00 where the fourth table requires 5:20.
- Entry **41** names decade 1's decan-genius instead of decade 21's.
- Choir 8 says "up to the 63rd" where eight angels per choir requires the 64th.

A pipeline that cannot catch these is not worth running, and one that can is
worth more than the hand-checking it replaces.

## Data shape

Three files, so the prose stays out of the initial bundle:

| File | Contents | Approx. |
| --- | --- | --- |
| `data/kabbalah/seventyTwoAngels.json5` | everything but the prose | ~55 KB |
| `data/kabbalah/seventyTwoAngelsText/en.json5` | 72 strings | ~100 KB |
| `data/kabbalah/seventyTwoAngelsText/fr.json5` | 72 strings | ~100 KB |

The cut line is the one the UI already draws: everything the table renders when
an accordion opens stays in the main file, and only what sits behind
`<details>Original text</details>` moves out.
`src/components/astrology/Mercury.tsx` already lazy-loads its ephemeris this
way, comment and all, so there is a house idiom to follow.
Both bundlers key their JSON5 rule off the extension, so a dynamic `import()`
resolves under Turbopack dev and the webpack build alike.

Per angel, the main file holds:

```json5
{
  no: 1,
  name: { en: "Vehuiah", he: "והויה" },
  attribute: { en: "…", fr: "…" },
  people: { en: "The Hebrews", fr: "les Hébreux" },
  godName: "Jehovah",
  psalm: { psalm: 3, verse: 3, la: "…" },
  invokedFor: { en: "…" },
  governs: { en: "…" },
  bornUnder: { en: "…" },
  contrary: { en: "…" },
}
```

Everything in the invariants table is **derived, not stored**. The `[4, 30]` bug
exists precisely because a derivable value was transcribed; a single
`seventyTwoAngelsDerived.ts` beside the data, used by the page, the script and
the test alike, removes the whole class. The short fields keep their French
because that is the book's own wording and it costs a few hundred bytes.

`text.fr` is the **LLM-cleaned** French, never the raw OCR — a reader should be
able to check the English against something legible, and the raw sidecar stays
linked from the page for anyone who wants it.

### The nine choirs

`angelicOrderId` currently points at the repo's *Kabbalistic* ten orders and
renders Vehuiah's choir as "Flaming Ones". Lenain means the Christian nine —
Seraphim, Cherubim, Thrones, Dominations, Powers, Virtues, Principalities,
Archangels, Angels — which overlap the Kabbalistic list in only three places.
They get their own `data/kabbalah/christianChoirs.json5` with `{ en, fr }`
names, and the angel's choir is derived from `ceil(n/8)` rather than stored.

## The extraction pipeline

One call per angel, combining OCR repair, translation and field extraction, so
the English is a translation of French the model has already made sense of.

Nothing new is installed. `ai@7.0.102` is already a direct dependency and
bundles `@ai-sdk/gateway@4.0.82`, so a bare model string routes through the
Vercel AI Gateway; `zod`, `tsx`, `json5` and `vitest` are direct dependencies
too. Everything is reached through `loom env` with `AI_GATEWAY_API_KEY`.

What actually ran, which is not what this plan first said: **Sonnet 5** for the
extraction and the transcription, with extended thinking disabled, and
**gpt-6-astra** for the review. Opus 5 was the intention and the committed
default, but the gateway refused it for anything larger than a trivial request
— 0 of 8 identical probes, against 8 of 8 for Sonnet 5 — with credit to spare
and no provider ever attempted. No temperature is set anywhere: Opus 5 does not
accept one, and the option was removed rather than left to be ignored.

| File | Role |
| --- | --- |
| `scripts/seventyTwoAngels/source.ts` | deterministic slicing of the OCR into 72 French regions |
| `scripts/seventyTwoAngels/schema.ts` | the Zod schema shared by extraction and validation |
| `scripts/seventyTwoAngels/extract.ts` | the gateway pass, one angel at a time, resumable |
| `data/kabbalah/seventyTwoAngelsDerived.ts` | the invariants, used by page, script and test |
| `scripts/seventyTwoAngels/validate.ts` | the invariant checks, needing no API key |
| `scripts/seventyTwoAngels/corrections.json5` | hand-verified corrections, applied at assembly |

**Slicing.** Headings are detected where the OCR left them legible; each slice
runs from one heading to the next, with a little lead-in and run-out so nothing
is lost at a boundary. Entry 22's missing heading is handled by widening its
slice to span entries 21–23 and naming the target ordinal in the prompt.

**The prompt** carries the derived values for that angel as known context —
degrees, decade, planet, choir, presiding days, invocation window. The model
repairs corrupt digits *against the arithmetic* instead of guessing at them,
which is what turns the OCR's mangled numerals from a hazard into a non-issue.
It is asked to report anything it could not resolve rather than smooth it over.

**Validation** re-derives every field in the invariants table and compares. A
mismatch is a review item, never an accepted value. The check ships as a vitest
test so the invariants keep holding in CI long after the extraction is done, and
so a future re-run is measured against the same bar.

The prompt and the schema are committed. The derivation is **not** otherwise
reproducible, and saying so is better than implying otherwise:

- Which model produced each entry is recorded only in `output/`, which is
  gitignored. The committed default names a model that never ran.
- The extractions are not committed either, so the corrections in
  `corrections.json5` are string matches against text nobody else has. A re-run
  rewords passages, and a correction whose `from` no longer matches fails the
  assembly loudly — which is the right failure, but it means the corrections
  are tied to one unrepeatable run.
- The validator runs at assembly rather than in CI, so nothing tests the
  shipped data. A check on the psalm references would have caught three
  impossible ones; it did not exist.

Committing the per-entry extractions, or at least their model and a hash, would
close most of this.

## Page fixes

Four defects, all in `src/app/kabbalah/yhvh/72angels/angels.tsx`:

1. **Wrong zodiac sign.** Line 69 computes `degrees % 12` where it needs
   `floor(degrees / 30)`. Correct for the first six angels only; the seventh
   renders Libra instead of Taurus, and it stays wrong for 66 of the 72.
2. **Dates drift from the book.** `dateFromAngelIndex` interpolates at 365/360
   days per 5° from day 80, so the first angel shows 21–25 March where Lenain
   says 20–24, growing to about four days by the seventy-second. Tropical *is*
   Lenain's own system, so Tropical will use his fixed five-day calendar from 20
   March and the interpolation will be kept only for the Fagan-Bradley shift.
   This also settles the page contradicting itself, since "Presiding Days" comes
   straight from the third table and never moved.
3. The footer links to the pre-App-Router path `pages/kabbalah/yhvh/72angels.tsx`.
4. `dateToMonthAndDay`, `formatMonthDayArray`, `formatOrdinals` and `Governs`
   take untyped parameters.

The new fields — the nation and its name for God, the Psalm reference, what the
genius is invoked for, and the contrary genius — join the table, and the
original-text block gains an EN/FR toggle, which is the payoff for storing both.

## Commits

Each gated on a clean worktree, and each landed in this order:

1. Vehuiah's presiding days, a one-line correction independent of everything else
2. the derivation module and its test, proved against the existing three angels
3. the four page fixes, the date scheme now coming from the derivation
4. the nine Christian choirs as data
5. the extraction pipeline, then the review, then a run of fixes to both as
   each round found what the last had hidden
6. all seventy-two angels, the three-file split and the page's new fields
7. the provenance and licensing, which the page had never stated and which
   still credited Google Translate

### Corrections

Eleven, applied at assembly from `corrections.json5`, each verified against the
scan by hand and each carrying its reason. They are for damage the model
restored wrongly and kept restoring wrongly, where re-extracting is a lottery
and the right reading is not in doubt — the twenty-fourth preserving thieves
rather than preserving against them, the sixteenth's god name left as OCR
debris for the word "nom", the thirty-eighth's left as "Acta \baR" where its
own text spells AGLA twice further down.

Every `from` must match exactly once or the assembly fails, so a re-extraction
that words a passage differently surfaces a stale correction rather than
silently skipping it.

## What the pipeline found

Written up after running it. The arithmetic and the review between them caught
the following, none of which the extraction reported as a problem.

### Faults in the scaffolding, not the model

Every serious defect came from how the work was set up rather than from the
model, which mostly did what it was asked:

- **Required fields forced invention.** Every field wanted a non-empty string,
  so where an entry was silent the only way to answer was to assemble something
  from the rest of it. Four entries came back describing the character of people
  born under a genius that their entry never mentions. An invented sentence of
  that kind is fluent, in register, and indistinguishable from the real thing.
- **Letting them be empty caused the opposite.** Sixty-two of seventy-one
  entries then reported no people at all, while sixty-seven reported a god name
  — which cannot both hold, since Lenain gives the two together.
- **Padded regions merged entries.** Three lines of lead-in imported the
  previous genius's closing paragraph, which is exactly what sits before a
  heading. Four entries absorbed one; the thirty-fourth answered `contrary`
  with its neighbour's.
- **Derived values leaked into the prose.** Given so the model could choose
  between readings of a damaged digit, they were written into the French as
  though the scan said them.
- **Reasoning tokens came out of the answer's budget.** With thinking on, a
  probe spent 7,705 of 8,000 tokens thinking and returned 538 characters; the
  entries truncated mid-sentence, and short prose came back as the literal
  string `"placeholder"`.
- **Field order is emission order.** With `en` before `fr`, the model wrote the
  translation before the French it was translating from.

### Faults in the book

- The first genius presides on 31 April, which is not a day. The third table
  gives 31 May.
- Seven consecutive entries, the fifth to the eleventh, print an August day one
  behind their own third table.
- The seventeenth opens its hour at five o'clock where the fourth table gives
  twenty past.
- The fifty-seventh ends the archangels "jusqu'au 63e" and the sixty-fourth
  opens the angels, making one choir of seven and one of nine against his own
  pattern of eight.

## Two fields this scan cannot supply

Neither is a defect to fix by iterating; both need a source.

**`name.he`, for all seventy-two.** The Hebrew is the most damaged part of the
scan, and the model reconstructs it differently on every run: the malformed
count moved 10 → 20 → 21 → 27 across runs, landing on different entries each
time, once with vowel points and twice returning the Tetragrammaton itself. The
shape check only catches malformed output — five well-formed letters ending in
אל that are the wrong name pass silently — so the true error rate is higher than
whatever it reports. The field should be derived from the Shem HaMephorash
triads rather than read, or left out.

**The twenty-second's name.** Its heading vanished at a page break, so the scan
has neither name nor attribute. The attribute is empty, which is honest. The
name cannot be, and the model has offered "Yeiayel" and "Yezalel" on different
runs, the second being the thirteenth's name.

## Reading the scan instead of its OCR

The sidecar could not give us the Hebrew, and no amount of prompting was going
to change that: it renders Lenain's Hebrew as scrambled Latin, so the names
were being reconstructed rather than read. At 200 dpi the scan behind it is
clean, and the first genius's name is `והויה`, letter for letter.

It settles more than the Hebrew. "inclusivement" is plainly that, where the OCR
broke it across lines as `-מ1 / clusivement`. "31 avril" is plainly printed, so
the impossible date is Lenain's and not the scanner's. And the twenty-second's
heading, which the OCR lost at a page break, is simply there.

Each page is read into JSON5 — prose in blocks, footnotes kept apart from the
sentences they were printed under, tables kept as tables, running heads and the
Google watermark marked as furniture so nothing is silently dropped — and
Markdown is generated from that. The PDF stays out of the repository;
`LENAIN_PDF` points at a copy.

### Still to do with it

1. Re-run the angel extraction against the transcription rather than the OCR,
   which should collapse both the disagreement list and the corrections file.
2. Take the Hebrew names from it, and the twenty-second's name and attribute.
3. Adjudicate the remaining disagreements: with the page readable, "14 aoüt"
   can be shown to be the scan misreading or Lenain misprinting.
4. The four cabalistic tables and the sacred calendar, printed pages 25-44.
   The first of them — 72 rows of name, nation and divine name — survives in
   the OCR only for its last ten rows, and is an independent third source for
   exactly the fields that have been hardest to pin down.
5. Read the remaining pages, so the whole book is transcribed rather than the
   chapter.
6. **Publish it.** A searchable, linkable, indexable edition of the book on the
   site, generated from the JSON5 — the last of these, once the rest is done.

## Follow-ups

- **Sigils.** The page promises them. Vaughan's blog images are his own work and
  not ours to take; the plates in the public-domain scan would be, but the PDF
  itself is not in the repo — only the text sidecar.
- **The thirty-six decades.** Each has two decan-genius names, Greek and
  Firmicus, and a ruling planet. The planet is derivable and will be shown; the
  names need their own table.
- **The duplicated OCR file.** `public/docs/…Google.txt` ships the book twice,
  at a cost of about 264 KB. Trimming it changes a linked public URL's contents,
  so it wants its own decision.
- **The Hebrew names**, which are not in the data at all. Each is a triad of the
  Shem HaMephorash plus יה or אל, so with Exodus 14:19–21 in the repo all 72
  could be derived and checked rather than read off a scan that cannot supply
  them. Two checks would guard a text entered from memory: each of those verses
  has exactly 72 letters, and the 72 derived names should match the
  romanisations the scan gave independently.
- **The twenty-second's name.** Taken from the sequence Lenain, Agrippa and
  Kircher share, or left out. Its heading is gone and nothing in this scan
  decides it.
- **The remaining disagreements.** Thirty-five stand between the entries and
  Lenain's tables, and a tail of minor review findings stands beneath them.
  They are recorded rather than resolved: most are the scan, some are the book,
  and telling which is per-entry work against the plates.
