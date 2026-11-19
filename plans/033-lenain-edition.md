# Publishing the Lenain edition

Plan, 20 September 2026. Read [current status](000-current-status.md) first,
then [plan 031](031-seventy-two-angels.md), which produced the data this
publishes.

Plan 031 read Lenain's *La Science Cabalistique* (Amiens, 1823) page by page
from the scan and left three artefacts: `data/kabbalah/lenain/pages.json5`
(168 pages), `apparatus.json5` (61 editorial notes), and a 272 KB Markdown
edition in `public/docs/`. Only the 72 genii reached a route, at
`/kabbalah/yhvh/72angels`. This plan gives the rest of the book one, at
`/books/la-science-cabalistique`.

An adversarial review of the settled design (Fable, 20 September) found the
design sound in shape and wrong in four particulars, each verified here before
being acted on. They are recorded under [What the review refuted](#what-the-review-refuted)
because three of them were claims made confidently in conversation.

## Why `/books/<book>` and not `/books/lenain`

Lenain published one book in his life — 500 copies, Amiens, 1823 — so an author
slug would be unambiguous today. But he also left *Le Rit Cabalistique* (1830),
which modern editions print alongside it, and under `/books/` the slug should
name a book. `/books/le-rit-cabalistique` stays free.

The English title *The Science of the Kabbalah* is Piers Vaughan's, for his
copyrighted translation. Titles are not copyrightable and the scruple that
matters is his text, which nothing here draws on — but the searcher's terms are
"Lenain", "72 angels", "kabbalah", "1823", so avoiding his phrase costs nothing.
Commit `b170693` removed it from the angels page and its search description,
where it had sat since 2023 introducing material it did not describe.

## What the review refuted

| Claimed | Actually | Checked by |
| --- | --- | --- |
| The `.md` is a build artefact | It is a *committed* artefact; nothing in the repo rebuilds it | `renderPages.ts:11,178` reads `output/`, which `.gitignore:10` ignores |
| The book risks cannibalising the angels page | The angels page serves no entry text at all | `curl` of production: "Vehuiah" ×3, "God elevated and exalted" ×0, "subtle mind" ×0 |
| Chapters are an even unit | CHAPITRE VI is 93,886 chars, 38 % of the book; CHAPITRE IV has ~12 | counted from `pages.json5` |
| `#p53` anchors are stable | `printedPage` flattens three sequences: 4, 6 and 7 each occur twice, and 26 is absent | counted from `pages.json5` |

The third and fourth change the design. The second changes the goal: everything
plan 031 produced is invisible to search today.

## The pipeline is not reproducible, and need not be committed to fix it

`renderPages.ts`, `plateSource.ts` and `apparatus.ts` all read
`output/lenainPages/` — 173 files, 740 KB, gitignored, produced by a vision pass
that cost real money and hours. Losing it would cost that again.

The fix is not to commit it. Every one of the 168 pages in the committed
`pages.json5` is **byte-identical** to its file in `output/lenainPages/`: the
committed data already *is* the transcription, and the scripts merely read the
throwaway copy. So:

- **`gatherPages.ts`** (new): `output/` → `pages.json5`. Run only after a
  re-transcription.
- **`renderPages.ts`**: `pages.json5` + `apparatus.json5` → the `.md`.
- **`plateSource.ts`**: reads `pages.json5`.

After which `output/lenainPages/` is disposable, the edition rebuilds from a
fresh clone, and the `.md` becomes a real `pnpm data:build` output rather than
something one machine happens to hold.

## The page model, before any URL is public

`printedPage` is an integer carrying three sequences at once — the 1909
reissue's front matter (`( IV )` → `4`), Lenain's own roman Avertissement
(`vj`, `vij` → `6`, `7`), and the arabic body 1–153. The `.md` already prints
`[p. 4]` twice. Page 26 does not exist: it is the fold-out leaf, photographed
folded.

Anchors are permalinks, so this is settled first:

```
printedPage: { number: 53, style: "arabic", sequence: "body" }
```

giving `#p53`, `#p-vij`, `#p-IV`, and `#leaf-42` by scan page for unnumbered
leaves. Page 26 renders as a stub carrying the fold-out note, which is the note
that explains its absence — and which no reader can currently see (below).

## Routes

| Route | Contents | Indexed |
| --- | --- | --- |
| `/books` | Index; one book for now | yes |
| `/books/la-science-cabalistique` | Title, provenance, contents, "About this edition" | yes |
| `…/preliminaires` | Half-title, 1823 imprint, title page, Papus, Avertissement | yes |
| `…/chapitre-1` … `…/chapitre-10` | Ten chapters; the four cabalistic tables sit inside IV, and TABLE DES CYCLES and 28 MAISONS inside VIII, as the book sets them | yes |
| `…/texte-integral` | The whole book on one page | **no** — `noindex, follow` |

Chapters are canonical. `texte-integral` exists because the design's own search
and print stories — find-in-page and print-to-PDF — work on one route at a time,
which for a 168-page book is neither; `noindex, follow` stops a 250 KB duplicate
outranking the chapters it duplicates while keeping link equity flowing.

CHAPITRE VI is 38 % of the book because it holds all 72 genii, so it carries
`#genie-1` … `#genie-72` from the data rather than from a render-time regex.

pdf 170–174 are excluded: blanks and the 1909 publisher's adverts for Paracelsus
and Lancelin, which are not Lenain.

## The apparatus has to reach a reader

`renderPages.ts:154` maps a note to a page via its genius, and book-level notes
have no genius, so `no === 0` is dropped. Three of 61 notes reach nobody: the
fold-out reconstruction, the U+05C4 encoding note, and the p. 35 "260 → 360"
correction. Confirmed: neither "fold-out" nor "U+05C4" appears in the `.md`.

`Note` gains an optional `page` and `anchor`. Genius notes render under their
entry; book-level notes render in "About this edition" and again at the page
they concern. `field: "p. 35"` stops smuggling a page reference into a field
name. The 144 `uncertain` readings render per page as a collapsed block: an
edition that hides the reader's doubts is not a scholarly one.

## The 529 KB liability

`public/docs/Lenain … - Google.txt` is the 2023 OCR this work replaced. It is
linked twice from the live page, sits in the service-worker precache, and serves
`200 text/plain` with no `X-Robots-Tag` — so it is today the only indexed full
text of the book, and it is the bad one.

It goes. Both links repoint at the new edition; git keeps it. Separately,
`globPublicPatterns: ["**/*", "!docs/**"]` keeps `public/docs` out of the
precache (the built `sw.js` lists the `.txt` among 302 entries today, and with
no override the 279 KB `.md` joins it next build), and a `headers()` entry sets
`X-Robots-Tag: noindex` on `/docs/:path*` so the raw Markdown cannot compete
with the HTML edition. Not `Disallow` in `robots.ts`: that would hide the
`noindex`.

## Rendering

Every `@mui/material` component is a client component. The reading surface is
semantic HTML with global CSS — `src/global.css` and the `MuiCssBaseline`
overrides in `theme.ts` are the precedent — and MUI is kept for chrome. Not
`react-markdown`: without `rehype-raw` it strips the note blocks and page
markers, and cannot emit ids, `lang` spans or ARIA roles.

Structure follows DPUB-ARIA, which exists for this: `role="doc-pagebreak"` with
`aria-label="page 53"` (screen readers offer page navigation on it),
`doc-footnote` / `doc-noteref` for Lenain's 102 note calls, `doc-chapter`,
`doc-endnotes`. Tables get a `<caption>` and a scroll container; the third
cabalistic table alone is 523 cells. Paragraphs fold across page boundaries with
the marker inside the paragraph, as EPUB does — the `.md` currently folds only
within a page, so the 41+ pages that open mid-sentence each start a broken one.

`lang="fr"` on the article, since `<html lang="en">` is fixed in the root layout.
Hebrew runs get `<span lang="he" dir="rtl">` by script detection: bidi damage is
already visible in the data (`Vehuiah .והויה` — the stop has crossed the
boundary). The fonts are already here and licensed, and both
`FrankRuehlCLM-Medium` and `NotoSansHebrew-Regular` cover U+05C4 and U+05BC,
which is Lenain's pointing exactly; `FrankRuehlCLM-stylesheet.css` is currently
imported only by `DocRender.tsx` and needs importing here too.
(11 November 2026: FrankRuehl CLM, plain GPL-2, is replaced by Frank Ruhl
Libre with an added U+05C4; see [plan 079](079-frank-ruhl-libre.md).)

Each page marker links to the facsimile: `books.google.com/books?id=ZqgpxTZ43HkC&pg=PA53`
resolves (HTTP 200, parameter preserved through a locale redirect).

## SEO plumbing

- Chapters are entity routes: `entityPages()` for the sitemap, `entityIds()` for
  `generateStaticParams`, `dynamicParams = false`. `routes.test.ts` requires
  every `page.tsx` be listed, be an entity route, or be private.
- Titles must fit 48 characters and be unique across `PUBLIC_PAGES`;
  descriptions 70–160. Enforced by `entities.test.ts` and `pages.test.ts`.
- `socialCard()` falls through to the `/` entry, so `/books` needs its own row
  or every chapter card reads "Magick.ly" with the pentagram.
- `pathnames.ts` has no `books`; unknown dynamic paths make `MyAppBar` render
  the site title as a `div`, so chapter pages supply their own `h1`.
- JSON-LD: `Book` on the index (author `Person` Lenain, `datePublished` 1823,
  `inLanguage` fr, `isBasedOn` the Google Books URL, `hasPart` `Chapter[]` with
  `pageStart`/`pageEnd`/`url`, and a preface part authored by Papus); `Chapter`
  plus `BreadcrumbList` on chapters. The CC BY 4.0 `license` goes on the
  *edition* `CreativeWork` that `isBasedOn` the `Book`, never on the `Book`: the
  text is public domain, the reading is ours. Expect no rich result from `Book`;
  `BreadcrumbList` is the visible win and the site has none.
- `dateModified` from `git log -1 -- data/kabbalah/lenain`, not build time, per
  the sitemap's existing policy of not letting a build pose as a modification.

## Integrity

`data/build.mts` globs every `*.json5`, so `data/dist/kabbalah/lenain/pages.json`
(507 KB) is already emitted — but `lenain` is absent from `tables.ts`, it has no
valibot schema, and `integrity.ts` never sees it. `pnpm data:check` reports
"nothing wrong in 26 tables" while never looking at the largest file in `data/`.

The book is a document, not an id-keyed table, so it needs its own check: block
kinds, unique anchors, per-sequence page monotonicity, every note's `no`/`page`
resolving, exactly 72 entry starts in order, heading levels present.
`data/kabbalah/lenainQuotations.test.ts` (commit `74a28ce`) is the precedent —
it holds every psalm quotation against the bracketed Latin in Lenain's own text
after three reviews failed to stop an instruction-based fix from regressing.

## Measurements

| Spike | Result |
| --- | --- |
| B — `tsc` cost of importing `pages.json` | +5,317 types (408,725 → 414,042), +29 MB, no time change (8.93 s → 8.87 s). A quarter of the dictionary's ~19,300; does not force the decision |
| E — production indexability | Live HTML serves no entry text; no cannibalisation risk exists |
| F — Google Books deep links | `pg=PA53` HTTP 200, parameter preserved |
| G — `/docs` headers | Deployed `.txt`: `200 text/plain`, no `X-Robots-Tag` |
| H — Hebrew coverage | FrankRuehlCLM and NotoSansHebrew both cover U+05C4 and U+05BC |

Measured at `b170693`. A — payload per route, C — the Serwist fix, and D —
anchor scroll under the fixed `AppBar` need a route to exist, so they run in
step 1 rather than before it.

## Steps

1. **Reproducibility and the page model.** Split gather from render; point
   `plateSource.ts` at `pages.json5`; make `printedPage` a sequence-aware
   object; regenerate. No routes yet. Spikes A, C, D land here.
2. **The apparatus reaches the reader.** `page`/`anchor` on `Note`; book-level
   notes rendered; `uncertain` surfaced; paragraphs folded across pages.
3. **Integrity.** The document check in `integrity.ts`.
4. **Routes.** `/books`, the book, preliminaries, ten chapters, `texte-integral`.
   Semantic HTML, DPUB-ARIA, facsimile links, Hebrew spans.
5. **SEO.** Entity pages, JSON-LD, social card row, `pathnames.ts`.
6. **The liability.** Delete the OCR `.txt`, repoint links, `globPublicPatterns`,
   `X-Robots-Tag`.
7. **Print stylesheet.** None exists in `src/` today: `break-before` at chapters,
   the fixed bar hidden.

## Commits

| SHA | What |
| --- | --- |
| `254c8f5` | This plan |
| `2eca0da` | Gather split from render; the leaf gains an identity and an anchor |
| `95e31d3` | `evidence.json5`: the readings every correction is derived from |
| `99d4e1a` | The second Hebrew reading committed; reproducibility proven |
| `988c8f9` | The apparatus and the reading's doubts reach a reader |
| `4107a51` | The edition checked as a document |
| `8f3bb9c` | The volume divided as it divides itself |
| `827cf5e` | One fold for both renderers |
| `b3f56a8` | The routes |
| `b484fb5` | Structured data |
| `7ec78ea` | The OCR retired; the book out of the app shell |
| `22ca738` | Seventy-two per-genius routes (follow-up) |

### What step 1 found that this plan did not anticipate

The plan named one gitignored dependency. There were three, and the other two
were worse than the first, because they were the *evidence*: `scanned` — what
each entry prints, from which all 33 correction notes are derived — and the
close-crop Hebrew reading, which is half of what "two independent readings
agree" means. A scholarly edition whose corrections cannot be checked against
the readings behind them is not one, and the repository held neither.

Both are committed as `data/kabbalah/lenain/evidence.json5`. The test that
found this is the one worth keeping: check the branch out into a worktree with
no `output/` at all and rebuild. It failed twice before it passed, and each
failure named the next thing missing. It now rebuilds the apparatus and the
272 KB Markdown byte for byte from the repository alone.

`assemble.ts` still reads the extractions, by design: it is a gather step like
`gatherPages.ts`, run after a re-extraction, and what it writes is committed.

## Other witnesses (18 November 2026)

The scan this edition transcribes is not a facsimile of 1823. Set beside the
1823 printing, page 53 shares no line break with it, its spelling is
modernised ("savans", "talens" → "savants", "talents"), and the same page
number holds different text. The reissue (OCLC records a 1909 printing of 153
pages) was reset from scratch. So the page numbers this edition anchors to are
the reissue's, not Lenain's, and an error in its text may be its compositor's.
The base text stays the reissue: its anchors and routes are public, and
re-reading 178 pages of 1823 is a separate decision.

Two further copies were read where the apparatus turns on a value, each by a
reader not told the edition's own reading, and recorded in
`packages/magick-data/src/kabbalah/lenain/witnesses.json5`:

| Witness | Where | What it is |
| --- | --- | --- |
| 1823 printing | Google Books `qt9SAAAAcAAJ`, Koninklijke Bibliotheek | Lenain's printing; original paper wrapper, no Papus preface. The fold-out is folded too, but shows rows 57–72 |
| Ms 5365 | archive.org `BIUSante_ms05365`, BIU Santé, Licence ouverte | An undated handwritten copy of 1823; omits the first table. Its variants are the copyist's |
| Lyon's second copy | Google Books `BqzyzEEX3MAC` | The same reissue as ours, folded the same way |

What they settled, against the reissue:

- **The reissue's own errors**, which the apparatus had laid at Lenain's door:
  18's and 71's presiding days, 53's and 62's degrees, the forty-sixth's
  ordinal ("36e"), the five revolutions ("260 jours"), the twelfth's damaged
  "qui.l", and the Hebrew of 37 (אנואל for אניאל), 68 (הבויה for חבויה) and,
  found later (below), 69 (ראחאל for ראהאל).
  The 1823 printing has the right value in each.
- **Lenain's own**, confirmed: every other table disagreement is in 1823 too.
- **The reissue correcting Lenain**: the sixth's Hebrew is ללחאל in 1823, ללהאל
  in the reissue; the thirtieth's last day is 18 janvier in 1823, the 31st the
  tables require in the reissue.
- **An artefact of ours**: genii 8, 38 and 44 give no hour in either printing.
  The apparatus called them "printed 0:00"; they now say nothing is printed.
- **The first table**: the 1823 plate adds rows 57 (cut through) to 61, names
  the sixty-second (Iahhel, blank on the reissue's), and has "Haiaiel" and
  "Les Brachmanes" where the reissue has "Haiuiel" and "Les Brahmanes". Rows 1
  to 56 are on no image of Lenain's plate found.

The other forty-seven Hebrew names, the ones two machine readings of the
reissue agreed on, were then read from the 1823 pages too (that printing only,
no manuscript), and all seventy-two compared with their triads of the Shem
HaMephorash, derived from Exodus 14:19–21. The verses are committed as
consonantal text in `packages/magick-data/src/kabbalah/shemHaMephorash.ts`,
citing Sefaria's "Miqra according to the Masorah", and a test holds every name
to its triad and to ending יה or אל, so a new departure fails the build. What they found:

- **One more reissue misprint**: the sixty-ninth is ראחאל in the reissue,
  ראהאל (the triad ראה) in 1823, p. 92. As for 37 and 68, the data gives the
  1823 letters and keeps the reissue's beside them; this is the first such
  name a machine read rather than a person, so the rule that lets the name
  differ from the reissue's letters now follows the witness's `reissue`
  verdict, not the hand readings.
- **Two slips of Lenain's the reissue corrected**: the twelfth is חהעיה in
  1823 (p. 53), a clear het beside a clear he, where the reissue and the triad
  have ההעיה; and the fifteenth is set backwards in 1823 (p. 54), לאירח, its
  last letter what looks like a het where the reissue's הריאל and the triad
  have he.
- **Lenain's own spellings**, the same in both printings and so kept: 24
  ההויה, 33 יהויה, 34 לההיה, 38 העמיה, 51 ההשיה, 59 הרהאל and 64 מהיאל have
  he where the verse has het, and 30 ומאאל has the triad אומ's letters in
  another order. Each now has a note saying what the verse gives.
- **An ending of Lenain's**: the sixty-sixth, Manakel, is מנקאה in both
  printings (1823, p. 91), ending אה where every other name he spells -el
  ends אל and the tradition has מנקאל. It is kept, with a note, and the test
  also holds every name to ending יה or אל, with 66 the one listed exception.

Five stay open. For 1, 4, 5, 7 and 8 the 1823 scan seems to show het where the
reissue and the verse have he, but at the scan's resolution this cannot be
settled; a sharper image of pp. 46–51, from Amiens or Gallica, would settle it.
Nothing is recorded for them until then.

No copy with the plate opened was found: Gallica and HathiTrust refused
automated access, and Papus's *La Cabbale* (1903) describes the book without
reprinting the table. Lenain's own sources were found and are cited:
Agrippa, *La Philosophie occulte* (The Hague 1727), vol. II pp. 109–110
(archive.org `per_witchcraft-in-europe-and-america_agrippa-von-nettesh_1727_12_22`,
leaves n588–589), the 72 names in Lenain's spellings; and Kircher, *Oedipus
Aegyptiacus* II.1 (1653), pp. 271–273 (archive.org `A027083`, leaves
n278–280), the 72 angels by choir, whose last page Lenain cites, and p. 287
(leaf n294), where Kircher says every nation's name of God has four letters
and introduces "schema quod sequitur". Agrippa's table gives only the names.
Kircher's schema is a plate of seventy-two four-letter names of God, each with
its nation (Kalo and Zeut, Lenain's last two, are on it), so it is very likely
the source of Lenain's last two columns. It is not in the Seville copy
(`A027083`) but is in the Complutense copy, `bub_gb_XjfzMnomDQoC`, leaf n294
(digitised by Google), photographed partly folded: the wheel's left part is
folded over. It has since been transcribed from an unfolded copy (below,
"Kircher's plate").

**The mirror** (18 November 2026). The pages the edition leans on hardest
are now mirrored in the app and open in the lightbox of plan 080's "Source
links and mirrored pages": both plates' p. 25 (1823, `qt9SAAAAcAAJ`;
reissue, `ZqgpxTZ43HkC`), Kircher's pp. 271, 272 and 273 (the table's rows 1
to 24, 25 to 67 and 68 to 72) and p. 287, and the 1727 Agrippa's pp. 109 and
110. The eight are 2,356,672 bytes, Kircher's yellowed colour scans the
heaviest (p. 273 is 453,438), so the mirror now holds 3,000,510 bytes and
the cap in `src/sources/mirroredPages.test.ts` was raised from 1.5 MB to 3.5
MB, deliberately: these are the pages a reader needs to check the first
table and Lenain's sources, and the room left is for a page or two, not a
second book. Google Books pages cannot be fetched by a script, so their
originals were fetched by hand and are kept outside the repository; `pnpm
sources:mirror --originals <dir>` reads and hash-checks them, and the
caption credits "digitised by Google Books", as Google's notes on its scans
ask. The reconstructed first table's account of the plates, the Markdown's
(plain links: Markdown has no lightbox), the book's Sources list and the 72
angels page's note link them. The per-note witness pages stay outside links
(decided 18 November 2026). Kircher's plate of the names of God by nation
stayed an outside link that day, as the only copy found was partly folded;
it was mirrored the next (below). If more pages are wanted, the mirror moves
to the app's file storage rather than growing here.

**Kircher's plate** (19 November 2026). Lenain's first table follows
Kircher's plate of the seventy-two names of God by nation, the fold-out
"Iconismus inserendus tom. II Fol. 287" in *Oedipus Aegyptiacus* II.1
(1653), row for row: a wheel of seventy-two rays, each with a four-letter
name of God in its outer ring and that name's nation in the ring inside it.
An unfolded copy, the National Library of Poland's, is on Wikimedia Commons
("Kircher-Diagram of the names of God (22593924).jpg", 2926 × 4000, SHA-256
`02d659c4…bea6`, marked public domain; Polona item `OTAyNjM5Ng`, image 289).
A machine reader not told Lenain's table transcribed its seventy-two rays,
as engraved, into `packages/magick-data/src/kabbalah/lenain/kircherPlate.json5`,
whose header gives the method. The rays' numbers stand in the gaps between
the sun's spikes, over the cell dividers, so the geometry alone does not
say which cell a number belongs to; giving each to the cell clockwise of it
puts 1 on Hebræi and 72 on Thraces (KALO), which is where the plate's own
sequence breaks, and Lenain's table follows that numbering row for row.
The first ray's name is engraved יהרה, a resh for the Tetragrammaton's
vav: the engraver's slip, recorded and not corrected. The rings inside
these two have forty-two cells, do not follow the rays, and were not
transcribed.

Where an entry departs from its ray, the departure is recorded in the same
file by hand, and the apparatus gives it a note (kind `reading`: the entry
keeps Lenain's words, as decided, so nothing is corrected; the note says
what his source has). Where the line falls: a different spelling of the
same name in another alphabet or the same letters is transliteration, not a
departure (V for U, Y for I, TH for T, a letter doubled or not, Greek in
roman letters, the Tetragrammaton as Jehovah, الله as Allah, Θωντ as Teut
or Theuth, an alternative Lenain adds with "ou"); a second name joined with
"et", a different word, a different people, or nothing at all is one. A
test holds every entry's name of God, and every plate cell's, to that rule
and to the recorded list, in both directions. A nation cannot be compared
with its Latin by rule, so every one is listed: the 59 rays an entry does
not depart from are recorded as accepted pairs (Galli, la France), and a
test holds every entry to an accepted pair or a recorded departure, never
both. The 1823 printing was then read for the nation and the name of God
at every departure, by a reader not told either value, and recorded in
`witnesses.json5`; the build holds each verdict to that reading (`lenain`
must match the entry, `reissue` and `reissueChanged` must differ from it,
once "la langue des" and the article are set aside):

| Row | Kircher | Lenain's entry | Whose |
| --- | --- | --- | --- |
| 2 | Syri, ܐܠܗܐ | la Turquie, Aydy | Lenain's (1823 p. 47) |
| 3 | Chaldęi, אלוה | no nation, no name | Lenain's (p. 47) |
| 7 | Armeni, an Armenian name | no nation, no name | Lenain's (p. 50) |
| 10 | Persæ, ΣΥΡΙ | Perses, "Siré et Eipi" | Lenain's (p. 52) |
| 26 | Saraceni, AGDI | Sarrazins, "Agdy et Abdi" | Lenain's (p. 62) |
| 35 | Angolani, ANVP | no nation, Anup | Lenain's (p. 68) |
| 41 | Islandi | la langue irlandaise | Lenain's (p. 73) |
| 45 | HOBA | Hobo | Lenain's (p. 76) |
| 46 | PIVR | Pino | Lenain's (p. 76) |
| 49 | MORA | Mara | Lenain's (p. 78) |
| 50 | Samatrani | les Samaritains | Lenain's (p. 79) |
| 51 | Narsingi | les Barsiens | Lenain's (p. 80) |
| 53 | Maldiuij | les Maltais | Lenain's (p. 82) |
| 58 | Ælamitæ | les Célamites | Lenain's (p. 85; both plates) |
| 61 | Bactriani | les anciens Béthuliens | Lenain's (p. 87; the 1823 plate) |
| 64 | Mogores | les Mongols | the reissue's: 1823 has Mogols (p. 89), as both plates |
| 68 | Cretenses, ΔƐΟS | les Péloponésiens, Dépos | Lenain's (p. 92; both plates) |
| 69 | Peloponeſij | les Crétois | Lenain's (p. 92; both plates) |

Row 10's two names look like the one engraved ΣΥΡΙ read twice, as Greek
(Siré) and as Latin capitals (E, I, P, I); it is a departure because Lenain
gives two names, joined by "et", where the plate has one.

So every departure is Lenain's but one: the reissue turned his Mogols
(Kircher's Mogores, the Mughals) into Mongols, a new verdict,
`reissueChanged`, since it is a change rather than a misprint. Lenain's
68 and 69 have Kircher's two nations exchanged. Two entries the table
leaves without a nation are not departures: the 37th gives Abda
« d'après les anciens Philosophes » and the 38th derives Agla from a verse
« Suivant les cabalistes », Kircher's Philosophi and Cabalistæ; the table
says so beside them. The 1823 printing also reads "Alla" for the fourth's
name of God where the reissue has "Allah", which is not a departure from
the plate and has no note.

The reconstructed table (page and Markdown) now sets Kircher's nation and
name of God beside every row, labelled as Lenain's source, with each
departure named in its source column and a paragraph of counts computed
from the recorded departures: the entries give Kircher's name of God in 63
of the 72 rows and his nation in 59, the 37th and 38th among them by
attribution. A name whose letters the reader marked medium or low
confidence (rays 1 to 5, 7, 15, 68 and 69) is marked "reading uncertain"
in words, and the notes on those names say so; ray 1's slip and ray 7's
guessed Armenian are said beside their rows. The Syriac, Arabic, Armenian
and Greek names, in the table and in the notes, are marked with their
language and direction (`syr`, `ar`, `hy`, `grc`), as the Hebrew is; no
font is loaded for them (the font rule covers Hebrew only), so they fall
back to the reader's system fonts. Rows 1 to 56 are still put back from
the entries, not read from Lenain's plate, but each now stands beside its
source.

The plate is mirrored (`kircherPlate` in `src/sources/mirroredPages.ts`, a
new scan kind for Wikimedia Commons: the file page as the link, the stable
`upload.wikimedia.org` URL as the original, Polona as "the whole book"),
1600 pixels wide, 779,994 bytes, with the two outer rings outlined as a
ring rather than a rectangle. The book's Sources list, the reconstructed
table and every departure's note link it; the Complutense copy stays
listed as the second copy. That takes the mirror to 3,780,504 bytes, so the
cap in `src/sources/mirroredPages.test.ts` was raised from 3.5 MB to 4.5
MB, deliberately: this is the source the first table's every row is set
beside, and a reader checking a note needs to see it. The room left is for
a page more; past that, the app's file storage. Wikimedia refused the
script's own download with HTTP 429 on 19 November 2026 while serving curl
the same file, so `pnpm sources:mirror` (which names itself
`magickli-sources-mirror/1.0`) tries the download first and reads a copy
fetched by hand from `--originals` only when it is refused (403 or 429) or
the request fails, saying which it used; any other status stops the run.
The hash is checked either way.

## Follow-ups

- ~~**72 per-genius routes**~~ — done, `22ca738`. `/kabbalah/angel/<name>`,
  seventy-two static pages at about 9.5 KB brotli each, all in the sitemap.
  The slug is the bare name except for Lauviah, who is both the eleventh
  genius and the seventeenth and so carries a number; a URL disambiguates
  what is ambiguous and nothing else. The link to each sits in the accordion's
  *summary*, since its contents are the part no crawler sees.
- A client-side search index (JSON + minisearch), deliberately deferred.
- A typeset PDF from the Markdown via pandoc, committed beside it.
- The angels page's accordions hide all 72 entries from crawlers. Fixing that is
  the per-genius routes' job, but it is worth stating plainly: the page has
  almost no indexable content.
- `output/preview-refresh-*` holds 7.8 GB of stale build directories.
- Gallica (BnF) may hold a copy with the plate opened; it needs a person in
  a browser. The Bibliothèque Louis Aragon in Amiens holds two copies of 1823,
  shelfmarks 42247 and M 2762, not digitised. A photograph of p. 25 with the
  plate unfolded and of pp. 46–51 from either would settle the first table and
  the open he/het names, 1, 4, 5, 7 and 8 (see "Other witnesses").

