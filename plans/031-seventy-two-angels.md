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
Cabalistique* (Angers, 1823). Lenain died in 1832, so the French is public
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
too. The model is `anthropic/claude-opus-5` at temperature 0, reached through
`loom env` with `AI_GATEWAY_API_KEY`. A smoke call succeeded on 19 September.
The whole job is roughly 110K input and 80K output tokens.

| File | Role |
| --- | --- |
| `scripts/seventyTwoAngels/source.ts` | deterministic slicing of the OCR into 72 French regions |
| `scripts/seventyTwoAngels/schema.ts` | the Zod schema shared by extraction and validation |
| `scripts/seventyTwoAngels/extract.ts` | the gateway pass, one angel at a time, resumable |
| `data/kabbalah/seventyTwoAngelsDerived.ts` | the invariants, used by page, script and test |
| `data/kabbalah/seventyTwoAngels.test.ts` | the validator, needing no API key |

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

Prompt, model id and temperature are committed, so the derivation is
reproducible and reviewable rather than a one-off nobody can audit.

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

Each gated on a clean worktree, in order:

1. Vehuiah's presiding days, a one-line correction independent of everything else
2. the derivation module and its test, proved against the existing three angels
3. the four page fixes, the date scheme now coming from the derivation
4. the nine Christian choirs as data
5. the extraction pipeline
6. all seventy-two angels, and the three-file split
7. the page showing the new fields
8. this plan and the [current status](000-current-status.md) follow-ups

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
- **Deriving the Hebrew.** Each name is a triad of the Shem HaMephorash plus יה
  or אל. With Exodus 14:19–21 in the repo, all 72 Hebrew names could be derived
  and checked rather than read off a damaged scan.
