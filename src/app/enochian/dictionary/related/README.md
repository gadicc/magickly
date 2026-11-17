# Related words

`table.json` is the data behind "Related by meaning" on a dictionary
entry (plan 081, S11, step 2G): up to three of our other glosses whose
meaning a machine found close to the entry's own, each with the forms
that open their entries ("ROR, AR ‘sun’" for RNAH), marked on the page
as a suggestion no one has reviewed. The route `related.json/route.ts`
serves it, built once at build time; the page fetches it once, the
first time an entry is shown, with only the origin as its Referer, so
the request says nothing of the reader's search (`../Related.tsx`).

It derives only from our own glosses (the dictionary's meanings and
Dee's English in the Keys) and their embeddings, so no outside source's
licence applies. SCOWL's word lists (see the gap hints' README,
`../../translate/hints/README.md`) only decide which of our glosses
are left out as garbled; none of their words is in this table.

## The recipe

- **The glosses**: the gap hints' own (`scripts/enochian-hints/glosses.ts`),
  after their cleanup and `englishOnly`: each exact gloss of the lookup
  in its commonest tokenised wording, glosses worded alike merged; no
  grammar-only glosses, names, notes, denylisted glosses or hub forms
  (DE, CHIS, NONCF, Q, LAP, GEH, BRINTS). On 17 November 2026, 1,286
  glosses, every one already in the gap hints' vector cache, so a build
  embeds nothing: it stops, naming them, if any vector is missing.
- **The relation**: each gloss's cosine to every other gloss, with the
  gap hints' model and prompt ("similarity/bare"), z-scored against
  that gloss's own cosines to all the others (mean and standard
  deviation over them, itself left out).
- **An entry's glosses**: every gloss whose forms, as the lookup gives
  them (from the dictionary's meanings or Dee's English), include a
  form that the entry's headword folds to. Hub words have none: their
  many short meanings would relate them to everything.
- **An entry's related words**: every other gloss, ranked by its best z
  from any of the entry's own glosses; never one of the entry's own
  glosses, so never one whose forms open the entry. A gloss shows only
  its forms that open a dictionary entry of their own (a Keys form the
  dictionary lacks, or one the lookup reads as parts, is left out), and
  only those a better related word hasn't already shown; a gloss left
  with none takes no place, so "of death" doesn't follow "death" with
  the same TELOCH. The best three at or above the cut-off are kept.
- **Numbers** (after the first judging, whose most regular wrong
  verdicts were "nineteen" related to "nine" and "not the fourth" to
  "not the fifth"): a related word is dropped, taking no place, when it
  and the entry's gloss its best z came from both name numbers, and not
  share none (sharing one keeps them: "one" and "first" have senses
  that aren't numbers, as in "the third arrives first"). Numerals, cardinal and ordinal words count by value
  ("nine" and "ninth" are 9, "twenty eight" 28) and simple fractions as
  fractions ("half", "a quarter", "one fourth"); `numbersIn` and
  `differentNumbers` in `scripts/enochian-hints/related.ts`. At z ≥ 6.75
  it drops four.
- **The budget**: as the gap hints', 150 KB gzipped, raising the cut-off
  a tenth at a time if over (it is far under).

## The cut-off and the judging (17 November 2026)

Three judgings, in order, each by a separate fresh model judge with the
meaning spike's rubric (good, loose or wrong, for the related word
against the entry's meanings), shown no z-scores (the gap hints' judges
saw them):

1. **Seed 1, z ≥ 6.0**, the cut-off chosen from the z distribution
   before drawing (plan 081's 2G notes say why): 126 good, 65 loose, 9
   wrong (95.5% good or loose, 4.5% wrong), passing.
2. **Seed 2, z ≥ 6.0**, drawn to confirm the thin margin: 120 good, 65
   loose, 15 wrong (92.5% good or loose, 7.5% wrong), failing. `score`:
   z ≥ 6.557 would pass on it. The two together, at 6.75: 216 rows,
   3.7% wrong.
3. **Seed 3, z ≥ 6.75**, held out: 6.75 was chosen from both, the
   number rule added (above, after the first two showed different
   numbers as the most regular wrong verdict), the table rebuilt, and
   then this sample drawn: 141 good, 55 loose, 4 wrong (98.0% good or
   loose, 2.0% wrong), passing. It is committed beside this file as
   `judged-z6.75-seed3.tsv`, and `scripts/enochian-hints/related.test.ts`
   checks the table is the one it was drawn from.

Its wrong rows: CORS "such, work" and VAUL "to work" (the judge's least
certain), HCOMA "water name, tablet of union" and TOANT "union", UGEG
and NOAR "is become", UGEG "strong" and GOSA "strange". Weak rows the
judgings noticed, left in: "Son of Light" against "Son of Son of Light"
(loose); near-inflections whose form is a prefix or an extension of the
entry's own (about 160 of 1,201 at 6.0, judged good as inflections);
and two likely data errors, LUIAHE glossed both "a son of" and "a Song
of honour" (a mis-split "Song"), and GESCO carrying both "is not the
fourth" and "but with the holy Pentagram".

**The shipped table**, at z ≥ 6.75: 472 entries with related words,
664 items, in 373 rows, 18,598 bytes served, 7,116 gzipped. The cost of
the margin is coverage: 687 entries had related words at 6.0. A later
re-judging, or a dictionary change that alters the glosses, should run
the held-out check again.

## Format

One JSON object (`format` 1): `recipe` (model, dimensions, revision and
prompt version), `asked`, `cutoff`, `glossHash` (SHA-256 of the recipe
and every candidate gloss's text, wording, forms, the forms that open
an entry and the entries it is a meaning of), `entries` (entries with
related words), `items` (related words in all), `glosses`, one row to
a line, `[wording, [forms]]`, a form written as its entry's key or as
`[form, key]` where the two differ, sorted by wording; and `related`,
one entry to a line, its key to its rows' indices, best first. No
scores. `format.ts` documents it; the file is outside Biome's
formatter so each row stays on its own line.

## Rebuilding

```sh
pnpm enochian:hints related build [--cutoff z] [--seed n]   # the table and a sample to judge
pnpm enochian:hints related sample --seed n [--cutoff z]    # another sample, the table left as it is
pnpm enochian:hints related score <judged sample>           # does the judged sample ship?
```

None uses the network. `build` and `sample` read SCOWL's archive as the
gap hints' modes do (`--archive`, by default
`.private/enochian-hints/scowl-2020.12.07.tar.gz`) and the vectors from
`.private/enochian-hints/vectors.jsonl`. `build` keeps the committed
table's `asked` unless `--cutoff` is given, prints the z distribution
(of every ranked related word, of each entry's best, and the entries
and items each half-point cut-off keeps), the entries, items and bytes
(raw and gzipped), and draws 200 random (entry, related word) pairs
(seed 1 unless `--seed`) into
`.private/enochian-hints/related-sample-seed<seed>-z<cut-off>.tsv`,
with the entry's meanings and the rubric. `sample` draws at the
committed table's cut-off unless `--cutoff` is given. Neither writes
over a sample: if the file exists they stop before writing anything
(pass another `--seed`, `--sample <file>` or `--no-sample`). `score`
holds the gap hints' bar (at least 90% good or loose, at most 5% wrong)
and, on a failing sample, names the lowest cut-off at which the judged
pairs pass.

`scripts/enochian-hints/related.test.ts` fails when a dictionary or
Keys change alters the candidate glosses, their wording, their forms or
the entries they belong to: rebuild with `related build`, and judge a
fresh sample if many related words changed.
