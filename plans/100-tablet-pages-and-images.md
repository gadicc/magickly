# The tablets' own pages and images in search — 25 November 2026

Status: agreed, 26 November 2026. Gadi chose per-tablet pages over files
under the hub alone (25 November 2026) and signed off the invariants, the
size ceiling and the recommended page contents and files (26 November
2026). A value review (fresh Opus 5.5, high, 26 November) trimmed the
pages and found three pieces of work the draft missed; its changes are
below, marked "(value review)". A correctness review (Fable 5.2, high,
26 November) found no blockers; its fixes are marked "(correctness
review)". Next: the build on `gate/095-tablets-image-search`. Follows plan 095's follow-up "The
tablets in image search" (23 November 2026). Read
[current status](000-current-status.md) first. The number was free on
every branch when drafted.

## Background

`/enochian/tablets` is one page whose tablet, version, tab and switches
are query parameters (`?tablet=fire&version=dee&pyramids=1`). Search
engines index an image under the page that shows it, and every variant
here is the same page, drawn as an inline SVG, so no tablet has an image
of its own to find. The kameas (plan 093, K4), the angels' and
planetary sigils (plans 088, 096) and the temple halls (plan 062) each
publish a PNG and an SVG on a stable path under a page of their own,
drawn at build time by the image route's renderer, with alt text,
`ImageObject` structured data under CC BY 4.0, an Open Graph image and
sitemap entries. This plan does the same for the tablets.

### Which images: the versions are near-duplicates

Squares whose letter differs from the Golden Dawn's version (`gd`),
counted on `main` at 7dfc73cb (case-folded, of 156 squares; the Union
has 20):

| Tablet | Regardie | Equinox | Dee 1584 | Raphael 1587 |
| --- | --- | --- | --- | --- |
| Earth | 1 | 10 | 12 | 6 |
| Air | 1 | 6 | 7 | 4 |
| Water | 6 | 9 | 7 | 6 |
| Fire | 3 | 4 | 4 | 4 |
| Union | 0 | 0 | none | none |

As pictures, the versions differ in at most 12 squares of 156:
publishing each one would make thin near-duplicates. The Golden Dawn's
version is the page's default and the one most searched for. The other
versions stay views of the tool, as does every other switch.

### Sizes, measured

The two drawings per tablet, at 7dfc73cb (after plan 099's rounding),
through `renderComponentImage` at the contracts' defaults (PNG 840 ×
1188, the Union 496 × 416):

| Tablet | Flat SVG (gzip) | Flat PNG | Pyramids SVG (gzip) | Pyramids PNG |
| --- | --- | --- | --- | --- |
| Earth | 117 KB (27 KB) | 117 KB | 1,041 KB (128 KB) | 286 KB |
| Air | 120 KB (27 KB) | 126 KB | 1,044 KB (128 KB) | 316 KB |
| Water | 118 KB (26 KB) | 125 KB | 1,015 KB (126 KB) | 309 KB |
| Fire | 124 KB (28 KB) | 130 KB | 1,021 KB (128 KB) | 312 KB |
| Union | 11 KB (3 KB) | 19 KB | 156 KB (7 KB) | 29 KB |

Each drawing renders in under 0.35 s, the twenty in about 3 s.

## Invariants (signed off)

1. **The tool does not change.** `/enochian/tablets`, its URL state,
   Share, the export box and `/api/render` behave exactly as today, and
   their tests pass unchanged. The hub only gains links to the five
   pages. Two exceptions (value review): `/api/render`'s tablet images
   gain `noindex` (see invariant 4), and the app bar's title menu lists
   the five pages once `tablets` is a section with children (on the hub
   itself the menu then shows its five children rather than its siblings
   Dictionary, Keys, Oration and Translator). The tool's files may move
   code without changing behaviour: `groupOf` moves from the client
   `NamesPanel.tsx` to `nameWords.ts`, so a server page can call it
   (correctness review).
