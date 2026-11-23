# Sigil styles — 23 November 2026

Status: accepted 23 November 2026. Y0 built (ac0f671c, 5c5f57a7) and the
Y1 spike run, both 23 November ([What Y0 found](#what-y0-found),
[What Y1 found](#what-y1-found)). Y2 built the same day
([What Y2 built](#what-y2-built)), and magick-components 0.7.0 after
Gadi signed its row (31ae3e5a). Y3 built the same day
([What Y3 built](#what-y3-built)), and Y4 the same day
([What Y4 built](#what-y4-built)); the full gate is pending. Revised the same day
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
`lenain/pages.json5` holds them. Y0 found the same passages on the same
pages of the 1823 printing (Google Books `qt9SAAAAcAAJ`: `&pg=PA45`,
`&pg=PA70`; the title page `&pg=PP11`). Readings of the plates are by eye, on the scans, by Claude (the
research agent, this plan's author and the reviewer), 23 November 2026.
Mathers's notes were read in an OCR of the scan the reviewer made. All
of these are one pass, made knowing what to expect, and Y0 records them
as such.

| Style | Witness | Where | Copyright | What we take |
| --- | --- | --- | --- | --- |
| 1. Bare | Regardie, *The Golden Dawn* vol. 4 (Chicago 1940), `IsraelRegardie-TheGoldenDawn-Vol4-1940` (works: `regardie1940`) | p. 58, n52 | Not renewed, so public domain in the US. In copyright elsewhere to the end of 2055. Treated as in copyright: facts and links only, nothing traced or mirrored (plan 091) | A line sigil with no rose, no ring and no box, the name in small roman capitals beneath |
| 2. Rose | The same volume | rules p. 57 (n51); tracing over the rose p. 58 (n52) | As above | The rose behind the sigil: today's figure |
| 3. Talisman | Lenain, *La Science cabalistique* (Amiens 1823; works: `lenain1823`, `lenainReissue`) | Text: pp. 45 and 70 (reissue). Title-page talisman: the reissue's front matter (PDF p. 9); Ms 5365 copies it at leaf n2 (`lenainMs5365`) | Public domain (Lenain d. 1877; Papus d. 1916) | Each genius's talisman has its verse written round it. The lettering's form: Latin capitals running clockwise from a cross at the top, tops outward |
| 3. Talisman | Mathers, *The Key of Solomon the King* (London 1889), Wellcome copy `b24884431`, Public Domain Mark (works: `mathers1889`, new) | Pl. IV Fig. 20 (n79), note p. 61 (n80); Fig. 21 (n79), note p. 62 (n81) | Public domain everywhere (Mathers d. 1918) | Fig. 20: seals inside a ring that carries a psalm verse. Fig. 21: an angel's name (Bariel, with Adoniel) inside the field, with a verse round it |
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

### Readings of the plates (by eye; Y0 confirmed them)

Y0 read each plate again on its leaf and agreed with every reading
below; its additions are in [What Y0 found](#what-y0-found).

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

**Y0's answer: a separate engraving, not a plate.** The 1823 printing's
half-title verso (`&pg=PP10`) announces it as being engraved, showing
the 72 genii's talismans divided among the twelve signs, to be sold
separately "avec l'analyse" for 3 francs (2 to subscribers). So no
collation of the book can settle it, and none lists it: Amiens 1711996
("1 vol. (VII-153 p.) ; 08") and 293461 ("IV-153 p. ; 8°") name no
plate, and Caillet's *Manuel bibliographique* vol. 2 (1912), no. 6491,
p. 472 (archive.org `manuelbibliograp02cailuoft`, n483) gives the 1823
printing no plate and the reissue "2 tab. h. t.", neither a sphere.
Papus's *La Cabbale* (1903) does not mention it. What would settle it
now: a copy of the engraving itself, catalogued apart from the book
(the BnF's prints department, Amiens), or its deposit in the
*Bibliographie de la France* for 1823–24.

### The verses

- **What the data holds.** `psalm.la` in `seventyTwoAngels.json5` is
  Lenain's Latin from his entries. The psalm numbers are the Vulgate's,
  as Lenain gives them, but his verse numbers often are not (Y0: 29 of
  71 differ; Vehuiah's Ps. 3:3 is the Vulgate's 3:4), and one psalm
  number is wrong (#33's verse is 93:11). The edition's apparatus
  already holds his slips:
  - `lenain/apparatus.json5` has two notes on `psalm.la`: #12, the
    reissue's misprint, and #45, Lenain's "adjuvebat";
  - `lenain/witnesses.json5` reads both against the 1823 printing and
    Ms 5365;
  - `lenainQuotations.test.ts` holds every verse against the bracketed
    Latin in his text.
  - Nothing held the verses against a psalter, so a slip common to
    the data and the transcription passed. Y0's guard now does
    ([What Y0 found](#what-y0-found)).
- **Lengths.** 46 characters (#19) to 103 (#47), unchanged by Y0.
- **Characters** (after Y0). The Latin alphabet with à â æ è ë ï, the
  punctuation `: , ; . ! ?`, and Lenain's spaced colons. No verse has
  Œ, œ or an apostrophe now: #43's "prœveniet" and #54's "cœlo" were our
  misreadings of æ, and #2's "me'ad" the reissue's stray mark.
  - The roman names add é ë ï and the hyphen (Sitaël, Séheiah, Eïael,
    Nith-Haiah, Iah-hel).
- **#2 and #43**, which the first draft sent to Y0, are settled and
  fixed (below). In a table row such slips pass unnoticed; lettered
  round a talisman they do not.
- **#70 has a verse.** The first draft took the data's psalm 0 to mean
  none. Jabamiah's entry has no psalm. It prescribes "le 1er verset de
  la Genèse", which it gives only in French ("Au commencement Dieu créa
  le ciel et la terre"; `seventyTwoAngelsText/fr.json5`, and the
  extraction's note in `lenain/evidence.json5`). The Vulgate's Latin,
  "In principio creavit Deus cælum et terram", is 42 characters; Y0's
  `verses.json5` records it. Kircher, whom Lenain names as his source for
  the verses, prints it in Latin for the 70th genius ("In principio
  creavit Deus cœlum & terram. Gen. 1."; *Oedipus Aegyptiacus* II.1,
  p. 280, `kircher1653Complutense` n287), so the caption can cite
  Lenain's own source rather than only the Vulgate.
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
      QUÀM, LONGÈ, ÆTERNUM, CÆLO, SITAËL;
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
| Pins | Outlined bytes for: Vehuiah band; Asaliah talisman (the longest verse); #43 talisman (æ, once misread as œ) and #55 talisman (Æ); Nith-Haiah bare (the longest roman name); Jabamiah talisman (Genesis). A drawing digest over the package component with every name, roman and legend written out (as `ROSE_SIGIL_DIGEST_NAMES` is), so a data fix moves the inputs hash, not the drawing digest |

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

- **Size** (Y1, all 72). Band: PNG median 66.5 KB, SVG 18.0 KB, 6.1 MB
  for its 144 files. Bare: PNG 22.8 KB, SVG 7.4 KB, 2.2 MB. Talisman:
  PNG 110 KB, SVG 80 KB (131 KB for #47, its outlined lettering), 13.8
  MB. With the rose's, all 576 come to about 28 MB; the hybrid builds
  about 12 MB of them.
- **`AngelSigilFile`** gains a `style`, and the route draws each file
  through the contract its style needs.
- **What is drawn at request time:** the bare and talisman files, once
  per URL per deployment (decision 3). Y1 measured, on a local
  production build: a PNG drawn in a median 10 ms (bare) or 33 ms
  (talisman, 55 ms at most), an SVG in under 3 ms; then served from the
  cache in about 2 ms.

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

- **Every style is 1,024 pixels square,** and every one is shown at
  the same size (decision 9), so swapping them moves nothing.
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
  inside a ring lettered with {verse} in Latin", where {verse} is "a
  verse of Psalm 3" or "Genesis 1:1". The alt text names the psalm
  only: Lenain's verse numbers are often not the Vulgate's (Y0), and the
  page beside it gives both references (decision for Gadi 12, decided).

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

- Every style keeps today's 18rem, which is the column's width on a
  320 px phone (288 px).
- **The talisman** is the same size, on one ring (decision 9). At 288 px
  Y1 measured 10.3 px capitals for 68 of the 72 verses, 10.1 and 10.2 px
  for #9 and #69, 8.7 px for #31 and 9.0 px for #47. The figure opens at
  full size on a tap. A unit test computes every legend's capital
  height at 288 px and fails below 8.5 px, so a longer verse or a
  smaller figure cannot slip in.
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
   at most about 160 ms once per file.
   **Confirmed after Y1** (Gadi, 23 November), knowing what Y1 found:
   Vercel's caches are per deployment (its documentation; not measured
   on Vercel), so the bare and talisman files are drawn again after
   every deploy, about 33 ms for a talisman PNG. Gadi: keep the default
   views fast, without lengthening build and deploy for views that may
   not be opened once between deploys. What the route needs, from Y1:
   - `generateStaticParams` for the band, `dynamicParams` for the rest,
     and `dynamic = "force-static"` with no `revalidate`: Next 16.4
     then keeps a first response (in `.next/server/route-cache`
     locally) and answers later requests from it;
   - `outputFileTracingIncludes` for the route's fonts and the resvg
     WASM, which a request-time draw needs and a build-time one does not;
   - a check against the 72 slugs and four styles before anything is
     drawn, answering an unknown name with a plain 404 and no cache
     entry: Next caches 404s too, so without it every made-up URL
     leaves one behind;
   - no `noindex` on these files (Y1: none is sent).
   The band's 144 files add about 6 s to the build (73 s against 67 s,
   the spike's build with and without them).
   *Alternatives:* every style static (the review's recommendation;
   Y1's numbers: about 28 MB in all, 16 MB more than the hybrid);
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
   as ours: Lenain names the verse but prints it only in French. The
   caption also cites Kircher p. 280 (n287), Lenain's source, which
   gives it in Latin for the 70th genius.
   *Alternatives:*
   - No talisman for #70: the dropdown leaves it out, and a sentence
     says why.
   - Lenain's French.
9. **The talisman is the same size as the others, on one ring** (Gadi,
   23 November, from Y1's sheet at real sizes): 18rem, 288 px on a
   320 px phone, where 68 verses get 10.3 px capitals and the longest,
   #47, 9 px. It opens at full size on a tap. The floor test holds
   every verse at 8.5 px or more at 288 px.
   *Alternatives:*
   - A second ring for the two verses over 90 characters (#31, #47),
     which would give them 10.3 px too.
   - The talisman set wider than the others (it would move the page
     when the style changes).
10. **The band's bottom:** the roman name, read upright, labelled ours.
    No crosses. Y1 drew it so on all 72 and the band held (below).
    *Alternatives:*
    - The roman name tops outward, as Mathers's bottom words are.
    - Nothing at the bottom.
11. **The ink is centred on its bounds and scaled to its style's
    field,** as in the mock-up, with the stroke kept the same on screen.
    Y1: every sigil of the 72 fits, at least 2.2 units clear of the
    ring, start circles and end bars included. A test holds that, and
    that the talisman's box field's corners lie inside its verse ring.
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
13. **Fonts** (settled at Y1).
    - A new upright Noto Serif subset, weight 400, built by
      `scripts/gd-hall-fonts/build.py` as TrueType for resvg, with
      metrics in `fontMetrics.json` and a row in `assets/fonts/README.md`.
      Latin‑1 covers every verse and name since Y0 (no Œ or œ remains);
      add Œ and œ only if a legend ever needs them.
    - Frank Ruhl Libre: the halls' existing Bold (700) letter subset,
      which read better on the ring than a 500 instance in Y1's
      side-by-side renders. No new Hebrew file.
    - The weight is written into the markup, and a test pins the face
      each legend resolves to. Y1 found the trap: a weight-500 cut is
      named "… Medium", so markup asking for weight 500 of "Frank Ruhl
      Libre" silently falls back to another font.
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
    never mirrored. Done in Y0 (ac0f671c): 129,214 bytes as WebP, with
    regions `fig18`, `fig20`, `fig21` and `figs20and21`; the mirror's
    total is 4,203,206 bytes, 296,794 under the cap.
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

## What Y1 found

Y1 ran on 23 November 2026 in a scratch worktree off `main`, never
committed; its scripts, renders and numbers are in the session's
scratchpad, outside the repository. Each claim above, in order:

1. **The verse reads round the ring.** All 72 legends laid out glyph by
   glyph with Noto Serif's metrics, capitals 5 units at most, tracking
   fitted to the length. Capital height in CSS px at 224 / 288 / 343 /
   512 px: 8.0 / 10.3 / 12.2 / 18.3 for every verse up to about 87
   characters (68 of them); #9 and #69 a hair less; #31 (101
   characters) 6.8 / 8.7 / 10.4 / 15.5; #47 (102) 7.0 / 9.0 / 10.7 /
   15.9. A second ring would give #31 and #47 the full size. resvg and
   Chromium agree on all 5,416 glyph positions: median 0.006 unit,
   largest 0.038, none over 0.05. Gadi chose one ring at 18rem from the
   sheet at real sizes (decision 9).
2. **The Hebrew band runs right to left across the top, tops outward,**
   in both renderers for all 72, as Mathers's Fig. 18 does; the roman
   name runs left to right at the bottom, upright; the talisman's verse
   clockwise from the top.
3. **Bounds and fit.** Ink bounds from `wordInk`'s commands (19 names
   with crooks' cubics, 8 with nooses) against sampled outlines. Centred
   on its bounds, every sigil fits each field with its stroke the same
   on screen; the closest any ink, start circle or end bar comes to the
   band's ring is 2.2 units, to the talisman's 2.7. With one fixed scale
   instead (decision 11's alternative), 59 names sit more than 5 units
   off centre.
4. **Fonts:** decision 13 as now written.
5. **Build and first request** (a local production build of Next
   16.4.6, not Vercel): decision 3 and [Files](#files) have the numbers.
   Every first-request file was kept and answered from the cache, with
   `s-maxage=31536000` and no `noindex`. Whether Vercel's cache survives
   a deploy was answered from its documentation (it does not), not
   measured.

## What Y0 found

Built 23 November 2026 (ac0f671c, 5c5f57a7) by an Opus agent, its
by-eye readings made knowing what the psalter reads and labelled so.

- **Mathers 1889** is `mathers1889` in `works.ts`; Plate IV (n79) is
  mirrored (decision 15). The notes are p. 61 (n80, Figs. 18–20) and
  p. 62 (n81, Fig. 21). Fig. 20's verse is Psalm cxxv. 1; Fig. 21's is
  Psalm cxii. 3 (Hebrew numbering).
- **Lenain 1823** (Google Books `qt9SAAAAcAAJ`): the reissue's pp. 45,
  70 and 142 are the same pages, its p. 7 is 1823 p. vii, and #70's
  entry is pp. 93–95, the Genesis verse on p. 95. The title page
  (`PP11`) has more than the plan read: DEUM VERUM, DEUM VIVUM and DEUM
  SANCTUM along the triangle's sides, IAH, IOD and IAHO, and Α and Ω
  beside the disc. `citeUrl` emits only `PR` and `PA` ids, so Y4 must
  add `PP` before it can cite the title page.
- **The sphère cabalistique** was sold separately; see
  [above](#lenains-sphère-cabalistique).
- **Regardie vol. 4** p. 58 (n52): Metatron's and Elohim's sigils, no
  box, each name in small capitals beneath it, under the figure but not
  centred on its ink. Pp. 59–60 are the ruled table.
- **Kircher**, *Oedipus Aegyptiacus* II.1, pp. 275–280 (Complutense
  n282–n287), gives all 72 verses in Hebrew and Latin; p. 274 (n281)
  says one comes from the start of Genesis.
- **The verse guard** (`packages/magick-data/src/kabbalah/lenain/vulgate/`
  and `lenainVulgate.test.ts`): the Clementine Vulgate Project's `Ps.lat`
  and `Gn.lat` (public domain), from a copy pinned to commit `38292f3f`
  of `jrichter/ClementineVulgateConverter`, size and SHA-256 checked;
  the project's own release has no copy of these files, and no archived
  copy was found that day. Each verse links its leaf in Hetzenauer's
  Clementine (Innsbruck 1914, archive.org
  `biblia_sacra_vulgatae_etitionis_1914`). The test compares letters
  only (ignoring case, accents, æ/ae, j/i, punctuation and word
  division), fails on an unlisted difference or a stale entry, and
  checks Lenain's references and #70. A deliberate one-letter mutation
  failed it.
  - 58 of 71 psalm verses agreed (61 after Y2). The 13 others are in
    both printings:
    ten of Lenain's wording (#1, whose "Et tu" is Kircher's; #11
    "exultatur"; #14 "pauperis"; #23; #24; #37 "virtutem"; #39; #50;
    #58; #65), and three spellings of the period (#13, #63 "exultate",
    #19 "expectans"). #33 names Psalm 33 for 93:11 (Kircher has 83).
    Kircher's Latin matches the Vulgate wherever he gives the same
    verse.
  - 29 of Lenain's 71 references differ from the Vulgate's verse
    numbers. `verses.json5` keeps both; the data keeps Lenain's.
  - **Ours, fixed:** #43 "præveniet" and #54 "cælo" (we read æ as œ).
  - **The reissue's, fixed in the field from the 1823 printing:** #2's
    stray mark ("a me ad"), #17 "Dominus", #37's added "ad", #47's psalm
    103 (not 104), #64 "misericordiam". The French keeps the reissue's
    print, as #12 does; each has a note and a 1823 reading in
    `witnesses.json5`.
  - **Not fixed:** Lenain's own departures stay in the field; Y2
    corrects #11, #14 and #37 (decision for Gadi 11).
  - The two new data files are registered for coverage. They were kept
    out of the npm tarball until Gadi signed their Sources rows on 23
    November (decision for Gadi 13), with the three changed Lenain rows.
- **Search:** one publish, $0.0265, 14 passages.
- **Not done:** Ms 5365 was not read for the new notes, and only the
  differing verses were read in the 1823 printing.

## What Y2 built

Built 23 November 2026 by an Opus agent (high), four commits:

- **c9ab1d5c, the verse fix** (decision for Gadi 11): #11 "exaltetur",
  #14 "pauperi" and #37 "virtutum" in the field, Lenain's words kept in
  the French, each with a note citing Kircher's reading and a 1823
  witness. 61 of 71 verses now agree with the Vulgate; 10 differences
  remain listed, and a test holds the four corrected slips (#11, #14,
  #37, #45). One search publish, $0.021 (3 passages).
- **ba976f62, the font:** `assets/fonts/NotoSerif-Regular-latin1.ttf`,
  24,308 bytes, SHA-256 `1bc1b369…2322`, built by `build.py` from the
  pinned google/fonts file, whose hash it now checks; a `roman` table
  in `fontMetrics.json`. Every earlier font file rebuilt byte for byte.
  The Hebrew is the halls' existing Frank Ruhl Libre Bold.
- **44d191ee, the module** `gd/roseSigilStyles.tsx` and its tests
  (layout, glyph order, fit with at least 2 units' clearance, bounds
  against dense sampling, the legend, the floor), not yet a package
  entry.
- **c59ac1d3, magick-data 0.5.0** (also carrying K4's unreleased
  fields).

Departures from this plan: no `fontWeight` prop (the weights are fixed
by the measured metrics and written into the markup; only the families
can be overridden), and two colour props, `ink` and `stroke`.

The rose is unchanged: `roseDigest.mts` prints the same on `main` and
the branch, and nothing under the rose's files moved.

**Signed.** Gadi dated the new Provenance row 23 November 2026, and
0.7.0 is committed (31ae3e5a). Before that: the package's tests refuse an unsigned Provenance
row above 0.0.0, so `gd/roseSigilStyles` cannot be a package entry
until its row is dated. The 0.7.0 release (version, entry, README
section and the row with an empty date) is a ready patch in the
worktree's `.private/`; with a date in the row, it applies and passes
the components smoke test. Also to look at: whether the magick-data
rows for `seventyTwoAngels.json5`, `lenain/apparatus.json5` and
`lenain/witnesses.json5`, whose contents changed under unchanged text,
need re-signing; and decision for Gadi 13. All signed 23 November.

## What Y3 built

Built 23 November 2026 by an Opus agent (high): 9011e06d (the pin) and
609bdeb2 (the contract, the registration and the route). The full gate
is pending.

- **The pin over the 72 rose files** (`roseFiles.test.ts`, first, on
  `main`'s bytes): SHA-256 `89dac30f…3d2e` over every angel's outlined
  rose SVG as the `[file]` route serves it. Taken in a detached worktree
  of `main` (92b325f0) with its own install, where the test passes, and
  passing unchanged on the branch since. The 144 rose files of a `main`
  build and of the branch's build have identical SHA-256 lists (and
  identical `.meta`), and `roseDigest.mts` prints Y2's three digests.
- **`angel-sigil`** (`contracts/angelSigil.ts`): `angel` (the 72 slugs,
  written out as `ANGEL_SIGIL_SLUGS`), `style` (`ANGEL_SIGIL_STYLES`,
  `band` the default), width and height; `ANGEL_SIGIL_GENESIS_VERSE`
  (`jabamiah`). Tests hold the slugs to `angelSlug`, the styles to the
  package's `SIGIL_STYLES` and the Genesis list to the angels without a
  psalm.
- **The registration** (`angelSigilImage.tsx`): profile
  `magickli-angel-sigil-image-v1`; the Hebrew (`angelSigilText`), the
  roman `name.en` and the legend (`psalm.la`, or #70's Vulgate text);
  inputs `seventyTwoAngel` (`name.he`, `name.en`, `psalm`, every row)
  and `lenainVulgateVerse` (#70's `text` only), both in
  `DATA_INPUT_TABLES`; fonts `NotoSerif-Regular-latin1.ttf`, appended
  to `SERVER_FONT_FILES`, and `FrankRuhlLibre-Bold-letters.ttf`. The
  verse file is read from magick-data's build directory
  (`lenainVulgateVerses.ts`): it is published as JSON data, not as a
  module entry.
- **The pins**, reviewed as rasterised: Vehuiah band, #47 and #31
  talismans, #43 (æ) and #55 (Æ) talismans, Nith-Haiah bare, #70
  talisman; a drawing digest over the package component with the 72
  names, romans and legends written out; the inputs hash `25d38e34…`.
  Tests also hold every lettered character to the metrics and to each
  subset's `cmap`, and each run's face at resvg level: the real
  markup's run, outlined with the registration's fonts, draws exactly
  what its subset alone draws, and not what the base set draws.
- **The files** (`angelSigilFiles.ts`, `angelSigils.ts`):
  `AngelSigilFile` has a `style`; `angelSigilStyleFiles(angel, style)`
  and `angelSigilEveryStyle(angel)` name any style's PNG and SVG;
  `angelSigilFiles` and `allAngelSigilFiles` still name only the rose's,
  so the pages, JSON-LD and sitemap are as they were.
- **The route:** `force-static`, `dynamicParams`, no `revalidate`;
  `generateStaticParams` lists the rose's and the band's 288 files;
  `outputFileTracingIncludes` adds the base fonts, the two subsets and
  the WASM. `/api/render/angel-sigil` answers every request with a 308
  to its file (`style=rose` to the rose's), dropping `download`, width
  and height, as the files have one size.
- **Measured** on a local production build (Next 16.4.6, not Vercel):
  the build took 130 s against `main`'s 118 s, separate runs on a
  shared machine; the band's 144 files are 6,043,202 bytes. First
  request, median (largest) over the 72: talisman PNG 36.6 ms (77),
  SVG 8.1 ms; bare PNG 15.6 ms, SVG 4.5 ms; every second request a
  cache hit in about 2.3 ms; no `noindex` on any file.

Departures:

- **An unknown name throws Next's `NoFallbackError`** instead of
  returning a plain 404. Y1's own run shows that a 404 returned from a
  `force-static` handler is cached like any first response (`404 MISS
  s-maxage=31536000`). The error is what `dynamicParams = false` throws:
  Next answers with the site's 404 page (`no-store`) and writes no
  cache entry, which the local run confirmed. Two costs: it imports
  Next's internal `next/dist/shared/lib/no-fallback-error.external`, so
  a Next upgrade must recheck it (the route test holds the throw, the
  build run the 404); and `next start` logs one error line for each
  such request, from the rejected revalidation Next hands `waitUntil`.
- **The contract's file name for the rose** is the rose's own file,
  `<slug>-rose-cross-sigil`, which the redirect sends it to.

Not done: the whole-data sweep (`RENDER_INPUT_SWEEP=1`), which now
draws 144 angel images a change; the mutation test covers a verse,
#70's Genesis, another Vulgate verse (no move) and a roman name.

## What Y4 built

Built 23 November 2026 by an Opus agent (high): 2ad65ec5. The full gate
(`test:coverage` and `build` over everything) is pending.

- **The angel page** (`AngelSigil.tsx`): the heading; a native select
  labelled "Sigil style" with the four descriptive names, in the
  contract's order (band, bare, rose, talisman); one `<img>` of the
  chosen style's PNG at 18rem on the light plate, wrapped in a plain
  link to the PNG so that a tap opens it at full size (the old figure
  had no such link); its caption; the generator sentence, unchanged;
  Download PNG and SVG for the shown style; and "Every style:" as a
  short list, one line a style with its PNG and SVG links, in the
  HTML. Links are 24 px targets with a mouse and 44 px on a coarse
  pointer, and so is the select.
- **URL state** (`urlState.ts`), as the tablets page's: read through
  `useSyncExternalStore` with an empty server snapshot, written with
  `replaceState` (other params and the hash kept, the band never
  written), unknown values the band, nothing stored.
- **Captions** as drafted, each scan through `<Cite>`: Mathers Pl. IV
  (n79, the mirror, outlining Fig. 18 or Fig. 21), Regardie pp. 57–58
  (n51, n52), Lenain 1823 p. 45 and its title page, and for #70
  Kircher p. 280 (n287). The title page is Google Books `PP11`:
  `citeUrl` and `<Cite>` gained `preliminary` (Google's PP), tested,
  and the mirror never matches such a page.
- **Alt texts** per style, the Lauviahs numbered; the talisman's names
  the psalm only, or Genesis 1:1 for #70. The rose's is plan 088's.
- **Structured data, sitemap, share image:** each style's PNG and SVG,
  the band's first, each `ImageObject` with its alt text as caption and
  `isBasedOn` as decision 4 lists; a test holds those works to the
  package's `SIGIL_STYLE_NOTES`, and every scan a caption links to the
  notes or to the title page and Kircher's page. The sitemap gives each
  angel eight images, the band's PNG first; the second Open Graph image
  is the band's PNG.
- **The 72 list** shows the band's PNG, with no menu; its caption names
  the style and links the angel's page and the generator.
- **Lingui:** the new messages are descriptors with translator comments
  (Lingui's `/*i18n*/ { id, comment }`), except the list's caption, a
  literal so that search still reads it; Hebrew written by the agent.
  `i18n:context` flagged the changed scoped files (Y3's route among
  them); the scopes' descriptions still hold, and the snapshot was
  acknowledged without editing the context.
- **Search:** one publish for the list's caption, $0.0205 estimated,
  200 tokens, one row replaced.
- **Checked** on a production build (`next start`, 127.0.0.1, a fresh
  port, headless Chromium): Vehuiah in each style, Asaliah's talisman
  and the list at 375, 768 and 1,440 px, light and dark, and Jabamiah's
  talisman at 375. No sideways scroll; one 288 px figure in every
  style, the select and the caption in the column; 44 px targets at 375
  and 768 with a coarse pointer; a shared `?style=talisman` shows the
  talisman once hydrated; without JavaScript the band and the "Every
  style" list; no console errors. The angel pages have no Hebrew
  edition. Safari not checked: no device.
- **The rose:** the 144 rose files of this build match `main`'s
  SHA-256 list.

## Stages

Built on a gate branch, `gate/sigil-styles`, from `main` after
`gate/sigil-followups` merges. Y0 and Y1 run side by side.

| Stage | What | Gate |
| --- | --- | --- |
| Y0 (built 23 Nov, ac0f671c, 5c5f57a7) | **Sources and the verse guard.** (a) Lenain 1823: the pages for the reissue's pp. 45 and 70, the title page, and #70's entry. (b) The sphère cabalistique: catalogue collations and other copies of 1823. (c) Mathers Pl. IV Figs. 18, 20 and 21 and their notes (pp. 61–62), with their leaves. (d) Regardie p. 58. (e) **The verses**, below. (f) `mathers1889` in `works.ts`, and Plate IV mirrored. (g) If a verse changed, `pnpm search:publish` | Gadi reviews the discrepancy table. The verse test is green and committed |
| Y1 (run 23 Nov) | **Spike** (above) | The numbers recorded here; Gadi chooses from side-by-side renders at real sizes (decisions 9, 10, 13) |
| Y2 (built 23 Nov, c9ab1d5c to 31ae3e5a) | **Package:** `roseSigilStyles`, the bounds, the lettering, the notes. **Fonts:** the subset, metrics, README. magick-components 0.7.0, and magick-data's next minor if Y0 changed a verse | `roseDigest.mts` unchanged; the halls' pins unchanged; package tests (layout, glyph order, fit, bounds) |
| Y3 (built 23 Nov, 9011e06d, 609bdeb2) | **Contract and route.** First, on `main`'s bytes, the pin over the 72 outlined rose SVGs. Then `angel-sigil`, its registration, its inputs (`seventyTwoAngel` and the verse file in `DATA_INPUT_TABLES`), the coverage test, the pins and the drawing digest, and the redirects | Contract, registry, dataInputs and route tests; `ROSE_SIGIL_PINS`, the rose's drawing digest and the new 72-SVG pin unchanged; the 144 rose files' hash list unchanged |
| Y4 (built 23 Nov, 2ad65ec5) | **Angel pages and the list:** the 432 new files, the dropdown, URL state, captions with `<Cite>`, alt texts, downloads, the "Every style" line, JSON-LD, sitemap, share image, `ListSigil`; Lingui and Hebrew; search publish for the list's caption | The full gate (below); the hydration test; the browser checks; the 144 rose files again |

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
  corrected verse, as #45's does. Y0 applied this to our slips and
  the reissue's, but not to Lenain's own departures, which its brief
  left out. Decided (decision for Gadi 11): Y2 corrects #11, #14 and
  #37 in the field; Lenain's other departures stay, each noted.

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
- **Long verses on phones.** Settled at one ring, 18rem (decision 9):
  #31 and #47 are the smallest, at 8.7 and 9 px capitals on a 320 px
  phone, and the floor test stops anything smaller.
- **A shift after hydration.** A shared talisman link shows the band
  first, then swaps to the wider talisman. It is a layout shift on load
  for that link only. Keeping the box at the larger size until
  hydration is the fallback if it measures badly.
- **A missing glyph falls back silently,** or a face does (Y1's
  "Medium" trap). The coverage test, the face test and the æ and Æ pins
  guard it.
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

Decided after Y1 (23 November): one ring at 18rem, as recommended
(decision 9), and the hybrid confirmed (decision 3).

Open after Y0 (11 and 12 decided 23 November as recommended; 13 waits
for Gadi's date):

11. **Lenain's own departures in the field.** The plan's Fixes rule
    (correct Lenain's slip in the field, keep it in the French, as #45)
    against Y0's brief (correct only where it is ours). Recommended:
    correct the three that are not Latin as they stand, #11
    "exultatur", #14 "pauperis" and #37 "virtutem", as #45 is; keep the
    rest as Lenain's readings with a note (the reorderings, additions
    and omissions, #1's "Et tu", which is Kircher's, and the period
    spellings), since the talisman letters Lenain's Latin and its
    caption says so.
12. **The talisman's alt text:** name the psalm only ("a verse of
    Psalm 3"), as now drafted; or give Lenain's reference, or the
    Vulgate's.
13. **Sign-off for Y0's two data files** (signed 23 November 2026) (`lenain/vulgate/verses.json5`
    and `differences.json5`): their Sources row needs Gadi's date
    before they ship in magick-data's tarball.

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
