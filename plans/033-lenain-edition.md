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
| *(next)* | The second Hebrew reading committed; reproducibility proven |

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

## Follow-ups

- **72 per-genius routes**, English-led, under the angels page — the real SEO
  opportunity, since a 94 KB French chapter will never rank for "Vehuiah" and
  nothing of ours currently does. French on book routes, English on angel
  routes, cross-linked.
- A client-side search index (JSON + minisearch), deliberately deferred.
- A typeset PDF from the Markdown via pandoc, committed beside it.
- The angels page's accordions hide all 72 entries from crawlers. Fixing that is
  the per-genius routes' job, but it is worth stating plainly: the page has
  almost no indexable content.
- `output/preview-refresh-*` holds 7.8 GB of stale build directories.
