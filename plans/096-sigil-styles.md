# Sigil styles — 23 November 2026

Status: accepted 23 November 2026; nothing built. Revised the same day
after an adversarial review ([Review](#review-23-november-2026)). Gadi
decided to offer four styles of an angel's rose sigil from the mock-up,
not Vaughan's spaced letters, one at a time, with the name in the band
as the default and a dropdown for the rest; from a mock-up of the list,
no picker on the 72 list (decision 12); on files, the hybrid (decision
3); the other decisions as recommended. Some claims the design rests
on are unproven, and stage Y1 tests them before any code
([Unproven claims](#unproven-claims-what-y1-tests)). Follows
[plan 088](088-rose-sigil-oracle.md) (the engine, and S4: the angels'
pages and their static files). Its shape is
[plan 093](093-kameas-and-their-sigils.md)'s. Read 088's S4,
`src/seo/angelSigilFiles.ts` and `src/render/registry.tsx` first.

`src/seo/angelSigilFiles.ts` and `ListSigil.tsx` are on
`gate/sigil-followups`, about to merge; `src/sources/works.ts` and
`<Cite>` are on `main` (`48b5d679`, `3fd4826c`). The work starts from
`main` once that branch is in.

## Why

Each of the 72 angels' pages shows one figure today: the sigil over the
Golden Dawn's rose (plan 088, S4). That figure shows the method. It is
not how any source presents a finished sigil or a genius's seal. The
research of 23 November (outside the repository; its facts are under
[Sources](#sources)) found three sourced forms besides it:

- the Golden Dawn's own form, a sigil drawn alone with its name beneath;
- the talisman Lenain describes for each genius, its verse round a ring;
- a pentacle's band with angels' names written in it, as in Mathers's
  *Key of Solomon*.

The one form readers meet most online, the name's letters spaced evenly
round a band, is Vaughan's of 2020 (option 5 in the mock-up), with no
earlier source. Offering the sourced forms, each captioned with its
source and with what is ours, gives readers the alternative they look
for without passing off a 2020 convention as tradition. It is also what
"show the evidence" asks of a figure: say whose each part is.

## Sources

"n" is the archive.org BookReader leaf. Lenain's pages are the reissue's
printed pages, as the research read them in the local PDF and as
`lenain/pages.json5` holds them. The 1823 printing's pages for the same
passages are not yet found (Google Books served a CAPTCHA), and Y0 finds
them. Readings of the plates are by eye, on the scans, by Claude (the
research agent, this plan's author and the reviewer), 23 November 2026.
Mathers's notes were read in an OCR of the scan the reviewer made. All
of these are one pass, made knowing what to expect, and Y0 records them
as such.

| Style | Witness | Where | Copyright | What we take |
| --- | --- | --- | --- | --- |
| 1. Bare | Regardie, *The Golden Dawn* vol. 4 (Chicago 1940), `IsraelRegardie-TheGoldenDawn-Vol4-1940` (works: `regardie1940`) | p. 58, n52 | Not renewed, so public domain in the US. In copyright elsewhere to the end of 2055. Treated as in copyright: facts and links only, nothing traced or mirrored (plan 091) | A line sigil with no rose, no ring and no box, the name in small roman capitals beneath |
| 2. Rose | The same volume | rules p. 57 (n51); tracing over the rose p. 58 (n52) | As above | The rose behind the sigil: today's figure |
| 3. Talisman | Lenain, *La Science cabalistique* (Amiens 1823; works: `lenain1823`, `lenainReissue`) | Text: pp. 45 and 70 (reissue). Title-page talisman: the reissue's front matter (PDF p. 9); Ms 5365 copies it at leaf n2 (`lenainMs5365`) | Public domain (Lenain d. 1877; Papus d. 1916) | Each genius's talisman has its verse written round it. The lettering's form: Latin capitals running clockwise from a cross at the top, tops outward |
| 3. Talisman | Mathers, *The Key of Solomon the King* (London 1889), Wellcome copy `b24884431`, Public Domain Mark (works: `mathers1889`, new) | Pl. IV Fig. 20 (n79), note p. 61 (n80); Fig. 21 (n79), note p. 62 (leaf to record) | Public domain everywhere (Mathers d. 1918) | Fig. 20: seals inside a ring that carries a psalm verse. Fig. 21: an angel's name (Bariel, with Adoniel) inside the field, with a verse round it |
| 4. Band | Mathers 1889, as above | Pl. IV Fig. 18 (n79), note p. 61 (n80) | As above | Angels' names written round a pentacle in Hebrew, each as a word in the band, tops outward. Mathers's note names them: Netoniel, Devachiah, Tzedeqiah and Parasiel |

**Style 4's witness changed in review.** The first draft cited Pl. I
Fig. 3 (n7). That figure is the circle Mathers gives for consecrating
pentacles, and his text (p. 40) says its band holds names of God that
the operator thinks fit. It is no witness for an angel's name in a band.
Fig. 18 is: four angels' names, each written as a word round the
pentacle. Gadi's style 4 stands as chosen; only its source changes, and
it is now a pentacle of Jupiter's rather than a circle.

### What each style adds that is ours

The captions say these, so a reader can tell the source from the site.

1. **Bare.** Regardie's figures on p. 58 are of Metatron and Elohim,
   and those on pp. 59–60 are set in a ruled table, the names inside the
   cells. None is of the 72. Ours:
   - giving the 72 this form;
   - the face (Noto Serif) and the sizes;
   - centring the sigil and scaling it;
   - the roman spelling, which is the site's (Lenain's, `name.en`).
2. **Rose.** Nothing new: it is plan 088's figure. Its caption says
   that the rose shows which letters the line passes through.
3. **Talisman.** Lenain describes the genii's talismans but draws none.
   His book has no plates of the genii: the research checked all 174
   pages of the reissue and the 160 leaves of Ms 5365. Ours:
   - **The language.** He says the verses are written round the
     talismans in Hebrew (p. 45; the footnote on p. 70). We letter his
     Latin, as his entries give it, because the data has no Hebrew text
     of the verses.
   - **The figure inside.** It is the Golden Dawn's rose sigil, a
     method Lenain never uses. No source puts the two together.
   - **The name inside.** Lenain does not say what is inside a genius's
     talisman. The name under the sigil follows Mathers's Fig. 21,
     which has an angel's name inside its verse ring. (The first draft
     read it from Lenain's p. 153, which is about the Maccabees'
     talisman, not the genii's.)
   - **Size and spacing.** The ring's lettering is fitted to each
     verse's length.
   - **#70's verse** is the Vulgate's Latin of Genesis 1:1, which
     Lenain names but gives only in French (decision 8).
4. **Band.** Ours:
   - **One name, at the top.** Fig. 18 has four, one at each quarter.
   - **The roman name at the bottom, read upright.** On Mathers's
     plates every letter in a band stands tops outward, so a bottom word
     is upside down.
   - **The sigil inside.** Fig. 18's field holds Jupiter's mystical
     characters.
   - The mock-up's two small crosses at the sides are dropped: nothing
     sources them.

### Readings of the plates (by eye; Y0 confirms)

- **Mathers Pl. IV Fig. 18:**
  - נתוניאל at the top of the band and three more words at the other
    quarters, all tops outward, so that the bottom word is upside
    down.
  - Mathers's note (p. 61, n80) calls them the names of the angels
    Netoniel, Devachiah, Tzedeqiah and Parasiel, written in Hebrew.
- **Mathers Pl. IV Figs. 20 and 21:**
  - A hexagram at the top of each band.
  - In Fig. 20 the Hebrew verse starts beside the hexagram and runs
    anticlockwise all the way round.
  - Fig. 21's note (p. 62) puts the name Iah above the sigil, and the
    names of the angels Adoniel and Bariel below it, Bariel's letters
    round a square of four compartments. The verse (Ps. 112:3 in
    Mathers's numbering) runs round it.
- **Mathers Pl. I Fig. 3** is not a witness (see above). For the
  record: אניאל at the top of the band (the spelling of genius 37,
  Aniel, though nothing suggests the genius is meant), other words at
  the other quarters, stars at the diagonals, and the quarters' names
  inside.
- **Lenain's title-page talisman:**
  - The band reads, clockwise from a cross at the top, DEUS ABRAHAM,
    DEUS JACOB, DEUS ISAAC in roman capitals, with stars between the
    names. The letters are tops outward all round, so JACOB at the
    bottom is upside down.
  - Inside is a triangle holding the Tetragrammaton as a tetractys.
  - Read on the reissue's PDF p. 9. The citable links are Ms 5365's
    leaf n2 on archive.org (`BIUSante_ms05365`), and the reissue's and
    the 1823 printing's title leaves on Google Books, which Y0 finds.
- **Regardie p. 58 (n52):** each sigil stands alone, with no box, the
  name beneath it in small capitals. Pp. 59–60 (n53–n54) are a ruled
  table with the names inside the cells.

### Lenain's "sphère cabalistique"

Lenain refers several times to a "sphère cabalistique" (reissue
printed pages; `lenain/pages.json5`):

- p. 7: he has set the genii out in order in it;
- p. 45: "voyez la sphère cabalistique", after saying that the 72
  verses are written round the talismans in Hebrew;
- p. 70's footnote: the verses written round the 72 genii's talismans
  "se trouvent dans la sphère cabalistique";
- p. 142's footnote: the Maccabees' talisman "occupe le centre de la
  sphère cabalistique".

So the sphere seems to have been a figure: the 72 talismans with their
verses round a centre. It would be the one witness for exactly the
talisman style. Neither copy checked has it: the reissue has no such
plate, and Ms 5365 none. Plan 033 ties Lenain's tables to Kircher's
wheel of the names (*Oedipus Aegyptiacus* II.1, p. 287), which may be
its model (inference).

What would settle whether it existed:

- a bibliographic description of the 1823 printing (a library
  catalogue's collation naming a plate, "1 pl. dépl.");
- another copy of the 1823 printing, with its plates;
- a reference in the reissue's or Papus's matter.

Y0 searches for these. If the sphere is found, the talisman follows it
and this plan is amended.

### The verses

- **What the data holds.** `psalm.la` in `seventyTwoAngels.json5` is
  Lenain's Latin from his entries. The psalm numbers are the Vulgate's,
  as Lenain gives them (Ps. 3:3 for Vehuiah), and the page and the alt
  texts use them. The edition's apparatus already holds his slips:
  - `lenain/apparatus.json5` has two notes on `psalm.la`: #12, the
    reissue's misprint, and #45, Lenain's "adjuvebat";
  - `lenain/witnesses.json5` reads both against the 1823 printing and
    Ms 5365;
  - `lenainQuotations.test.ts` holds every verse against the bracketed
    Latin in his text.
  - Nothing holds the verses against a psalter, so a slip common to
    the data and the transcription passes.
- **Lengths.** 46 characters (#19) to 103 (#47).
- **Characters.** The Latin alphabet with à â æ è ë ï œ, the
  punctuation `: , ; . ! ? '`, and Lenain's spaced colons.
  - Œ and œ are not in Latin‑1 (#43 "prœveniet", #54 "cœlo").
  - The roman names add é ë ï and the hyphen (Sitaël, Séheiah, Eïael,
    Nith-Haiah, Iah-hel).
- **For Y0:**
  - #2, Jeliel: the data and the transcription read "a me'ad
    defensionem", where the Vulgate has "a me ad defensionem". The
    apostrophe is unchecked against the scan.
  - #43: "prœveniet", where the Vulgate has "praeveniet".
  - In a table row these pass unnoticed; lettered round a talisman they
    do not.
- **#70 has a verse.** The first draft took the data's psalm 0 to mean
  none. Jabamiah's entry has no psalm. It prescribes "le 1er verset de
  la Genèse", which it gives only in French ("Au commencement Dieu créa
  le ciel et la terre"; `seventyTwoAngelsText/fr.json5`, and the
  extraction's note in `lenain/evidence.json5`). The Vulgate's Latin,
  "In principio creavit Deus caelum et terram", is 42 characters.
- **#11 and #17.** The two Lauviahs share a name, so their bare, rose
  and band figures are the same. Their talismans differ (Ps. 17:50 and
  8:1): this is the first style that tells them apart.

### Not used

- **Vaughan's *Rosicrucian Sigils* and *Lévi Seals of the 72 Geniuses*
  (2020).** Both are in copyright. The spaced-letter band is his, with
  no earlier source (Gadi, 23 November: not offered).
  - The talisman looks like his Lévi seals: verse in the band, name
    inside. That arrangement is Lenain's (his text and his title page)
    and Mathers's (Figs. 20 and 21), and we draw it from them. Nobody
    consults Vaughan's PDFs while drawing or reviewing it.
- **Lévi's own seals** (the 1895 *Clefs majeures*) were not reached,
  and nothing here depends on them.
- **Lenain p. 97** puts the title-page talisman on one face and the
  genius's on the other, but that is in #72's entry only. The first
  draft generalised it; the talisman here has one face.

## Design

### One name: style

The reader's word, `style`, is used throughout: the page's `?style=`,
the contract's key, the type `SigilStyle` and the constant
`SIGIL_STYLES = ["band", "bare", "rose", "talisman"]`. Only the
package's prop must differ, `sigilStyle`, because React's SVG props own
`style`. The contract is `angel-sigil`: it draws the 72 angels' sigils,
and nothing else in v1.

### Invariant: the rose does not change

None of the following may change, and each has its guard (the
[Verification](#verification) section lists the commands):

1. **The `rose-sigil` contract and its registration.** Its keys, parse,
   canonical query, profile (`magickli-rose-sigil-image-v1`), fonts and
   inputs (none) stay as they are, and so do its tests.
2. **The engine.** `planSigil`, `placeSigil`, `ink.ts`, `SigilImage` and
   `RoseSigilImage` are not edited. The new styles are drawn by new
   code that calls `sigilFigure`, `sigilSubpaths` and `wordInk` and
   composes over their output.
   - Guard: `scripts/sigil-oracle/roseDigest.mts` prints the same
     digests before and after, for both roses. It renders
     `SigilImage`'s markup, not `RoseSigilImage` and not the outlined
     bytes, so it is only part of the guard.
3. **The registry's pins.** `ROSE_SIGIL_PINS` (four outlined byte pins)
   and `ROSE_SIGIL_DRAWING_DIGESTS` stay as they are; no shipped profile
   is re-pinned.
4. **The 72 angels' rose images.** Y3's first commit, made on `main`'s
   bytes before anything else changes, adds a test pinning one SHA-256
   over the 72 outlined rose SVGs as the angels' files draw them
   (`rose-sigil?text=<name>`). This adds coverage under the shipped
   profile and re-pins nothing. A hash list of all 144 static rose
   files, taken from `main`'s build, is compared after Y3 and Y4.
5. **`RoseSigil` and `/gd/sigils`** are not touched in this plan
   (decision 14).

### Package (`magick-components`)

**A new module, `gd/roseSigilStyles.tsx`** (name open), additive,
released as 0.7.0:

- `SIGIL_STYLES` and `SigilStyle`, and `SIGIL_STYLE_NOTES`, shaped like
  `ROSE_VERSION_NOTES` (an id, a title, a text, sources with URLs), for
  the package's own users. The app writes its captions as its own
  Lingui messages through `<Cite>`, and a test holds the package notes'
  leaves to the app's citations, as `sigilSources.test.tsx` does for
  the rulers' sigils.
- `StyledRoseSigilImage`, with no hooks, so the server can render it.
  - **Props:** `text`, `sigilStyle` (`band`, `bare` or `talisman`; the
    rose stays `RoseSigilImage`'s, so it has one code path), `roman?`,
    `legend?` (required for `talisman`), `hebrewFamily`, `latinFamily`
    and `fontWeight` (written into the markup, so the face resvg picks
    is the one Y1 chose), and the SVG's accessible name.
  - **The viewBox is the rose's**, 100 units square for a word
    (`sigilViewBox`), so every style has the contract's raster default
    (1,024 pixels) and swapping one for another never moves the page.
  - **The ink.** The word's paths come from `sigilSubpaths`. Its bounds
    come from `wordInk(...).commands`, read exactly: M, L, A (arcs
    bounded by their extremes) and C, the crooks' cubics
    (`sigil/ink.ts:66`, `:158`), bounded at the curve's own extremes.
    - The ink is centred on its bounds and scaled to fit the style's
      field (decision 11). Its stroke width is divided by the scale, so
      every figure's line looks equally heavy.
    - A test holds the bounds to a dense sampling of every path for the
      72 names and the oracle's corpus: no sample outside the bounds,
      and the bounds within 0.5 unit of the samples.
  - **Lettering, glyph by glyph,** as the Pantacle in the halls sets its
    ring (`gd/hall/art/pantacle.tsx`). Each glyph is its own `<text>`,
    placed and rotated from the font's measured advances (`TextMeasure`
    and `fontMetrics.json`, imported from `gd/hall/labels.ts`, not
    moved).
    - Placing each glyph means no renderer's `textPath` or bidi decides
      the order. The Pantacle's comment says resvg reverses Hebrew on a
      path; the reviewer's test did not reproduce that, so the plan does
      not rely on it either way. Y1 checks the order in both renderers.
    - Latin runs clockwise and Hebrew anticlockwise, tops outward, as
      on Mathers's plates and Lenain's title page. The band's roman
      name at the bottom is the one exception: it reads upright
      (decision 10).
  - **What the talisman's ring letters** (decision 7), given the
    verse as the data holds it:
    - upper case, by a fixed table, keeping the accents and ligatures:
      QUÀM, LONGÈ, ÆTERNUM, CŒLO, SITAËL;
    - Lenain's punctuation as he prints it, his spaced colons
      included, except a final full stop, which the cross at the top
      takes the place of;
    - one space between words;
    - nothing added and nothing dropped otherwise.
    The largest size up to a cap at which the text, the cross and its
    gap fill the circle is used. Any space left over is shared out
    between the letters, as on Lenain's title page.
- **Fonts and coverage.** The package draws with family names, and the
  app supplies the files. A test in the app holds every character the
  images letter (the 72 Hebrew names, the roman names, the legends) to
  both the metrics table and the font subset's character map. A missing
  glyph would otherwise fall back silently to another face.

### Contract: `angel-sigil`

A new contract and registration, for the angels only (decision 1):

| | |
| --- | --- |
| Keys | `angel` (one of the 72 slugs, as the pages have them: `vehuiah`, `lauviah-11`…) and `style` (`band`, the default, `bare`, `rose` or `talisman`); width and height |
| In the contract | The 72 slugs, and the angels that need a note on their verse (#70), written out. Contracts ship in client bundles, and `seventyTwoAngel` is kept out of the data barrel, so the contract does not import it. A test holds the written lists to the data, as `ROSE_IMAGE_VERSIONS` is held to the package |
| In the registration (server only) | The Hebrew (`angelSigilText`), the roman (`name.en`) and the legend: `psalm.la`, or for #70 the Vulgate's Genesis 1:1 from Y0's verse file. No free text reaches an image |
| `style=rose` | `/api/render/angel-sigil` answers with a 308 to the angel's existing rose file, as `gd-hall` redirects to its static files. The rose bytes keep one identity, under `rose-sigil` |
| Other requests | Every image the contract draws is also a file under the angel's page (decision 3: the band built at deploy, the bare and talisman drawn there on first request), so `/api/render/angel-sigil` redirects every request to its file with a 308, as `gd-hall` does. The registration draws for the build, the file route and the tests |
| viewBox, raster | As `rose-sigil` (`sigilViewBox(1)`, 1,024 pixels square) |
| Index | `personal: false` (a closed set drawn from public data) and `indexed: false`: the static files are the copies search sees |
| Filename | `<slug>-rose-cross-sigil-<style>` |
| Profile | `magickli-angel-sigil-image-v1` |
| Inputs | `{ table: "seventyTwoAngel", rows: "*", fields: ["name.he", "name.en", "psalm"] }`, plus Y0's verse file for #70. Both join `DATA_INPUT_TABLES`, as `enochianTablet` did, so the mutation and sweep tests cover them |
| Fonts | The new upright Noto Serif subset and the Frank Ruhl Libre file Y1 picks (decision 13) |
| Pins | Outlined bytes for: Vehuiah band; Asaliah talisman (the longest verse); #54 talisman (Œ) and #55 talisman (Æ); Nith-Haiah bare (the longest roman name); Jabamiah talisman (Genesis). A drawing digest over the package component with every name, roman and legend written out (as `ROSE_SIGIL_DIGEST_NAMES` is), so a data fix moves the inputs hash, not the drawing digest |

### Files

Every style is a file under the angel's page, served by the existing
`[file]` route (decision 3): the band's built at deploy, the bare and
talisman files drawn on their first request and cached:

| Style | Files | Count |
| --- | --- | --- |
| Band (default) | `<slug>-rose-cross-sigil-band.png` and `.svg` | 144 new |
| Rose | The existing `<slug>-rose-cross-sigil.png` and `.svg`, untouched, still drawn by `rose-sigil` | 144 existing |
| Bare | `<slug>-rose-cross-sigil-bare.png` and `.svg` | 144 new |
| Talisman | `<slug>-rose-cross-sigil-talisman.png` and `.svg` | 144 new (142 if #70 has none, decision 8) |

- **Size.** The reviewer measured the rose's files at about 68–76 KB a
  PNG and 12.7 KB an SVG. All 576 files come to about 20 MB. The new
  styles' sizes are Y1's to measure; the talisman's outlined lettering
  will make its SVG larger.
- **`AngelSigilFile`** gains a `style`, and the route draws each file
  through the contract its style needs.
- **What is drawn at request time:** the bare and talisman files, once
  per URL until the cache drops them. The route needs `dynamicParams` for
  those two styles and a long `s-maxage`; whether Next keeps them as
  regenerated files, and whether the cache survives a deploy, is Y1's to
  find out.

### The angel page

The "Rose Cross sigil" section, in order:

1. The heading.
2. The style dropdown: a native `<select>`, as `HallJump.tsx` has it,
   with a visible label.
3. The figure: an `<img>` of the style's PNG with a `<figcaption>`.
4. The sentence linking the generator. It still opens the rose, because
   "watch it drawn" means the tracing. It is unchanged.
5. Download PNG and Download SVG for the shown style.
6. A plain line of links to every style's PNG and SVG ("Every style:
   Band, PNG · SVG; Rose…"). It is in the HTML, so a reader without
   JavaScript, for whom the dropdown does nothing, still reaches every
   figure, and so does image search.

- **Every style is 1,024 pixels square.** Swapping them moves nothing,
  except where the talisman is set wider (decision 9).
- **Structured data, sitemap and share image** (decision 4):
  - The JSON-LD graph gives the band's PNG and SVG first, then each
    other style's PNG and SVG. Each style's `ImageObject` has its own
    caption and `isBasedOn`:
    - band: Mathers 1889, Pl. IV Fig. 18, and Regardie p. 57;
    - rose: Regardie p. 57, as now;
    - bare: Regardie pp. 57–58;
    - talisman: Lenain p. 45, Mathers Pl. IV Figs. 20 and 21, and
      Regardie p. 57.
  - The sitemap lists the band's PNG first, then the rest.
  - The page's second Open Graph image becomes the band's PNG. The
    page card is unchanged.

### URL state

- **The URL.** `?style=bare|rose|talisman`; the default, `band`, is
  never written.
- **How it is read.** As the tablets page reads its choices
  (`src/app/enochian/tablets/urlState.ts`): `useSyncExternalStore` over
  `window.location`, with an empty server snapshot.
  - The prerendered HTML always carries the band, and a shared link
    shows its style once hydrated.
  - `useSearchParams` would client-render up to its Suspense boundary
    and render the figure twice, so it is not used.
- **A pick** writes `?style=` with `history.replaceState`: no
  navigation, no scroll and no history entry; the hash is kept.
- **Nothing is stored** (decision 5). A link without `?style=` always
  shows the band.
- **An unknown value** falls back to the band.
- **The canonical URL** stays the bare path. Query variants are not
  separate pages.

### The 72 list

`ListSigil` shows the band's static PNG instead of the rose's. It has no
dropdown (decision 12): it stays at 14rem, where a talisman's verse
cannot be read, and no engine runs in the browser. Its caption names the
style and points to the angel's page for the other three.

### Captions (drafts, for Gadi)

Each caption is one Lingui rich-text message; each scan is cited with
`<Cite work leaf|page>`.

- **Band.** "The sigil inside a ring with the name in Hebrew at the
  top, as the angels' names are written round a pentacle in Mathers's
  *Key of Solomon* (1889), Plate IV, Fig. 18. Ours: one name instead of
  four, the name in roman letters at the bottom, and the sigil inside."
- **Rose.** "Traced through the letters of the Golden Dawn's rose by
  the Order's rules (Regardie, *The Golden Dawn*, vol. 4, pp. 57–58).
  The rose shows which letters the line passes through."
- **Bare.** "Drawn alone, with the name beneath, as the Golden Dawn's
  own sigils of Metatron and Elohim are printed (Regardie, vol. 4,
  p. 58). Giving the 72 this form is ours."
- **Talisman.** "A talisman as Lenain describes the genii's, the
  genius's verse written round it (*La Science cabalistique*, p. 45),
  lettered like the talisman on his title page. The name inside follows
  Mathers's *Key of Solomon* (1889), Plate IV, Fig. 21. Ours: Lenain
  says the verses are in Hebrew, and we letter his Latin; he draws no
  genius's talisman; and the sigil inside is the Golden Dawn's."
- **Talisman, #70 only**, an added sentence: "Lenain gives Jabamiah no
  psalm but the first verse of Genesis, in French; the Latin here is
  the Vulgate's."

### Lingui

New messages, all marked and translated into Hebrew in
`src/locales/he/messages.po`, each with a translator's comment saying
where it appears:

- the dropdown's label ("Sigil style") and the four style names, which
  are descriptive ("In a ring with its name", "On the rose", "Alone,
  with its name", "Talisman with its verse"), not the code's words;
- the four captions and #70's sentence;
- the alt texts of the three new styles, each with the numbered
  variant for a shared name, as `ANGEL_SIGIL_ALT_NUMBERED` does;
- the "Every style" line;
- the list's caption.

The rose's alt text is unchanged. The lettering inside the images
(Hebrew names, roman names, the Latin verses) is source data, never
translated.

Draft alt texts:

- **Band:** "The Rose Cross sigil of {name}, {hebrew}, inside a ring
  with the name in Hebrew".
- **Bare:** "The Rose Cross sigil of {name}, {hebrew}, drawn alone with
  the name beneath".
- **Talisman:** "A talisman of {name}, {hebrew}: the Rose Cross sigil
  inside a ring lettered with {verse} in Latin", where {verse} is
  "Psalm 3:3" (the Vulgate's numbering) or "Genesis 1:1".

### Search

- **The angel pages** enter the catalogue by their data and Lenain's
  text, not by the sigil section (`src/search/catalogue.ts`), so the
  section's changes move nothing.
- **A verse fix in Y0 moves the catalogue.** `catalogue.ts:558`
  indexes `words(angel)`, which includes `psalm.la`.
- **The list's changed caption** is indexed prose too.
- Each commit that moves the digest publishes under the AGENTS.md
  pre-authorisation (estimate under $2, the day's total under $12),
  recorded in the shared ledger: up to two publishes in this plan, Y0's
  and Y4's.

### Accessibility

- **The dropdown** is a native `<select>`, so the phone's own picker
  and the keyboard work without help, and its label is visible.
  - Choosing a style leaves focus on it and changes the image's alt
    text and the caption.
  - No live region: the figure is not an alert, and its caption is
    next to it.
- **The "Every style" line** gives keyboard and no-JS readers every
  figure as a plain link.

### Dark theme

The angel page and the list show PNGs, and a PNG cannot be re-inked.
Every style is shown on the light plate (`plateClass`) in the dark
scheme, black and red on light, as the rose is now. The mock-up's dark
renders re-inked styles 1, 3 and 4; that needs inline SVG, and waits
for the generator's follow-up.

### Layout

The section stays in the reading column.

- The band, rose and bare figures keep today's 18rem, which is the
  column's width on a 320 px phone.
- **The talisman** is set wider, so its verse can be read. The reviewer
  measured the longest verse's capitals at about 8 CSS px on a 343 px
  figure and 7 px on a 288 px one. Y1 sets a legibility floor with Gadi
  (decision 9). A unit test then computes every legend's capital
  height at the narrowest width the page can show it, and fails below
  the floor.
- Checked at 375, 768 and 1,440 px, light and dark.

## Decisions

The recommendation comes first in each; the alternatives are kept for
the record. Gadi's four decisions of 23 November are not repeated.

1. **A new contract, `angel-sigil`,** draws the band, bare and talisman
   styles for the 72, and redirects `style=rose` to the rose's file. It
   leaves the rose's registration and its tests untouched, as `kamea`
   and `kamea-sigil` are separate contracts. Its data and fonts stay
   with the images that need them.
   *Alternatives:*
   - `rose-sigil` gains `style` and `angel`, as proposed in
     conversation. That works: rose images are never in saved rituals'
     offline catalogues (`generatedRitualImageCatalog.ts` takes only
     the Tree), and the reviewer found that appending fonts after the
     base set leaves the rose's outlines alone. But the rose's contract,
     registration and tests would all change, and a talisman's verse
     would become an input of every rose image.
   - Free-text `label` and `legend` parameters, so that any words
     could be drawn under the site's name. Rejected.
2. **The name `style`** everywhere, `sigilStyle` only for the package's
   prop.
   *Alternative:* `frame`, as the first proposal had it. The engine
   already uses that word for the disc round a layout.
3. **The hybrid** (Gadi, 23 November): the band's files are built at
   deploy, the rose's existing files stay as they are, and the bare and
   talisman files live at the same kind of stable, indexable URL under
   the angel's page but are drawn on their first request and then
   cached, at Vercel's CDN through a long `s-maxage` or by Next's
   regeneration if route handlers support it here. They carry no
   `noindex`. Placements are not stored: the engine is deterministic and
   pinned, and storing them would be a second copy of the truth to save
   at most about 160 ms once per file. Y1 measures whether a
   first-request file stays cached (and across a deploy) and its cold
   cost; if it does not, every style is built at deploy instead (576
   files, about 20 MB).
   *Alternatives:* every style static (the review's recommendation);
   `/api/render/angel-sigil` drawing everything, whose images carry
   `noindex` and so never reach image search.
4. **The band is the share image, and comes first in the JSON-LD and
   the sitemap,** with every other style's files after it. The page
   card is unchanged.
   *Alternatives:*
   - The band as the page card's art too, as the kamea name pages draw
     their sigil.
   - The band only in the sitemap and JSON-LD.
5. **`?style=` read through `useSyncExternalStore`, and nothing
   stored.** A link without `?style=` always shows the band.
   *Alternatives:*
   - The last pick in `localStorage`.
   - A `#style=` hash.
6. **Captions** per style, as drafted, each citing its leaf through
   `<Cite>` and with an "Ours:" sentence. Mathers 1889 joins
   `src/sources/works.ts` as `mathers1889`.
7. **The talisman's legend:**
   - Lenain's Latin as the data holds it, after Y0's audit.
   - Upper case with the accents and ligatures kept, Lenain's
     punctuation, one ring, clockwise from a cross at the top, tops
     outward, fitted to its length.
   *Alternatives:*
   - The Hebrew verse Lenain describes, from a public-domain Hebrew
     text, with the Vulgate's psalm numbers mapped to the Hebrew's.
     This is closer to his words but needs a new data field and the
     Hebrew ring settled for long text. A later plan.
   - Italic lower case.
   - Two rings for long verses.
8. **#70 Jabamiah gets a talisman lettered with Genesis 1:1 in the
   Vulgate's Latin** (42 characters), from Y0's verse file, captioned
   as ours: Lenain names the verse but prints it only in French.
   *Alternatives:*
   - No talisman for #70: the dropdown leaves it out, and a sentence
     says why.
   - Lenain's French.
9. **The talisman is set wider than the others,** to whatever width
   meets the legibility floor Y1 sets with Gadi, and opens at full size
   on a tap. The others keep 18rem.
   *Alternatives:*
   - A second ring for verses over a length Y1 finds.
   - A lower floor, with every style the same size.
10. **The band's bottom:** the roman name, read upright, labelled ours.
    No crosses.
    *Alternatives:*
    - The roman name tops outward, as Mathers's bottom words are.
    - Nothing at the bottom.
11. **The ink is centred on its bounds and scaled to its style's
    field,** as in the mock-up, with the stroke kept the same on screen.
    *Alternative:* one scale for all 72, the rose's frame (radius 40)
    mapped onto the field. That needs no bounds, keeps every mark the
    same size, and leaves each sigil where it lies on the rose, so many
    sit off centre.
12. **The 72 list always shows the band,** with no dropdown (Gadi, 23
    November, from a mock-up of three variants on the real page: no
    picker; one in each entry; one for the whole list). Its caption
    points to the angel's page for the other styles. At the list's
    14rem the talisman's verse capitals are about 7.5 px, 5 px for #47,
    so a picker would offer a style the list cannot show.
    *Alternatives:* a picker in each entry (about 58 px more per open
    entry on a phone, 72 copies); one picker for the list (out of sight
    once scrolled; best if it ever follows a remembered choice).
13. **Fonts.**
    - A new upright Noto Serif subset (Latin‑1, Œ and œ), built by
      `scripts/gd-hall-fonts/build.py` as TrueType for resvg, with
      metrics in `fontMetrics.json` and a row in `assets/fonts/README.md`.
    - Frank Ruhl Libre: the halls' Bold letter subset if it reads well
      at size, or a weight-500 instance built the same way. Y1 decides
      from side-by-side renders, and the weight is written into the
      markup.
    *Alternative:* the halls' existing Noto Serif Italic subset for the
    Latin, which needs no new file but departs from Lenain's upright
    capitals.
14. **The generator (`/gd/sigils`) is a follow-up,** entered in
    `plans/000`'s follow-ups: a dropdown for bare, rose and band on any
    text, a `text=` form of the contract, inline SVG with `Ink`
    re-inking in dark, and `RoseSigil`'s `sigilStyle`.
    *Alternative:* build it in this plan, as the first draft had it.
15. **Mirror Mathers's Plate IV (n79),** which serves both the band
    (Fig. 18) and the talisman (Figs. 20 and 21), with the regions
    outlined. The research's copy is 182,890 bytes; the mirror cap
    leaves 426,008 (`mirroredPages.test.ts` on `main`). Regardie is
    never mirrored.
    *Alternative:* link only.

## Unproven claims: what Y1 tests

Y1 is a spike: scratch code outside the repository, no commits, its
numbers and renders recorded in this plan. Each claim below has the
measurement that settles it.

1. **The verse can be placed round the ring and read.**
   - Lay out all 72 legends glyph by glyph with the chosen font's
     metrics, at 224, 288, 343 and 512 CSS pixels.
   - Record each legend's size and spacing, and the capital height in
     CSS pixels of the longest (#47, 103 characters) and the shortest
     (#19, 46). The reviewer's first figures are about 8 px at 343 and
     7 px at 288.
   - Render the same markup with resvg (through `outlineComponentImage`)
     and in Chromium, and compare the glyph positions: they should agree
     to 0.1 unit.
   - Gadi sets the legibility floor from a side-by-side sheet at real
     sizes (AGENTS.md, layout rule 5). That gives decision 9's widths,
     or a second ring.
2. **The Hebrew band's direction.**
   - Set the 72 names glyph by glyph, right to left across the top
     (anticlockwise), tops outward.
   - Check that resvg and Chromium draw the letters in the same order,
     and that the band reads as Mathers's Fig. 18 does.
3. **Bounds and fit.** The bounds from `wordInk`'s commands on the 72
   names and the corpus, against sampled outlines. Check how each name
   scales in each field, and whether any start circle or end bar comes
   near the ring.
4. **Fonts.** The Frank Ruhl Libre Bold subset against a 500 instance,
   and the new Noto Serif subset's size, metrics and coverage of every
   character in the legends and names.
5. **The build and the first request.** Time and size of the band's
   144 built files. For the bare and talisman files drawn on first
   request: the cold cost per style on Vercel, whether the response is
   kept (Next's regeneration for route handlers, or the CDN's
   `s-maxage`), whether it survives a deploy, and that it carries no
   `noindex`. If they are not kept or are slow, decision 3 falls back to
   building all 576 (about 20 MB).

## Stages

Built on a gate branch, `gate/sigil-styles`, from `main` after
`gate/sigil-followups` merges. Y0 and Y1 run side by side.

| Stage | What | Gate |
| --- | --- | --- |
| Y0 | **Sources and the verse guard.** (a) Lenain 1823: the pages for the reissue's pp. 45 and 70, the title page, and #70's entry. (b) The sphère cabalistique: catalogue collations and other copies of 1823. (c) Mathers Pl. IV Figs. 18, 20 and 21 and their notes (pp. 61–62), with their leaves. (d) Regardie p. 58. (e) **The verses**, below. (f) `mathers1889` in `works.ts`, and Plate IV mirrored. (g) If a verse changed, `pnpm search:publish` | Gadi reviews the discrepancy table. The verse test is green and committed |
| Y1 | **Spike** (above) | The numbers recorded here; Gadi chooses from side-by-side renders at real sizes (decisions 9, 10, 13) |
| Y2 | **Package:** `roseSigilStyles`, the bounds, the lettering, the notes. **Fonts:** the subset, metrics, README. magick-components 0.7.0, and magick-data's next minor if Y0 changed a verse | `roseDigest.mts` unchanged; the halls' pins unchanged; package tests (layout, glyph order, fit, bounds) |
| Y3 | **Contract and route.** First, on `main`'s bytes, the pin over the 72 outlined rose SVGs. Then `angel-sigil`, its registration, its inputs (`seventyTwoAngel` and the verse file in `DATA_INPUT_TABLES`), the coverage test, the pins and the drawing digest, and the redirects | Contract, registry, dataInputs and route tests; `ROSE_SIGIL_PINS`, the rose's drawing digest and the new 72-SVG pin unchanged; the 144 rose files' hash list unchanged |
| Y4 | **Angel pages and the list:** the 432 new files, the dropdown, URL state, captions with `<Cite>`, alt texts, downloads, the "Every style" line, JSON-LD, sitemap, share image, `ListSigil`; Lingui and Hebrew; search publish for the list's caption | The full gate (below); the hydration test; the browser checks; the 144 rose files again |

Y0's verse guard, committed in magick-data beside the apparatus:

- **The verse file.** A public-domain Vulgate's text of the 72 verses
  (71 psalm verses and Genesis 1:1), each with its edition, its
  numbering, and a link to its page in a scan. Its source file's
  SHA-256 is recorded where the exact bytes come from a downloaded
  text, as AGENTS.md's outside-sources rule asks.
- **A test** that holds every `psalm.la` to the Vulgate's verse, after
  a stated normalisation (case, punctuation, j for i, the ligatures).
  Every difference is a listed exception, with what each printing
  reads, its page or leaf, and whose it is (Lenain's, his printer's,
  the reissue's, the transcription's). A new difference fails the
  build.
- **Fixes.** A transcription slip is fixed where the edition fixes its
  text, so the French and the field agree. A slip of Lenain's stays in
  the French and gets an apparatus note, and the field carries the
  corrected verse, as #45's does.

Each stage is reviewed fresh before it merges (Opus, high), and the
whole by Fable 5.2 (high) on the exact tree, as the project's commit
rules ask. Commits carry consistent manifests, and the footer names
both models.

## Verification

- **The rose.**
  - `node --import tsx scripts/sigil-oracle/roseDigest.mts` (about two
    minutes) prints identical output on `main` and on the branch, for
    `gd`, `regardie1939` and both together.
  - The registry tests pass with `ROSE_SIGIL_PINS`,
    `ROSE_SIGIL_DRAWING_DIGESTS` and the new pin over the 72 outlined
    rose SVGs as they are.
  - The SHA-256 of each of the 144 rose files from `main`'s build
    matches the branch's.
- **The package.** Its suite, including the oracle's O1–O3 on the rose,
  which must be unaffected, plus the new layout, glyph-order, fit and
  bounds tests (the crooks' cubics among them). The halls' golden pins
  are unchanged.
- **The verses.** Y0's test, with its listed exceptions.
- **The contract.**
  - Parse, canonical and refusal tests: an unknown slug or style,
    unknown keys.
  - The written slug list and #70's note held to the data.
  - The redirects: `style=rose` to the rose file, and every other
    request to its file under the angel's page.
  - The glyph coverage test against the metrics and the subset.
  - The new pins and the drawing digest.
  - The mutation test: a verse edit moves `angel-sigil`'s inputs hash
    and no other slug's.
- **The app.**
  - The dropdown's options and the "Every style" links for each angel.
  - The URL read and written as the tablets page does it.
  - **The hydration swap:** the server render carries the band and only
    the band; hydrated with `?style=talisman`, the page shows one
    figure, the talisman's, with its alt text, caption and downloads.
  - The legibility floor test.
  - The JSON-LD graph and the sitemap's order.
  - The list's file.
  - `i18n:check`.
- **The gate:** `pnpm check`, `pnpm typecheck`, `pnpm i18n:check`,
  `pnpm test:coverage` and `pnpm build`, run through `pnpm` so that the
  CPU pool queues them (never `--allow-unpooled`), with Node 24, in a
  clean worktree on `/home`.
- **The browser.** Each angel style and the list at 375, 768 and
  1,440 px, light and dark, on a fresh port (stale service worker), and
  without JavaScript for the "Every style" line. Safari is not checked:
  no device. The pages follow the platform rules, and the gap is
  stated.

## Risks

- **A wrong letter in a verse is now a picture.** A slip lettered round
  a talisman is more visible, and more copied, than one in a table. Y0's
  guard comes before any talisman is drawn.
- **Combining traditions reads as history.** The talisman and the band
  put a Golden Dawn sigil into a frame from Lenain or Mathers, which no
  source does. The captions say so, the alt texts claim nothing more,
  and the default's caption names it.
- **It looks like Vaughan's Lévi seals.** It is designed from Lenain
  and Mathers alone (see [Not used](#not-used)), and nobody opens
  Vaughan's PDFs while drawing it.
- **The sphère cabalistique turns up.** If a copy of Lenain's sphere is
  found, it is the witness for the talisman, and the style may have to
  follow it. Y0 looks first.
- **Long verses on phones.** If no width the page can give meets the
  floor, a second ring or a lower floor has to carry it (decision 9).
- **A shift after hydration.** A shared talisman link shows the band
  first, then swaps to the wider talisman. It is a layout shift on load
  for that link only. Keeping the box at the larger size until
  hydration is the fallback if it measures badly.
- **A missing glyph falls back silently.** The coverage test and the Œ
  and Æ pins guard it.
- **Search.** Up to two paid publishes, each under a dollar on the last
  runs' evidence.

## Decisions for Gadi

Decided 23 November 2026: 6 and 8 as Gadi chose them (decisions 12 and
3 above); the others as recommended.

1. **#70:** letter Genesis 1:1 from the Vulgate, captioned as ours
   (decision 8). Or leave #70 without a talisman.
2. **Hebrew verses:** a later plan for the talisman in Hebrew, as
   Lenain describes it (decision 7).
3. **The band's bottom:** the roman name upright, labelled ours, with
   no crosses (decision 10).
4. **The mirror:** Mathers's Plate IV (decision 15).
5. **The share image:** the band as the page's second image only, the
   card unchanged (decision 4).
6. **The list:** always the band (decision 12).
7. **Storage:** none; a bare link always shows the band (decision 5).

Also for Gadi, from the revision:

8. **Files** (decision 3): the hybrid, the band built, the bare and
   talisman drawn on first request and cached.
9. **The generator as a follow-up** (decision 14).
10. **The legibility floor** for the talisman's verse, at Y1 (decision 9).

## Review (23 November 2026)

An adversarial review of the first draft (Fable 5.2, high) found one
blocker and eleven majors. Its scratch scripts and an OCR of Mathers's
scan are in the session's scratchpad, outside the repository. What
changed:

- **B1, style 4's witness.**
  - Pl. I Fig. 3 is the circle for consecrating pentacles, its band
    holding names of God the operator chooses (Mathers p. 40), so it is
    no witness for an angel's name.
  - The witness is now Pl. IV Fig. 18, whose four band words Mathers's
    note (p. 61) names as angels'.
  - Fig. 21 now witnesses the talisman's name inside, which the draft
    had read from Lenain's p. 153 (the Maccabees' talisman).
  - Plate IV is mirrored instead of Plate I.
  - Gadi's style 4 stands; only its source changed.
- **M1, decision 1's reason.**
  - Rose images never enter saved rituals' catalogues, and appending
    fonts did not move the rose's outlines in the reviewer's resvg run.
  - The separate contract stays, for the reason that it leaves the
    rose's registration and tests untouched.
  - The "identity churn" risk is deleted.
- **M2, the bare style.** It follows Regardie p. 58: no box, the name
  in small capitals beneath. Pp. 59–60 are a table.
- **M3, URL state.** It is read as the tablets page reads its state,
  not through `useSearchParams`, and nothing is stored.
- **M4, the contract's data.** The 72 slugs and #70's note are written
  into the contract and held to the data by a test, since contracts
  ship in client bundles and `seventyTwoAngel` stays out of the barrel.
- **M5, bounds.** They now come from `wordInk`'s commands, cubics
  included. The fixed-scale alternative is in decision 11.
- **M6, glyph coverage.** A coverage test against metrics and subset,
  Œ and Æ pins, and the font weight written into the markup.
- **M7, the ring's text.** Case, accents, ligatures and punctuation
  are specified; #43's "prœveniet" goes to Y0.
- **M8, the verse guard.**
  - Y0 commits the Vulgate verses with their source and hash, and a
    test with listed exceptions.
  - A verse fix moves search, so Y0 may publish.
- **M9, Lenain.**
  - The sphère cabalistique is in the evidence, with what would settle
    it.
  - "The other face" is noted as #72's entry only.
  - The name inside is ours, after Mathers's Fig. 21.
  - The title-page talisman's citable links are named.
- **M10, static files.** With the measured sizes (about 20 MB for all
  576), every style is static. The cold-start runs left Y1, and a plain
  "Every style" line of links is in the HTML.
- **M11, scope and legibility.**
  - The generator moved to a follow-up (decision 14).
  - Y1 sets a legibility floor, held by a test.
  - The hydration swap has a test.
- **Minors.**
  - Genesis 1:1 is 42 characters, and decision 8 now recommends
    lettering it.
  - The resvg Hebrew-on-a-path claim is no longer stated as fact.
  - A pin over the 72 outlined rose SVGs was added, since
    `roseDigest.mts` renders `SigilImage`.
  - Dark: every style is on the light plate.
  - One name, `style`, is used throughout, and `style=rose` redirects.
  - The dropdown is a native `<select>` with descriptive labels and
    translator comments.
  - The psalm numbers are said to be the Vulgate's.
  - The branch dependencies are noted.
  - `TextMeasure` is imported, not moved.
  - The band's crosses are dropped.

Decided after the review (23 November 2026): Gadi chose the hybrid for
files over M10's "every style static" (decision 3), with Y1 checking
that first-request files stay cached, and no picker on the 72 list
from a mock-up of three variants (decision 12).
