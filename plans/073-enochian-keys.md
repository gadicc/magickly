# The Enochian Keys, complete and checked — 10 November 2026

Status: decisions settled 10 November 2026 (Gadi agreed 2 to 10 as
proposed, with Casaubon's spelling and a search refresh per commit);
the spike done; building on `gate/enochian-keys`. Read
[current status](000-current-status.md) first. This plan follows Gadi's
answers of 10 November 2026 to the text sheet of
[plan 071](071-on-site-search.md): add the nineteenth Key, the Call of the
Thirty Aethyrs; treat Key 18's gap as a mistake; check every Key against
other sources and say so beside them.

## Background

`packages/magick-data/src/enochian/Keys.ts` holds the Keys as triples per
word, `[enochianLatin, enochianTransliteration, english]`, and the page
`/enochian/keys` shows them in English, in Enochian, or both, each word
opening its dictionary entry (`src/app/enochian/keys/keyEntries.ts`). The
file arrived whole in `6f3af271` (9 July 2023) with no source named. Its
English and Key 1's accented transliteration ("raygne", "powre",
"gohó") follow Dee's own manuscript, British Library Sloane MS 3191
(*48 Claves Angelicae*), through some modern transcription.

## Findings (research of 10 November 2026)

### The gap is most of the Keys, not Key 18

| Keys | Enochian | Transliteration |
| --- | --- | --- |
| 1 | all 92 words | 86 of 92 |
| 2, 3 | all | none |
| 4 to 10 | none: English only | none |
| 11 to 18 | the shared ending (ZACAR … IAIDA) only | the ending only |

676 of 1,014 rows have no Enochian. In the Enochian and "Both" views the
page shows blanks for them today.

### Errors in what is there

Each is backed by a public-domain source (page references are to
Casaubon below):

1. Key 1.72 `SONF / bogpa`: the word is **BOGPA** ("reigneth", p. 84,
   "Call it Bogpa"); SONF is the root.
2. Key 1.76 `BALTOH / piamos`: **PIAMOL** (Casaubon "Piamo el",
   Crowley "Piamoel").
3. Key 1.64 `UL / Lu`: **LU**.
4. Key 1.55 transliteration "Iäl" for IADPIL: **iadpil**.
5. Key 1.68 "dep" for VEP: **vep**.
6. Key 1.73 "aäl" for AAI: probably **aai**.
7. Key 11.36 "cab": probably **ca**.
8. Key 16.17 "876": **8763** (both sources).
9. Key 9, the second "heds" in "uppon their heds are marble sleves":
   **hands** (Casaubon p. 191).
10. Key 2.4 to 2.6: the English is one row late; OM is "understand",
    FAAIP "your voyces", SALD "of wonder".
11. Empty rows: Key 8.8, Key 10.44 and 10.56, Key 13.21.

### Sources

- **Casaubon, *A True & Faithful Relation*** (London, 1659; archive.org
  `truefaithfulrela00deej`, with the Wellcome scans `b30324282_0001` and
  `_0002`), printed from Dee's journal, British Library Cotton MS
  Appendix XLVI. Public domain. The Enochian of Keys 1 to 18 as dictated
  in Cracow from 13 April 1584 (p. 78, leaf n171; Key 18 pp. 137–138),
  their English (Keys 1–4 word by word, 5–18 as running text, pp.
  188–198), and the nineteenth Call with a gloss per word, 12 and 13
  July 1584 (pp. 201–209, n290–n298). Dee's spelling. Gaps where the
  manuscript was damaged; no list of the Aethyr names.
- **Crowley, *The Equinox* I(8)** (London, 1912; archive.org
  `crowley-equinox_202110`, "No. 8", pp. 99–127). Public domain. Keys 1
  to 18 and the Call of the Aethyrs in the Golden Dawn's spelling and
  English ("Ol sonuf vaoresaji"), and the thirty Aethyr names (p. 125).
  Not the O.T.O.'s retypeset `oto-equinox-vol-1-no-01-10`, which is
  copyrighted and differs.
- **Crowley, *The Equinox* I(5)** (1911), "The Vision and the Voice":
  the Aethyr names as chapter headings.