2. **No new drawing.** Every published file is drawn by the existing
   contracts, `enochian-tablet` and `enochian-tablet-pyramids` with
   `symbols=outward`, at their defaults in the `gd` version, through
   `renderComponentImage` with the same query the tool's export would
   send; a test holds each file's query to it.
3. **Ten images, twenty files, nothing else.** Each of the five tablets
   flat and as pyramids with their symbols, as a PNG at the contract's
   raster default and as an SVG, under fixed descriptive names. Every
   other path under a tablet's page is a 404, as the kameas' are.
4. **Every file is findable as the kameas' are.** It appears on its
   page (the PNG as an `<img>` with alt text, the SVG as a download), in
   the page's `ImageObject` structured data (licence, credit, the source
   it is based on), and in the sitemap under that page; the page's social
   card is its own tablet, and the flat PNG is its own `og:image` after
   the card, as `pageMetadata` orders them (`src/seo/metadata.ts:41-53`).
   `/api/render`'s copies become unindexed: neither tablet contract sets
   `indexed: false` today, so both gain it, as `kamea` did in plan 093
   (`src/render/contracts/kamea.ts:57`). The other versions' images then
   carry `noindex` too, which the near-duplicate argument above already
   supports (value review).
5. **The pages are reference pages, built from the data.** Server
   rendered; the only client code is one small module (`TabletFigures`,
   as `KameaFigures.tsx` is for the kameas) for what must be translated
   through `useUiLanguage`: the images' alt text, the names list's labels
   and the previous and next links (correctness review: `PrevNext` and
   `nameLabel` cannot carry translated labels from a server component).
   Every fact (names, letters, differences, sources) comes from
   magick-data; the quarters, which magick-data holds only in each
   note's prose, are written into the titles, and a test holds each to
   its note; site search gets each tablet's own document through an
   adapter, as the kameas' do, since five pages sharing one component
   would otherwise extract the same prose; interface text is translated
   into Hebrew; the pages are English editions only, as the hub is.