- **British Library records**, for dates: Sloane MS 3191
  (https://searcharchives.bl.uk/catalog/040-002115575, the Keys
  "received at diverse times from 13 April to 13 July 1584 at Cracow")
  and Sloane MS 3188 (…/040-002115572, the Heptarchic books, 1581–83).
- Sloane MS 3191 itself, the source of our English and Key 1's accents,
  could not be read: the Library's images have been offline since 2023,
  as plan 061 found for the tablets.
- Modern editions and transcriptions (Laycock, James, Peterson's
  esotericarchives, Regardie's Llewellyn editions, Schueler) are
  copyrighted: not used, not even as a cross-check.

### The nineteenth Call

163 words, dictated 12 and 13 July 1584; the Aethyr's name is the fourth
(MADRIAX DS PRAF **LIL**, "O you heavens which dwell in the first aire").
Crowley's table (I(8) p. 125, checked on the page image) names the thirty:
1 LIL, 2 ARN, 3 ZOM, 4 PAZ, 5 LIT, 6 MAZ, 7 DEO, 8 ZID, 9 ZIP, 10 ZAX,
11 ICH, 12 LOE, 13 ZIM, 14 UTA, 15 OXO, 16 LEA, 17 TAN, 18 ZEN, 19 POP,
20 KHR, 21 ASP, 22 LIN, 23 TOR, 24 NIA, 25 VTI, 26 DES, 27 ZAA, 28 BAG,
29 RII, 30 TEX; I(5)'s headings have ZON (3), IKH (11), UTI (14) and KHR
(20). The forms usually given as Dee's (VTA, CHR) come from modern
books: Casaubon
does not print the list, and Sloane MS 3191, which does, cannot be read.
So the data holds Crowley's names, and Dee's spellings wait for the
manuscript. Crowley also varies IDOIGO (word 40) with the Aethyr; that is
Golden Dawn practice, not Dee's.

### What the app assumes

- `keyEntries.test.ts` counts 181 distinct words and requires every one to
  be in the dictionary. Filling the Keys adds hundreds of words, some not
  in it (ILASA, AQLO and ADOHI of Key 18 already).
- Subkey numbers are positions, shown as "Key 1.72" in the word panel and
  the table; correcting rows renumbers what follows. No URL uses them.
- Nothing models a word that changes per Aethyr.
- The Keys are in site search's index (`src/search/catalogue.ts`), so
  every change to them republishes its embeddings (plan 070).

## Decisions

1. **Provenance first.** Our English and Key 1's accents came from a
   modern transcription we cannot name, and the README offers them under
   CC BY 4.0; the row division may be that editor's too. Unless Gadi
   knows the source and its terms (he added the file in 2023), every
   word is re-derived from public-domain prints: the Enochian from
   Casaubon, the English from Casaubon (Keys 1–4 word by word, 5–19 as
   running text, split by us). Existing wording stays only where
   Casaubon agrees with it; Key 1's accents go unless a public-domain
   source has them. The README says what the text rests on and why the
   licence holds. **Settled** (Gadi, 10 November 2026): the source of
   the 2023 text is not known, so it is re-derived.
2. **Readings by source, versions as rules, as the tablets have them**
   (`Tablets.ts`, `TabletNotes.ts`). Each row is one of Dee's words and
   holds `readings` keyed by work: `casaubon1659` (Dee's spelling, as
   printed: the capitals and the pronunciation column beside them),
   Equinox I(8) (the Golden Dawn's), and later `sloane3191` when the
   Library's images return. Versions are rules over them: `dee` (the
   default here, since the English is Dee's) and `gd`. The works go in
   the registry `tabletNotes` already keeps; `equinox1912` there is
   I(7), with its own file, so I(8) gets an id of its own (no id
   moves). The transliteration column becomes Casaubon's pronunciation
   column, which prints some accents ("Ma óf fas"): Key 1's accents may
   yet rest on a public-domain source.
3. **Dee's words are the spine.** Crowley joins and splits words
   ("sobrazod", "nazodapesad", "ipe salada"), so a Golden Dawn reading
   may span several of Dee's rows: it sits on the first, and the others
   are marked as joined to it. The spike found the other cases too: a
   Dee word Crowley splits ("ta el-o"), one he leaves out, and two that
   overlap ("das iod" for DSI OD); each is a marker on the row.
   Dictionary lookups always use Dee's word.
   The GD version shows Dee's English (Crowley's own English, "saith",
   "who", is a later question).
4. **One row per Dee word, the English split by us.** Casaubon prints
   Keys 5–19's English as running text; our split of it into rows is
   editorial and the notes say so. Key 18's "and" joins IALPRG, "in thy
   Kingdome" splits over AQLO and ADOHI; Dee's entries of OD with a word
   become two rows (Key 4's 47 entries, 51 rows); the empty rows 8.8,
   10.44, 10.56 and 13.21 go. The closing words Keys 5–18 share, which
   Casaubon prints once and then refers to ("Move as before"), are
   repeated in each Key, sourced to where they are printed. Casaubon
   numbers the Calls in the order received (Key 18 is his "14"); the
   notes give his number. Rows renumber freely: the numbers are for
   reading along, and no URL uses them.
   *Spelling (agreed):* Casaubon's print modernises Dee's
   English ("thou", "earth", "JOY" for the manuscript's "thow", "erth",
   "IOYE"), so the re-derived English reads as Casaubon prints it. The
   spike's Keys 4 and 18 keep almost every word; only spelling and row
   division change (Key 4: of 51 rows, 30 identical, 10 spelling only,
   10 merged from ours, 1 a different word).
5. **A source per word where it differs from its Key's.** A Key names its
   source and pages; a word read elsewhere names its own. Key 18 has six
   damaged words in Casaubon's capitals, and his own pronunciation
   column recovers each (MICAOLZ "Mi ca ol zod", OLPIRT, LAIAD, BRINTS,
   COMO and BLIORT run together). Its first word is "Ils." there, with
   no capitals, and ILS on p. 136: Dee's reading is ILS (marked
   uncertain), the Golden Dawn's ILASA. Nothing rests on modern books.
6. **Uncertain corrections are notes, not edits.** Of the errors found,
   the sure ones change the data (BOGPA, PIAMOL, LU, 8763, "hands", Key
   2's shift, the empty rows); "probably" ones (aai, ca) and anything
   only Crowley supports stay as they are, with a note.
7. **The Call of the Aethyrs** is Key 19 whose varying rows are marked
   as slots (not by position, which renumbering would break): for each
   Aethyr and version, the word in each slot (the Aethyr's name always;
   IDOIGO in the GD version) and the English from a template with the
   ordinal ("in the {first} aire"). An `aethyrs` table holds the thirty
   with each source's spelling. The page shows "Key 19: the Call of the
   Thirty Aethyrs" with an Aethyr picker (1 LIL by default), and says
   that Dee counted the thirty as Calls 19 to 48 (*48 Claves*).
8. **A `checked` record per Key**, read by the page and the README so the
   claim cannot drift: the date, the works compared, the fields covered
   (Enochian, English) and what was not (accents, Dee's Aethyr spellings,
   Casaubon's gaps).
9. **Words not in the dictionary are allowed and listed.** The spike
   found 34 of Key 4's 44 words and 24 of Key 18's 26 in it; most
   misses are compounds the dictionary holds apart (NORMOLAP is NOR +
   MOLAP). The lookup gains a fallback that tries a word as two entries
   and shows both. The test reads the words from the data, with a list
   of exceptions, each with a reason; the word panel says "not in the
   dictionary". Adding words to the dictionary is its own work (its
   sources are copyrighted).
10. **Search** indexes both versions' words and the Aethyr names
    (`src/search/catalogue.ts` 182–194), and the Keys' changes land in
    as few commits as is sensible, each with its refreshed embeddings
    under the script's $1 guard, the Gateway key passed in alone, as for
    `gate/angel-meaning`. Agreed by Gadi as standing approval for this
   plan's commits.

## Stages

Gated commits on `gate/enochian-keys`; Gadi fast-forwards.

0. **Spike** (10 November 2026, nothing committed): Keys 4 and 18 read
   from the page images and checked against Crowley, in about 6 and 4.5
   minutes (Key 4: Casaubon pp. 109–111, leaves n198–n200, 28 April
   1584, dictated from its last word to its first; Key 18: pp. 137–138,
   English pp. 193–194; Crowley pp. 109 and 123–124). The data shape
   type-checks as a sketch. Estimate: about 2.5 agent-hours to read all
   1,180 rows, 1.5 for a second pass over a quarter of them, 5 to 6 in
   all with the code, before Gadi's review.
1. **The model and Keys 1–3**: readings by source, versions, notes and
   `checked` records, the registry entry; Keys 1–3 re-derived and the
   sure corrections made; the page reading the new shape, Dee version
   only. Search refreshed.
2. **Keys 4–18, Dee's reading**, in two commits: Keys 4–10 (English
   only today, the larger change), then 11–18; each word read on the
   page image.
3. **The Golden Dawn reading** of Keys 1–18 and the version switch.
4. **The Call of the Aethyrs**: data, map, picker.
5. **The page text** (plan 071's Keys text, now true), the check stated
   from the `checked` records, the README.

Stages 1 to 4 make five commits that change the Keys, each carrying its
search refresh (decision 10).

## What the reading found (10 November 2026)

Four agents read every Key from the page images; their findings change
some of the above.

- **Two errors were not errors.** Key 1's UL is Dee's forward reading
  (the page prints the dictated LU, then "Call it UL"); Key 2 prints no
  English against OM, with "understand" on FAAIP and "your voices of
  wonder" on SALD, as the 2023 text had them, and Dee's list gives the
  three as one item. Both stay; OM's row has empty English and a note.
  Errors 1, 2, 4 to 9 and 11 are confirmed on the page.
- **Key 1's accents**: one of the 2023 text's ten is in the print
  ("lóhólo"); Casaubon gives spoken remarks instead ("accent on the last
  A"). Keys 2 and 3's pronunciation columns do print accents.
- **Key 1 has two words Nalvage "hummed"** and did not pronounce (p.
  84): rows with no word, marked `unspoken`, their English placed by us.
- **Casaubon prints the thirty Aethyrs' names** (p. 209, leaf n298),
  after the Call: the `dee` version uses his list, and Crowley's IDOIGO
  varies with no word given, so its slot stays unfilled. The archive.org
  scan is misbound: pp. 203–204 are at leaves n286–n287.
- **Casaubon's print has lost the Enochian of Keys 14 and 15 and of Key
  16's first twelve words** (pp. 133–138, damaged pages): only scraps
  survive (Dee's list of first words, p. 200; margin words, p. 193).
  Those rows take Crowley's form in the `dee` version too, marked as
  his, until Sloane MS 3191 can be read; their division and English
  pairing follow Crowley and are ours.
- **A second reader** checked a random quarter of every Key (312 rows
  and the thirty Aethyrs, 342 entries, seed 20261110) against the pages
  before looking at the transcription: 333 agreed in every field. The
  nine others were three slips (a GD split that is a line-end hyphen,
  two English splits unflagged, a note's quotation), two print
  ambiguities ("hotch pot", "Dám") and two judgement calls (Key 16's
  Equinox page, Key 19's CHIS from the pronunciation); all are
  corrected or noted, and no reader misread a letter form. The
  `checked` records say a second reading of every word was not done.
- **CA in the closing words of Keys 13–18**: Dee's note on p. 193 gives
  them as "Zacar e ca, od zamran"; Crowley and the 2023 text omit it. It
  is Dee's, so it is in the `dee` version and marked absent in `gd`.

## Verification

- Structure: each Key's rows match the spike's count of Dee's words;
  every row has a Casaubon reading and English; GD readings cover every
  row, directly or by a marker; Key 19 has its slots for all thirty
  Aethyrs and both versions; every source id is a known work.
- Each changed word has a note naming its source and page.
- The dictionary test, derived from the data, with listed exceptions.
- A second pass over a random sample of words per Key against the page
  images, by an agent that did not enter them.
- Browser check at 390 and 1280 px: each view, both versions, the
  picker, an unresolved word; and the page's bundle size, since the
  words the client receives grow by about 500.

## Risks

- **Provenance** of the 2023 text: decision 1 removes the dependency,
  at the cost of re-deriving Keys 1–3 and the English.
- **OCR of a 1659 print** is poor: every word is read from the page
  image, and the second pass samples them.
- **Sloane MS 3191 stays unread**: Dee's accents, his continuous English
  for the nineteenth Call and his Aethyr spellings wait for it; the
  `checked` records say so.
- **Copyright**: sources are Casaubon (1659) and Crowley (1912) only;
  agents print no long passages.
- **Size**: about 1,000 rows to derive and check, plus the GD reading.