**Size ceiling:** five pages and one route of files; the twenty files
about 6.5 MB in all (about 2.4 MB as served, with the SVGs compressed;
the draft's 5.5 and 1.3 MB were a sum slip, correctness review), built in a few
seconds; the shared `TabletPage` under about 400 lines (the value
review's estimate is about 180), sharing one component as the kameas do.
Past that, cut scope before going on.

## What the pages hold (decision 1, trimmed by the value review)

`/enochian/tablets/earth`, `/air`, `/water`, `/fire` and `/union`, one
component (`TabletPage`) as `KameaPage` is:

1. **A lede**: one templated sentence (which tablet, its element, its
   three holy names and its King), then the tablet's own note from
   `TabletNotes` (182 to 447 characters each, with the Golden Dawn's
   quarter and Dee's names for it). The Union's sentence names its four
   lines (Exarp, Hcoma, Nanta, Bitom) instead, as it has no element,
   holy names or King.
   This replaces the draft's separate versions section: the notes carry
   each tablet's own text, while the per-version wording in `differs` is
   the tool's.
2. **The tablet**: the flat PNG, with a caption, a link to open it in
   the tool (`/enochian/tablets?tablet=fire`), the SVG as a download,
   and one line of counts from `countDifferences`
   (`src/app/enochian/tablets/squareReadings.ts:136`) on how many
   squares each other version changes (its letter, u/v and empty counts
   summed, as the table above is; not case, and not `squares.length`;
   a version without the tablet is left out), linking to the
   Differences tab.
3. **Its names**, read off the tablet in the Golden Dawn's version: the
   holy names, the King, the six Seniors, then each sub-quadrant's names
   as the tool groups them (58 for a Watchtower; the Union's lines),
   each linked to its dictionary entry where one exists. A static
   grouped list: `NamesPanel` is an interactive client component and is
   not reused. The server page works out each name's href
   (`TABLET_NAME_LINKS` is server-only, `nameLinks.ts:150`) and passes
   it to `TabletFigures`, which renders the labels.
4. **As pyramids**: the pyramids PNG, loaded lazily, with a one-sentence
   caption citing Regardie, vol. 4, p.295 through `<Cite>`, linking to
   the hub's explanation (`/enochian/tablets#tablets-pyramids`) and to
   the tool drawing what the image shows (`?tablet=<id>&pyramids=1&symbols=1`), and the SVG as a download. The
   draft's paragraph would have repeated the hub's text on all five
   pages (value review).
5. **Sources**, and the previous and next tablet.

Five static page files, `src/app/(public)/enochian/tablets/<id>/page.tsx`,
as the kameas' are, with literal `pageMetadata` and `PageBreadcrumbs`
paths (`src/seo/routes.test.ts:33-70`), five `PUBLIC_PAGES` entries,
five `ROUTE_PLACEMENT` keys and the `pathnames` section; no `[tablet]`
page. The files' handler sits one level below, at
`src/app/enochian/tablets/[tablet]/[file]/route.ts`, since Next forbids
a route handler at the same segment as a page (correctness review).
The tool's hrefs are literals, held by a test to `tabletQuery`, since
`urlState.ts` is a client module.

The hub links to the five pages, so they are crawled from it, and each
page's breadcrumbs run Enochian › Tablets › the tablet. The hub stays
canonical for the tool; the pages are its reference, as the kamea pages
are beside `/astrology/kamea`. The hub prerenders Earth by default, so
its HTML holds Earth's names too; with separate canonicals and the names'
search documents moved to the pages, that overlap is accepted.

Titles take the kameas' form (`src/seo/pages.ts:52`) without "The", to
stay within `pages.test.ts`'s 60 characters with the site's suffix:
"Enochian Fire Tablet: Watchtower of the South", "Enochian Tablet of
Union". Each Watchtower's description leads with its three holy names,
the most searched strings; the Union's with its four lines.

### What it reuses (value review)

- `EntityFrame`, `Lede` and `PrevNext` from `src/ui/entity/index.tsx`
  (not `KameaPrevNext`, whose labels are the kameas').
- `Sources` (`src/app/enochian/tablets/Sources.tsx`), fed the note's
  sources, linking through magick-data's `sourceUrl` as the hub does
  today. `isBasedOn` takes only the Regardie entries, which the `gd`
  drawing follows; the note's other sources (Casaubon, the Equinox) are
  cited for Dee's names, not for the drawing (correctness review).
- `TABLET_NAME_LINKS` (`nameLinks.ts`), `linkedHeadword` and
  `dictionaryHref` (`dictionaryLinks.ts`); `tabletNames` with
  `groupLabel`, `nameLabel` and `displayName` (`nameWords.ts`), and
  `groupOf`, moved there from `NamesPanel.tsx`.
- `JsonLd`, `GD_HALL_LICENCE`, and the kamea file route, copied almost
  line for line.

## The files (decision 2)

Under each page, served by one route as
`src/app/astrology/kamea/[planet]/[file]/route.ts` serves the kameas'
(`dynamicParams = false`, stable names revalidated by ETag):

| Tablet | Flat | Pyramids |
| --- | --- | --- |
| Earth | `enochian-earth-tablet.{png,svg}` | `enochian-earth-tablet-pyramids.{png,svg}` |
| … | … | … |
| Union | `enochian-tablet-of-union.{png,svg}` | `enochian-tablet-of-union-pyramids.{png,svg}` |

The names follow the downloads' (`enochian-earth-tablet-pyramids-symbols`
is the tool's download name; the published file drops `-symbols`, since
only that one is published), except the Union's: its download is
`enochian-union-tablet`, and the published file takes the name it is
searched by, "tablet of union". The page shows the PNG, as every page in
the pattern does (`KameaFigures.tsx:53`, the halls, the angels' sigils),
so the picture on the page is the Open Graph image and the first
`ImageObject`, and a phone never decodes the 1 MB pyramids SVG to show
the page; the SVGs are published and offered as downloads (value
review; the draft recommended showing the SVG).

## Search and social cards (value review)

- **Search.** The five paths join `ADAPTED_PAGES`
  (`src/search/adaptedPages.ts`), and the catalogue builds each page's
  documents from its data: the lede sentence and note, and the names,
  which `tabletNamesText` already gives per tablet and the catalogue
  today files under the hub (`src/search/catalogue.ts:539-547`); they
  move to each tablet's page. Embeddings are published with the change
  (under the ledger's rules).
- **Social cards.** The `/enochian/tablets` prefix in `src/seo/cards.ts`
  would give all five pages Earth's card; each page gets its own tablet
  through a per-tablet list, as `KAMEA_SECTIONS` does.

## Tests

- Each file's query equals the query the tool's export sends for that
  drawing, and each file's raster is the contract's default; one route
  request (the Union, the smallest) returns `renderComponentImage`'s
  bytes; any other name is a 404. (The draft's byte equality for all
  twenty would redraw about 4 MB of SVG a run and prove nothing the
  route's own call doesn't, value review.)
- Both tablet contracts are `indexed: false`.
- The sitemap lists each page with its four files, the PNGs first.
- Each page's structured data names its two images' files, licence and
  source; its Open Graph image and card are its own flat tablet.
- Each page's title names the quarter its tablet's note gives.
- Each page lists every name `tabletNames` gives its tablet in the `gd`
  version, and links each that has a dictionary entry.
- Search: each page has its own documents (lede and names), and the hub
  no longer files the tablets' names.
- The tool's tests pass unchanged; the hub links to the five pages.

## Commits and gates

1. `docs(plans)`: this plan, as agreed.
2. `feat(enochian)`: the files' module and route, the contracts'
   `indexed: false`, with tests.
3. `feat(enochian)`: the pages, the hub's links, metadata, cards,
   sitemap, search adapter, translations (with `pnpm i18n:context` and
   its snapshot, since `pathnames.ts` is in the shell scope), and the
   embeddings they need (AGENTS.md: vectors go with the change that
   needed them).
4. `docs(plans)`: as built.

Full gate on the branch; land on local `main`; pushing is Gadi's.
Checked in the browser at 375, 768 and 1,440 px, light and dark.

## Out of scope

- Other versions' or switches' images, and Hebrew editions of the pages.
- Moving the tool to per-tablet URLs (`?tablet=` stays).
- The 3D view (its own plan).

## As built (26 November 2026)

Built by Opus 5.5 (high) on `gate/095-tablets-image-search`; the plan was
reviewed for value by Opus 5.5 (high) and for correctness by Fable 5.2
(high), and the code by a fresh Opus 5.5 (high) reviewer, which found no
blockers or majors; its minors were fixed before landing.

| Commit | What |
| --- | --- |
| 902d8ed4 | This plan, as agreed. |
| 471744db | The twenty files and their route; `indexed: false` on both tablet contracts; the tool's export link moved to `exportLink.ts` so the files' test holds each query to it. |
| 3641d0d9 | The five pages (`TabletPage`, 193 lines, and the client `TabletFigures`), the hub's links, titles and descriptions, cards, sitemap, the search adapter, Hebrew translations and the embeddings (17 records, 2,361 tokens, about $0.025; then 3 more, 579 tokens, about $0.021, after the rebase onto the symbols' correction). |

Where the build departs from the text above:

- The lede's templated sentence is rendered in `TabletFigures` too, since
  its element word is translated.
- The files are ordered flat PNG, pyramids PNG, flat SVG, pyramids SVG,
  so the sitemap lists the PNGs first.
- The Union's counts are left out, since every version that has it reads
  it alike.
- Each figure offers its SVG as a download; the PNG is the image shown.
- The pyramids' caption follows main's correction of the symbols'
  facing (01844766, 26 November 2026), which landed during the build:
  p.295 for the colours only, and Regardie's drawings, pp.294 and 296,
  for each symbol standing on its side's outer edge. The published
  pyramids files are drawn by the corrected contract (image profile
  v3), as the route draws whatever the contract draws.

Checked in the browser at 375, 768, 1,024 and 1,440 px, light and dark:
no sideways scroll, the names' roles beside their names, the images
scaled within the column.
