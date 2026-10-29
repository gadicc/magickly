# Search pages for the temple halls — 26 October 2026

Status: built on `gate/hall-seo` (26 October 2026), every commit
gated; see "Stages 7 to 11 and the checks" for the results. Read
[current status](000-current-status.md) first. This plan builds on the
whole-site SEO of [plan 028](028-seo.md), the image route of
[plan 027](027-component-exports.md), the entity pages of
[plan 036](036-entity-pages.md) and the halls of
[plan 061](061-gd-hall.md), whose presets it publishes. Revised the same
day after an adversarial review (verdict "not ready as written", the
design sound apart from the findings folded in below; evidence in
`~/.cache/review-seo/`) and Gadi's answers to the first draft's seven
questions; Gadi answered the last three the same day (the outliner's
option (a), the SVG indexable, a medium size for phones). **Amended on
28 October 2026**: the halls move to `/gd/halls` (an index, the hall
pages with a rail, and the editor at `/gd/halls/editor`), which
supersedes the "URLs" decision below and every `/gd/hall` path in this
plan; see [the amendment](#amendment-the-halls-under-gdhalls-28-october-2026).

Gadi's decisions of 26 October 2026:

- **Licence.** The hall images are CC BY 4.0. The art is original and,
  as code, MIT (plan 061, decision 9); the presets are MIT data.
- **URLs.** One server-rendered, statically generated page per preset
  under `/gd/hall/<slug>`. `/gd/hall` stays the editor and gains a
  server-rendered gallery, below the editor with a jump link to it.
  (Superseded on 28 October 2026 by the amendment at the end: the pages
  are `/gd/halls/<slug>`, the index `/gd/halls` and the editor
  `/gd/halls/editor`.)
- **Slugs.** Numbered: `neophyte`, `zelator-1`, `zelator-2`,
  `theoricus-1`, `theoricus-2`, `practicus-1` … `practicus-3`,
  `philosophus-1` … `philosophus-4`, `portal-1`, `portal-2`. Titles and
  H1s carry the descriptive part ("Golden Dawn Zelator Temple, part 1
  (1=10): floor plan", or the path's name where there is one), and the
  image files follow the slugs (`golden-dawn-zelator-1-temple.png`).
- **Enochian Plain** in the published images (the tablets' letters) is
  acceptable; its unknown licence is a follow-up.
- **Social image**: the 1,200 × 630 card with the hall drawn in it
  first, the hall PNG second.
- **Credit**: the site, not a person. `creator` the `Organization`
  "Magick.ly", `creditText` "Magick.ly, CC BY 4.0", `copyrightNotice`
  "© 2026 Magick.ly. Licensed under CC BY 4.0", and a visible line
  "Floor plan © 2026 Magick.ly, CC BY 4.0. Free to reuse with credit."
- **Editor exports** carry the art's attribution only, never a licence
  over the user's arrangement.
- **IPTC Digital Source Type**: left out; a follow-up.
- **Leads**: the implementing agent drafts the fourteen authored leads
  and Gadi reviews them on one sheet.
- **Process.** This plan first, with an adversarial review, then the
  stages below.

## Background

What exists on `main` at a633e95, read for this plan:

- **`/gd/hall`** (`src/app/gd/hall/page.tsx`) is a server component that
  renders two short paragraphs, the fonts' `@font-face` rules and a
  loader; the editor (`HallPlayground.tsx`) loads with `next/dynamic`
  and `ssr: false`. The server HTML therefore holds no drawing, no
  preset names and no sources: the Sources list is in the client editor
  and shows only for an unchanged preset. Its search description in
  `src/seo/pages.ts` names three presets of the fourteen. The editor
  opens a share link from the fragment (`#hall=1.<data>`,
  `hallShare.ts`) as one undoable step, never writing over the draft
  until the hall changes.
- **Presets** (`src/components/gd/hall/presets`): fourteen
  `HallPreset`s with `id`, `title` ("Zelator Temple 1"), `grade`
  (`0=0` … `4=7`, `Portal`), `part` and structured `sources`
  (`hallSourceText`, `hallSourceUrl`). Their resolved viewBoxes, in
  checker squares (measured with `resolveHall` on a633e95):

  | Preset | Grade | Width × height | Aspect |
  | --- | --- | --- | --- |
  | `neophyte` | 0=0 | 19.04 × 25.30 | 0.752 |
  | `zelator1`, `zelator2` | 1=10 | 19.04 × 27.75 | 0.686 |
  | `theoricus1` | 2=9 | 19.04 × 27.75 | 0.686 |
  | `theoricus2` | 2=9 | 19.04 × 30.71 | 0.620 |
  | `practicus1`, `practicus2` | 3=8 | 19.04 × 26.75 | 0.712 |
  | `practicus3` | 3=8 | 22.24 × 29.71 | 0.748 |
  | `philosophus1`, `philosophus2` | 4=7 | 19.95 × 26.75 | 0.746 |
  | `philosophus3`, `philosophus4` | 4=7 | 22.24 × 29.71 | 0.748 |
  | `portal1` | Portal | 19.04 × 26.54 | 0.717 |
  | `portal2` | Portal | 19.04 × 27.75 | 0.686 |

  Every hall is portrait, and the bounds differ by preset.
- **SEO** (`src/seo`): the public page registry, `seoMetadata`,
  entity page lists (`entities.ts`, `lenain.ts`), the `/og/...png` cards
  drawn at build time (`cards.ts`, `cardList.ts`, `cardArt.ts`, whose
  art can be a diagram from the image route), `JsonLd`, and
  `src/app/sitemap.ts` (URLs only: `sitemap.test.ts` requires every entry
  to have the single key `url`) and `robots.ts` (allows `/` and the
  public renderers, disallows `/api/`). `routes.test.ts` classifies every
  `page.tsx` as public, entity or private, requires `dynamicParams =
  false` beside `generateStaticParams`, and keeps `"use client"` out of
  page files. The site is in English only, so no `hreflang` or
  alternates are needed.
- **The app bar** (`MyAppBar.tsx`, `pathnames.ts`) is the site's visible
  breadcrumb: below a section with no entry of its own, it shows the
  section trail and the page names itself in its own `h1`. `gd.hall` is
  a leaf today ("Temple Halls").
- **The image route** (`/api/render/[slug]`): pure contracts in
  `src/render/contracts` (one fixed `viewBox` each, `keys`, `personal`,
  `parse`, `canonicalize`, `filename`), the server-only registry
  (`registry.tsx`: render, outline profile, data inputs, extra fonts),
  `renderComponentImage` (`renderToStaticMarkup`, then resvg-wasm
  2.6.2 outlining with bundled TTFs, then sharp for PNG with
  `limitInputPixels: 4_194_304`) and `componentImageResponse` (`ETag`,
  `Cache-Control: public, max-age=0, must-revalidate, s-maxage=86400,
  stale-while-revalidate=604800`, `Content-Disposition` with the
  contract's file name, `X-Robots-Tag: noindex` for personal slugs).
  The outliner refuses output containing `href=`, `url(`, `<text`,
  `<style` or `<image`, strips every `id`, and checks that the source
  and output roots both carry the contract's `viewBox` string exactly.
  `cardArt.drawArt` asks the route for `fmt=png&height=1020` for every
  diagram card. `/enochian/tablets` exposes the same URL as
  ExportControls' "Image link" and names downloads with
  `componentImageFilename`.
- **What plan 061 left for server rendering** (Follow-ups): `GdHall`
  calls `useId` and `useMemo`, and the `/og` and `/api/render` routes
  render with no hook dispatcher (Stage A2 notes: a `useId` in the
  Shewbread broke the production build), so a hall needs a hook-free id
  scheme first; resvg-wasm did not resolve the hall's quoted font stacks
  (`"GdHall Noto Serif", "Noto Serif", serif`) and fell back to Noto
  Sans; the label fonts exist only as WOFF2 subsets in `public/fonts`,
  while the outliner loads TTFs; and the tablets draw their letters in
  Enochian Plain, whose licence is unknown
  (`assets/fonts/EnochianPlain-NOTICE.txt`).
- **What the review measured** (`~/.cache/review-seo/`): every preset
  fails the outliner as it stands. The source root's viewBox
  (`-151.81 -520.81 1903.62 2529.99` for the Neophyte) comes back from
  resvg as `1903.6201`, failing the root check; underneath, each hall's
  outlined body keeps 6 to 18 `url(#…)` references to a checker
  `pattern`, the wall's and the art's gradients and `clipPath`s (some
  of which, `clipPath1` …, resvg itself generates for nested
  viewports), which the dependency check refuses and the id stripping
  would break. Outlined sizes without the label fonts: 26 to 162 KB.
  sharp refuses the Neophyte at its viewBox size (input pixel limit);
  with the root's `width` and `height` set to 1,500 px it gives
  1,500 × 1,993 in 81 KB, and 360 × 478 in 8 KB. sharp's `withXmp`
  writes the XMP in a `zTXt` chunk, not the `iTXt` chunk the XMP
  specification names for PNG, and a later re-encode drops it.
  Practicus 1 and 2, and Philosophus 1 and 2, outlined to the same byte
  counts, which suggests the letters and trumps that tell them apart
  went missing without the label fonts.
- **Next 16.3.8** (`node_modules/next/dist/docs`): a sitemap entry takes
  `images: string[]`, written as `<image:image><image:loc>`; the
  serialiser (`build/webpack/loaders/metadata/resolve-route-data.js`)
  writes `<loc>` and `<image:loc>` without XML escaping and without
  `metadataBase`, so image URLs must be absolute and must not contain
  `&`. Route handlers prerender with `generateStaticParams` and
  `dynamicParams = false`, as `/og/[...card]` does. Metadata merges
  shallowly, so a page that sets `twitter` replaces the root layout's
  `twitter.card`.
- **Google's image licence metadata**
  (developers.google.com/search/docs/appearance/structured-data/image-license-metadata,
  read 26 October 2026): an `ImageObject` needs `contentUrl` and at least
  one of `creator`, `creditText`, `copyrightNotice` or `license`; the
  "Licensable" badge needs `license`; `acquireLicensePage` is
  recommended; markup is needed on each page where the image appears,
  and `contentUrl` names the image the page shows. The IPTC alternative
  embedded in the file uses Creator, Credit Line, Copyright Notice, Web
  Statement of Rights (needed for the badge), Licensor URL and the
  recommended Digital Source Type; structured data wins a conflict.
- **`/about`** already says the images this app draws are CC BY 4.0
  ("such as the Tree of Life, sigils, tablets and lamens"), and its
  credits keep the Eye of Horus and caduceus credits for the old
  `public/pics` drawings until plan 061's stage I.
- **The service worker** (`src/app/sw.ts`, Serwist's `defaultCache`)
  caches images stale-while-revalidate.

## Decisions

### 1. Slugs, titles and file names

Decided by Gadi (numbered slugs). One table in `src/seo/halls.ts` maps
each preset id to its public names; nothing else derives a slug:

| Preset id | Slug | H1 and title | Image file |
| --- | --- | --- | --- |
| `neophyte` | `neophyte` | Golden Dawn Neophyte Temple (0=0): floor plan | `golden-dawn-neophyte-temple` |
| `zelator1` | `zelator-1` | Golden Dawn Zelator Temple, part 1 (1=10): floor plan | `golden-dawn-zelator-1-temple` |
| `zelator2` | `zelator-2` | Golden Dawn Zelator Temple, part 2 (1=10): floor plan | `golden-dawn-zelator-2-temple` |
| `theoricus1` | `theoricus-1` | Golden Dawn Theoricus Temple, 32nd path (2=9): floor plan | `golden-dawn-theoricus-1-temple` |
| `theoricus2` | `theoricus-2` | Golden Dawn Theoricus Temple in Yesod (2=9): floor plan | `golden-dawn-theoricus-2-temple` |
| `practicus1` | `practicus-1` | Golden Dawn Practicus Temple, 31st path (3=8): floor plan | `golden-dawn-practicus-1-temple` |
| `practicus2` | `practicus-2` | Golden Dawn Practicus Temple, 30th path (3=8): floor plan | `golden-dawn-practicus-2-temple` |
| `practicus3` | `practicus-3` | Golden Dawn Practicus Temple in Hod (3=8): floor plan | `golden-dawn-practicus-3-temple` |
| `philosophus1` | `philosophus-1` | Golden Dawn Philosophus Temple, 29th path (4=7): floor plan | `golden-dawn-philosophus-1-temple` |
| `philosophus2` | `philosophus-2` | Golden Dawn Philosophus Temple, 28th path (4=7): floor plan | `golden-dawn-philosophus-2-temple` |
| `philosophus3` | `philosophus-3` | Golden Dawn Philosophus Temple, 27th path (4=7): floor plan | `golden-dawn-philosophus-3-temple` |
| `philosophus4` | `philosophus-4` | Golden Dawn Philosophus Temple in Netzach (4=7): floor plan | `golden-dawn-philosophus-4-temple` |
| `portal1` | `portal-1` | Golden Dawn Portal Temple, part 1: floor plan | `golden-dawn-portal-1-temple` |
| `portal2` | `portal-2` | Golden Dawn Portal Temple, part 2: floor plan | `golden-dawn-portal-2-temple` |

- The descriptive parts come from the presets' own doc comments and
  plan 061: Theoricus 1 is the 32nd path and Theoricus 2 the 2=9 hall in
  Yesod (p.82, "the Theoricus 2=9 Yesod diagram"); Practicus 1 and 2 the
  31st and 30th paths and 3 "the temple in Hod"; Philosophus 1–3 the
  29th, 28th and 27th paths and 4 "the entry into Netzach". The Zelator
  and Portal halls are parts; the plan names no path for them, since the
  sources do not give the presets one.
- The `<title>` is the H1 (the layout's template adds " | Magick.ly");
  the longest, Philosophus 1–4, are 59 characters before the suffix. A
  short name for the gallery, cards and breadcrumb drops the prefix and
  the suffix ("Zelator Temple, part 1").
- Each table row also records the grade's data id (`0=0` … `4=7`,
  `portal`; the presets write `Portal`) for the grade pages' links.
- **Tests** pin the table literally: the fourteen slugs, in order, each
  preset in `HALL_PRESETS` exactly once, slugs lowercase
  `[a-z0-9-]+`, unique, and not the name of any static child route of
  `/gd/hall` (a later `/gd/hall/<name>` page would shadow a slug); file
  names start `golden-dawn-` and end `-temple`; titles at most 60
  characters and unique. The test's comment says the rule: a published
  slug never changes; a renamed preset id changes the table's key, not
  its slug, and a withdrawn hall gets a permanent redirect
  (`redirects()` in `next.config`), never a reused slug.

Considered and not chosen: descriptive slugs (`practicus-31st-path`,
`philosophus-4-7`, `portal-part-1`) match path searches a little better
but are longer, mix two naming schemes across one grade, and tie the
URL to a reading of the sources that could still change; a mix
(numbered parts, named paths) has the same inconsistency. The
descriptive words carry the searches in titles, H1s, alt text and
descriptions instead, where they can be corrected without moving a URL.

### 2. A page per preset

`src/app/gd/hall/[slug]/page.tsx`, an entity route like
`/gd/grade/[id]`: `generateStaticParams` from the slug table,
`dynamicParams = false`, `generateMetadata` from `hallPage(slug)` with
`notFound()` for anything else, and a server component with no
`"use client"` and no page-specific client code. `routes.test.ts` lists
it under `ENTITY_ROUTES`. `pathnames.ts` turns `gd.hall` into a section
(`{ "/": "Temple Halls" }`), so the app bar shows "Golden Dawn › Temple
Halls" as the trail and the page's own `h1` names the hall, as on the
Sephirah and angel pages.

The page, top to bottom:

1. **H1** (decision 1).
2. **The hall** in a `<figure>`: a plain `<img>` whose `src` is the full
   PNG and whose `srcset` offers the medium and full PNGs with `sizes`
   for the text column, so a phone fetches the 750 px file;
   `width` and `height` from the full file, `fetchpriority="high"` (it
   is the page's largest element), the generated `alt` (decision 9),
   and a `<figcaption>` with the credit line (decision 14). Not
   `next/image` (Gadi asked; decision 3).
3. **Actions**: "Open in the editor" (`/gd/hall#preset=<slug>`,
   decision 12), "Download PNG" and "Download SVG" (the static files,
   `download` set to the file name; the SVG link's `href` is the SVG
   `ImageObject`'s `contentUrl`).
4. **About this hall**, in our own words (decision 9): an authored lead
   of one to three sentences, then generated lists of the officers'
   stations, what is on the altar, and what else stands in the hall
   (tablets, banners, pillars, letters, boards, cards).
5. **Sources**: each preset source as `hallSourceText` linked by
   `hallSourceUrl` (Regardie 1938, vol. 2, page and archive.org leaf; the
   `public/pics` drawing while it is served), and where plan 061's
   "Where the sources disagree" table has a row for the preset, one
   authored sentence saying what the preset follows (for example, Portal
   1 takes the diagram its rubric describes).
6. **Licence** (`id="licence"`): decision 14.
7. **Other halls**: the previous and next preset, and a link back to the
   gallery (`/gd/hall#halls`).

### 3. Image files and the render contract

**A new contract, `gd-hall`**, in `src/render/contracts/gdHall.ts`:

- `keys: ["hall", "size"]`. `hall` is a slug from the table (default
  `neophyte`, omitted when canonical, like the tablet's `earth`). `size`
  applies to PNG only: absent for the full image (1,500 px wide), or
  `medium` (750 px) or `small` (360 px, the gallery's 180 CSS px at
  2×); an SVG with a `size` is refused, and so are `width` and `height`.
  The route can therefore produce at most 56 distinct responses (14
  SVGs and 42 PNGs), and varied queries cannot each cost a render (the
  rate-limit follow-up in plan 000 stays open for the other slugs).
- The full PNG's 1,500 px make the halls 1,990–2,420 px tall, at most
  3.63 million pixels, inside the route's 4,194,304; 1,600 px would put
  Theoricus 2 at 4.13 million, within 2 % of the limit.
- `personal: false`: a preset is site content, not user state.
  Arbitrary halls by URL are out of scope (they would be personal,
  unbounded and a render cost per request).
- `filename`: the table's file name, `-medium` or `-small` appended.
- The contract imports no hall code (contracts ship in client bundles):
  the slug list and each hall's integer viewBox (decision 4) are
  written out, and a test holds them equal to the slug table and to what
  `GdHallSvg` writes in image mode, as `TABLET_VIEWBOX` is held to the
  component's.

**The canonical image URLs are static files**, prerendered by a route
handler at `src/app/gd/hall/[slug]/[file]/route.ts`
(`generateStaticParams` for the four files of each hall,
`dynamicParams = false`), which calls `renderComponentImage("gd-hall",
…)` in process at build time, as the `/og` cards do:

```
/gd/hall/zelator-1/golden-dawn-zelator-1-temple.png
/gd/hall/zelator-1/golden-dawn-zelator-1-temple-medium.png
/gd/hall/zelator-1/golden-dawn-zelator-1-temple-small.png
/gd/hall/zelator-1/golden-dawn-zelator-1-temple.svg
```

The reasons: the file name is in the URL, which Google Images reads
and which a download keeps; the URL has no query string, so it can go
into the sitemap unescaped and into `og:image` without encoding; and a
prerendered file costs no function invocation.

**Two indexable files per hall**, the full PNG and the SVG (Gadi, 26
October 2026, reversing this plan's recommendation). The cost is low:
Google treats the two as separate images, groups near-duplicates and
shows one, and some people search for vector files. The PNG stays
primary: it is the page's `<img>`, the first `ImageObject`, the
`og:image` after the card, and first in the sitemap entry. `X-Robots-Tag:
noindex` goes on the medium and small PNGs and on the API copies
(`/api/render/gd-hall?hall=zelator-1&fmt=png`, which the editor's
"Image link" and the cards use). The static files' headers are set in
`next.config`'s `headers()` (`/gd/hall/:slug/:file` patterns matching
the `-medium.png` and `-small.png` suffixes), which applies to
prerendered output on `next start` and Vercel alike; the API's comes from a contract flag
`indexed: false` beside `personal`, which `componentImageResponse`
reads as it reads `personal`. A test reads the built `next.config`
headers and a route test the API's.

`robots.ts` needs no change: `/gd/hall/` is under the allowed `/`.

### 4. Drawing a hall on the server

- **Hook-free.** `GdHall` splits into a pure `GdHallSvg` (takes the
  resolved hall, an `idPrefix`, the font CSS, the font stacks and an
  image mode; no hooks) and the existing `GdHall`, which keeps `useId`
  and `useMemo` and renders `GdHallSvg`. The reader, editor and exports
  keep their output: the package's snapshots and
  `GdHall.hydration.test.tsx` must pass unchanged. The image registry
  renders `GdHallSvg` with `idPrefix="gdhall"` and image mode on. A test
  renders every preset through the image registry in the server
  condition, as the route does, so a hook added anywhere under the art
  (lamens, tablets, kameas, `TreeFigure`, cards) fails a test rather
  than a build. This closes plan 061's follow-up "a hook-free id scheme
  for `GdHall`".
- **One art registry for images.** `hallImageArt` (in one server-safe
  module) is `defaultHallArt` with `tabletArt({ fontFamily: "Enochian"
  })`, the family of the bundled `EnochianPlain.ttf`, as the
  `enochian-tablet` registration draws it; the registry, the golden
  pins and the viewBox test all import that one name. A test resolves
  every preset with the app's `gdHallArt` and with `hallImageArt` and
  expects the same layout and viewBox, which proves the tablets' font
  never moves a box.
- **Integer viewBox.** In image mode `GdHallSvg` rounds the bounds
  outward to whole units (100 per square: `floor` the origin, `ceil`
  the far edge) and writes integers, which resvg returns unchanged
  (it rewrote `1903.62` as `1903.6201`). The contract's table holds
  those integers; the margin grows by under one unit (a hundredth of a
  square).
- **Sizing.** The image mode writes the root's `width` and `height` as
  the PNG size requested, so sharp rasterises at that size within its
  input limit (the review: 1,500 × 1,993 in 81 KB, 360 × 478 in 8 KB,
  for the Neophyte without label fonts). The SVG file is written with
  the full size's `width` and `height`.
- **Fonts.** resvg reads TTF/OTF, so the label subsets get TTF twins
  under `assets/fonts` (server-only, never served or precached).
  `scripts/gd-hall-fonts/build.py` writes the TTF and WOFF2 of each
  subset in one run, from the same Noto Serif and Noto Serif Hebrew
  sources and glyph sets, so the widths `fontMetrics.json` measured
  still hold; `assets/fonts/README.md` pins the sources by commit and
  all six files by SHA-256, beside the OFL texts, and a test checks the
  bytes. The registry lists the three TTFs and `EnochianPlain.ttf` as
  the slug's `fonts`. `GdHallSvg` takes the font stacks as a prop; the
  image mode passes bare family names, and the `<style>` with
  `@font-face` rules is left out of the image source (resvg ignores it,
  and the outliner refuses `<style>`). The spike confirms that resvg
  resolves the bare names to the real twins, not only the full fonts
  plan 061 tried.
- **Accessibility inside the file.** The outlined root keeps the
  source's attributes; in image mode `GdHallSvg` writes neither `role`
  nor `aria-labelledby` (its `<title>` would be outlined away, leaving a
  dangling reference), and decision 7 adds a `<title>` after outlining.

### 5. Paint servers in the outliner (decided: option (a))

The halls fill the floor with a checker `pattern`, shade the walls and
some art with gradients, and clip nested drawings; resvg keeps these as
`pattern`, `linearGradient`, `radialGradient` and `clipPath` elements in
`<defs>`, referenced by `url(#id)`, and adds `clipPath`s of its own. The
outliner refuses `url(` and strips every id. Two ways through:

- **(a) Admit local paint servers, for `gd-hall` only (Gadi chose
  this on 26 October 2026).**
  A per-registration option (`paintServers: true`) lets the outlined
  body keep `url(#id)` references that resolve to a `linearGradient`,
  `radialGradient`, `pattern` or `clipPath` element inside the root's
  `<defs>`. Those elements keep their ids, rewritten with the
  `gdhall-` prefix (resvg's own `clipPath1` included) so an SVG pasted
  into another document cannot collide; every other id is stripped as
  now. Still refused: any `href`, `<text`, `<style`, `<image`, a
  `url(` that is not `url(#id)`, and any reference that resolves to
  nothing or to another kind of element. The other six slugs never set
  the option, and their golden byte tests prove them unchanged. The
  image stays the drawing the editor shows, and the SVG stays small.
- **(b) Draw without paint servers in image mode.** `GdHallSvg` and the
  art draw the checker as explicit squares, gradients as flat colours
  and clips as geometry, so the outliner stays as it is. It touches
  every art module that uses a gradient or clip, makes the image differ
  from the editor's drawing, enlarges the SVG (256 squares at least
  instead of one pattern), and resvg may still generate `clipPath`s for
  nested viewports (the Shewbread and candlestick draw in nested
  `<svg>`s), which (b) cannot prevent.

The spike's first item runs (a) on all fourteen presets and lists
every reference kind and element resvg emits.

### 6. A viewBox per request

`ComponentImageContract` gains an optional `viewBoxOf(props)`; the
fixed `viewBox` stays the default, so the six existing contracts do not
change. `parseDimensions`, the outliner's root check and the PNG's
aspect read `viewBoxOf(props) ?? viewBox`. The existing golden byte
tests (the Tree reference among them) must pass unchanged, which is the
proof that no other image moved. This also unblocks the Tablet of Union
on the image route (plan 061's "a viewBox per id"), which is not done
here.

### 7. Identity, byte pins and caching

- The `gd-hall` registration takes its own profile,
  `magickli-gd-hall-image-v1`, and an `inputs` spec covering every
  magick-data field any preset draws (the tablets' readings and
  versions, the kameas, the Tree's paths and colours for boards, the
  trumps' titles); `dataInputs.sweep.test.ts` (`RENDER_INPUT_SWEEP=1`)
  proves the spec complete.
- The art and presets are code, and plan 061 still has art to decide,
  so the drawing will change under one profile. Each image already
  records `sourceSha256` (the SVG before outlining); a golden test pins,
  per preset and size, the source digest and the SVG and PNG output
  digests together, so every byte change is a deliberate, reviewed
  update of the pins in the commit that causes it, and the profile
  moves only when the renderer does (plan 032's rule). No catalog
  consumes `gd-hall` identities: `ritualAssetInventory` recognises only
  the Tree's paths, and stays so.
- Determinism: two renders in one process and in two processes give
  identical bytes, the licence metadata included (no timestamps; held by
  the golden test).
- URLs never carry a hash: an image keeps its URL as it improves, and
  search engines keep its history. Since the names are not
  content-addressed, the static files are served with `Cache-Control:
  public, max-age=0, must-revalidate` and an ETag from their SHA-256, set
  by the route handler and stored with the prerendered output: a browser
  revalidates every view rather than keeping a copy it cannot know is
  stale, and the CDN purges on deploy. (`next start` answers a matching
  `If-None-Match` with the whole file rather than a 304; whether
  Vercel's edge answers it is a follow-up.) `/api/render/gd-hall` sends
  a permanent redirect to the matching file (review of 26 October). The
  service worker caches images stale-while-revalidate, so a client that
  has seen an image is shown the old one once after it changes, and the
  new one from then on; acceptable for a drawing.

### 8. Licence in the files

Only for the `gd-hall` slug, after outlining, so no other slug's bytes
move. The page's JSON-LD (decision 10) is the authoritative licence
signal; the files carry the same facts for people and tools that see
only the file.

- **SVG**: a `<title>` (the H1) and a `<metadata>` block in RDF with
  Dublin Core and Creative Commons terms: title, creator ("Magick.ly"),
  rights ("© 2026 Magick.ly. Licensed under CC BY 4.0"), `cc:license`
  with the licence URL, `cc:attributionName` ("Magick.ly"),
  `cc:attributionURL` (the hall's page) and `dc:source` (the Regardie
  citation). The outliner's checks run before this step; the block holds
  no `href`, `url(`, text element or style. The site's ritual SVG
  validator is not asked to accept these files: they are not ritual
  assets.
- **PNG**: an XMP packet with the IPTC fields Google reads: Creator,
  Credit Line, Copyright Notice, Web Statement of Rights (the licence
  URL) and Licensor URL (`acquireLicensePage`). It is written as an
  uncompressed `iTXt` chunk with the keyword `XML:com.adobe.xmp`, as the
  XMP specification names for PNG, inserted before `IEND` after sharp's
  final encode by a small pure function (CRC from `zlib.crc32`), so
  nothing re-encodes after it and the bytes stay deterministic. sharp's
  own `withXmp` is not used: it writes `zTXt`, and any later re-encode
  drops it. The round-trip test walks the PNG's chunks and reads the
  packet back with `sharp().metadata()` (`exiftool` is not installed
  here). If a reader is found that ignores the `iTXt` chunk, the
  limitation is recorded and the JSON-LD still carries the licence.
- Digital Source Type is left out (follow-ups).
- Both are deterministic text built from the slug table, so the golden
  pins cover them.

### 9. Text, in our own words

- **No book text.** Every sentence on the pages is written for them or
  generated from the preset data. Sources are cited by work, page and
  leaf (plan 061, Sources), never quoted; the AGENTS.md rule on outside
  sources applies.
- **Generated** (`describeHall`, pure, in the MIT package beside the
  vocabulary it reads: `HALL_ROLES`, `BOARD_NAMES`, `CARD_TITLES`, the
  items' palette names): the officers present, each with a station in
  words ("on the dais", "West of the altar", "in the North-East",
  "beyond the East wall") from the floor frame and the hall's anchors;
  the altar's items; the other furniture. It returns structured parts,
  not prose, so the page, the alt text and later the reader's `<desc>`
  can each word them. A test pins an explicit expected table for each
  of the fourteen presets (every officer with its station, every altar
  item, every other object), written from the presets' doc comments,
  which already state the stations, so a change in the generator or a
  preset shows as a reviewed diff.
- **Authored**, per preset, in `src/seo/halls.ts`: the lead (one to
  three sentences: which ceremony and part, what distinguishes this hall
  from its neighbours, such as the trump on the altar or the tablet on
  the wall) and the conflict sentence where one applies. Drafted by the
  implementing agent from plan 061 and the preset comments, reviewed by
  Gadi on one sheet outside the repository, and committed on their own
  (stage 6). Halls the book arranges alike (Practicus 1 and 2,
  Philosophus 1 and 2) are told apart by what differs: the letter, the
  trump.
- **Alt text**, generated: the hall's short name, "floor plan, East at
  the top", the officers by name and the altar's items, at most 250
  characters (tested); the stations are in the page text, which the
  `<figure>` references with `aria-describedby`.
- **Meta description**, generated and at most 160 characters (tested,
  unique), for example: "Floor plan of the Golden Dawn Zelator
  temple, part 1 (1=10): the officers' stations, the altar and the
  Earth tablet, after Regardie (1938). CC BY 4.0." (150 characters)

### 10. Structured data

Each hall page carries one JSON-LD `@graph` through `JsonLd`:

- `BreadcrumbList`: Golden Dawn (`/gd`), Temple Halls (`/gd/hall`), the
  hall's short name: the app bar's trail.
- `ImageObject` (a `CreativeWork`): `contentUrl` the full PNG's absolute
  URL, exactly the `<img src>` resolved against `SITE_URL`; `url` the
  page; `name` the H1; `caption` the alt text; `width`, `height`,
  `encodingFormat`; `license`
  `https://creativecommons.org/licenses/by/4.0/`; `acquireLicensePage`
  `https://magick.ly/about#licence`; `creator`
  `{ "@type": "Organization", "name": "Magick.ly", "url":
  "https://magick.ly/" }`; `creditText` "Magick.ly, CC BY 4.0";
  `copyrightNotice` "© 2026 Magick.ly. Licensed under CC BY 4.0";
  `isBasedOn` the cited book pages as `Book` items (Israel Regardie,
  *The Golden Dawn*, vol. 2, Aries Press, 1938, the archive.org page
  URL); `associatedMedia` the SVG's `ImageObject`.
- A second `ImageObject` for the SVG: `contentUrl` exactly the "Download
  SVG" link's URL, `encodingFormat` `image/svg+xml`, and the same
  `license`, `acquireLicensePage`, `creator`, `creditText`,
  `copyrightNotice` and `isBasedOn`.

`/gd/hall`'s gallery uses thumbnails (other URLs, `noindex`), so it
carries no `ImageObject`.

### 11. Social images

The hall pages set `openGraph` (spreading `SITE_OPEN_GRAPH`) with two
images, as Gadi chose: the site's 1,200 × 630 card with the hall drawn
as its art, first, and the full PNG second. They set no `twitter`
object, so the layout's `card: "summary_large_image"` stays, and X
takes the first `og:image`.

The card needs per-page art and a size the contract accepts:

- `socialCard` takes an optional art override; the hall pages pass
  `{ kind: "diagram", slug: "gd-hall", query: "hall=<slug>", raster:
  "query" }`.
- `cardArt.drawArt` sets `fmt=png` and, unless the art says `raster:
  "query"`, `height=1020` as now. A hall card's query names no size, so
  the route returns the full 1,500 px PNG, which `drawArt` shrinks into
  the portrait art box (440 × 510) as it does every diagram. The other
  cards keep their query and their bytes.
- Considered: a height whitelist in the contract (adds a size only the
  cards use, and a URL that serves it), and drawing the card from the
  prerendered PNG file (the `/og` route cannot rely on another route's
  output existing during the build).

`/gd/hall`'s own card shows the Neophyte hall.

### 12. The `/gd/hall` gallery and the editor

- **Gallery**: a server-rendered section `id="halls"`, "Presets",
  grouped by grade (Neophyte … Portal), each hall a link to its page
  with its small PNG (`loading="lazy"`, `width` and `height` set) and
  its short name. No client code.
- **Placement**: below the editor, as Gadi chose, with a "Browse the
  presets" link to `#halls` in the opening paragraph. The loader's
  placeholder and the editor's container share one `min-height` (a CSS
  class both use: at least the viewport below the app bar), so the
  gallery starts below the fold and does not move when the editor
  mounts.
- **Opening a preset**: `/gd/hall#preset=<slug>` loads that preset as one
  step through the share link's path (`hashchange` too): the draft is
  kept until the hall changes, Undo goes back, the fragment is cleared,
  and an unknown slug says so and leaves the draft. A fragment never
  reaches the server or the index, unlike a query. The editor's preset
  picker stays as it is.
- **Exports from the editor** (Gadi's decision): the SVG carries a
  `<metadata>` block and the PNG an `iTXt` packet that credit the art
  only ("Hall art: Magick.ly, CC BY 4.0", the licence URL and the
  site), never a licence or rights statement for the hall as arranged,
  whether or not it is an unchanged preset. The export file name of an
  unchanged preset becomes the table's (`golden-dawn-zelator-1-temple`).
- **Description**: `/gd/hall` becomes "Golden Dawn Temple Halls: Floor
  Plans and Editor", described as, for example, "Golden Dawn temple
  floor plans for the Neophyte, Zelator, Theoricus, Practicus,
  Philosophus and Portal grades: open a preset, edit it, export SVG or
  PNG." (153 characters).
- **Speed**: the gallery is server HTML and lazy images; the editor's
  chunks change only for `#preset` and the export attribution (budgets
  below).

### 13. Sitemap, robots and canonicals

- `src/seo/halls.ts` exports `hallPages()` (`EntityPage`s); the sitemap
  lists them after the entity pages, each with
  `images: [<absolute full PNG URL>, <absolute SVG URL>]`, the PNG
  first. `/gd/hall` keeps a bare entry.
  `sitemap.test.ts` changes from "every entry has only `url`" to "only
  `url`, and `images` on hall pages, each an absolute `https://magick.ly`
  URL without `&`, `<` or `"`", and the XML Next writes is parsed in a
  test so an unescaped character fails.
- Canonicals: each hall page's is its own path; `/gd/hall`'s stays
  `/gd/hall`, so query variants fold into it. Nothing links `#hall=`
  from server HTML, and fragments are not indexed; the hall pages link
  `#preset=`, which is equally invisible to the index.
- `robots.ts` is unchanged (decision 3).
- `socialCards()` adds the hall pages, so their cards are drawn at build
  time.
- No `hreflang`: the site has one language.

### 14. Licence presentation

- **Credit line** under each image: "Floor plan © 2026 Magick.ly, CC BY
  4.0. Free to reuse with credit." with the licence linked.
- **Licence section** (`#licence`): a CC licence sits on top of
  copyright, which Magick.ly keeps; CC BY 4.0 lets anyone use, change
  and sell the image with credit. A ready-to-copy credit in the TASL
  form Wikimedia Commons teaches (Title, Author, Source, Licence):
  "Golden Dawn Zelator Temple, part 1 (1=10): floor plan, by Magick.ly,
  https://magick.ly/gd/hall/zelator-1, CC BY 4.0". The hall's layout is
  a fact taken from the cited sources, which are not reproduced; the
  presets' data and the drawing code are MIT (linked to
  `src/components`).
- **`/about`**: the licence paragraph's list of drawn images adds the
  temple halls and links `/gd/hall`; it keeps its code copyright line;
  its credits are unchanged, since the hall art has no third-party parts
  (plan 061, stage H) and the old drawings' credits leave with stage I.
  The Enochian Plain font is not credited as art (Gadi: fine as it is);
  its licence stays a follow-up.
- **Downloads** from the hall pages are the static files of decision 8;
  editor exports carry the art's attribution (decision 12).

### 15. Internal links

- `/gd`: the "Temple Halls" tile shows the Neophyte thumbnail instead of
  the word "Halls".
- `/gd/grade/<id>`: grades with halls (0=0 to 4=7, Portal) gain a
  "Temple halls" list linking each hall page with its thumbnail; the
  test holds every table row's grade id to an existing `gdGrade` row.
- `/gd/grades` is unchanged: its rows already link the grade pages.
- `/help/ritual-pug`, which links the editor, links the gallery too.
- Later, plan 061's stage I: each built-in ritual's hall links its page
  (recorded there).

### 16. Not in scope

Halls from users by URL; an `ImageGallery` or `ItemList` markup for
`/gd/hall`; precaching the hall pages or images in the service worker
(14 PNGs would add megabytes to every install; the editor's offline use
is unchanged); the Tablet of Union on the image route; dark images;
translations.

## Spike and stages 1–7 (26 October 2026)

Built on `gate/hall-seo` after Gadi's answers, each commit gated in a
clean export (statuses in `~/.cache/hall-seo/gates/`). Stage 6's leads
wait for Gadi's review (`~/.cache/hall-seo/leads-sheet.png` and `.md`),
and the pages (stage 8) wait for it.

### What the spike found

Run on all fourteen presets, nothing committed; outputs in
`~/.cache/hall-seo/spike/`:

- **Paint servers (decision 5, option (a)).** resvg's output holds only
  `url(#id)` references, 6 to 18 a hall, every one resolving to a
  `pattern`, `linearGradient`, `radialGradient` or `clipPath` in the
  `<defs>`, resvg's own `clipPath1` … among them; no other reference
  kind and no text, style or image.
- **The integer viewBox** comes back from resvg unchanged.
- **Fonts.** The quoted stack does not resolve even with the TrueType
  twins loaded: the output was byte-identical to having no Noto Serif
  at all. The bare family names do resolve to the twins. So the stacks
  are rewritten in the rendered markup (a registration `source` hook),
  not passed as a `GdHallSvg` prop: the art modules write the stacks
  themselves, and a prop would have touched every one of them.
- **Sizes.** Outlined SVGs were 154 KB to 1.18 MB (the Portal's labels
  and Enochian letters), mostly digits at full float precision; numbers
  rounded to hundredths of a unit and no indentation bring them to 116
  to 854 KB (37 to 240 KB gzipped). Palette quantisation cuts the PNGs
  by about 60 % with no visible change at 1:1 (a crop compared side by
  side). Practicus 1 and 2, and Philosophus 1 and 2, outline to
  different bytes once the label fonts are there.
- **sharp** rasterises a hall within its pixel limit once the root has
  the PNG's `width` and `height`.

### What was built, and how it departs from the plan

The commits are listed in "Commits", at the end of the plan.

| Stage | Change |
| --- | --- |
| 1 | `GdHallSvg` without hooks (an `idPrefix`, memoised drawings when the caller has them, image mode); `GdHall` draws through it unchanged |
| 2 | `viewBoxOf` and `contractViewBox` |
| 3 | the outliner's `paintServers` option; the Tree's default and two rose sigils pinned beside the existing pins first |
| 4 | the `gd-hall` contract and registration, the TrueType twins, the licence in the files, golden pins |
| 5 | `describeHall` and `src/seo/halls.ts` |
| 6 | the fourteen leads, approved by Gadi with one change (below) |
| 7 | `#preset=<slug>` and the exports' file names |

- **The slug table** lives in the image contract
  (`src/render/contracts/gdHall.ts`) with the titles' parts and file
  names, since the contract needs it and client code imports it;
  `src/seo/halls.ts` builds on it. It is still the one place a slug is
  written.
- **The registration** gained five hooks rather than one: the font
  rewrite, the paint servers, the compaction, palette PNGs and the
  licence. Paint-server ids are renumbered `gdhall-0` … in the order
  the defs hold them.
- **The PNG licence** is an uncompressed `iTXt` XMP packet, as planned.
  libvips (sharp) reads XMP only from `zTXt`, so the test walks the
  chunks and checks every CRC; ImageMagick reads the packet and its
  IPTC fields (checked by hand).
- **Data inputs.** The Zelator's second hall draws the Table of
  Shewbread and the candlestick, so the halls' inputs include theirs;
  the mutation test caught it. The whole-data sweep
  (`RENDER_INPUT_SWEEP=1`) passes with every hall in it (422 s), after
  the trumps' table stopped failing to load for a path naming no
  letter.
- **Measured** (one process, warm): outlining a hall 15 to 93 ms; the
  full PNG 218 to 390 ms, the medium 88 to 211 ms, the small 46 to
  151 ms. Sizes: full PNGs 74 to 137 KB, medium 31 to 56 KB, small 14
  to 23 KB. The budgets above (500, 150 and 40 KB; SVGs 300 KB gzipped)
  hold.
- **Editor exports crediting the art** (decision 12) are not in stage
  7: they change the shared `ExportControls`, so they get a commit of
  their own before the pages.
- **Browser.** `/gd/hall#preset=portal-2` in headless Chromium against
  a Turbopack dev server on 127.0.0.1: the Portal 2 preset opened with
  its note, the drawing matching the server's image.

## Stages 7 to 11 and the checks (26 October 2026)

Gadi approved the fourteen leads with one change: no mention of the
drawings some presets were ported from, which readers have never seen.
The three source sentences that named them were reworded in their own
terms (the Banner of the West "as the 1938 diagram draws it"; Zelator
2's North wall following the first part's diagram, its own diagram
still to be located) and folded into the leads' commit; a test keeps
"older" and "our drawing" out. He also confirmed: no `next/image`.

| Stage | Change |
| --- | --- |
| 7 (rest) | `ExportControls` takes a `credit`; the hall editor's SVG and PNG exports credit the art only |
| 8 | the hall pages, their image files, JSON-LD, cards and metadata |
| 9 | the presets below the editor, the editor's band at least a screen tall, the new title and description |
| 10 | the sitemap's image entries |
| 11 | links from `/gd`, the grade pages, the Ritual Pug guide and `/about` |

How the build departs from the decisions above:

- **Editor exports.** `pngText.ts` writes the `iTXt` chunk with its
  own CRC-32, shared by the browser and the server (the pinned hall
  images kept their bytes). The editor's credit is a `dc:description`
  in the SVG and a `dc:description` and `photoshop:Credit` in the PNG,
  stating no licence or rights for the file.
- **The pages' sources** list the book pages only. The `public/pics`
  drawings stay in the presets' `sources` and in the editor's list
  until plan 061's stage I.
- **The trail** is the app bar's: below the Temple Halls section it
  shows the site's name with the trail in its menu, and the page names
  itself in its own `h1`, as on the Sephirah and angel pages.
- **Grade pages** link their halls in a "Temple halls" row, by name,
  without thumbnails.
- **Prefetching.** A hall page's server payload carries a preload of
  its full image (its `fetchPriority="high"`), so prefetching a link to
  it downloads that image. The gallery and the grade rows therefore
  link without prefetch (the gallery would otherwise fetch fourteen
  full PNGs as it scrolls in); the neighbours at a hall page's foot
  keep it, so the next hall opens at once, at the cost of two images
  once the reader reaches the foot.
- **The gallery's links** are Next's own rather than the site's MUI
  `Link`, which added about a kilobyte (gzipped) to `/gd/hall`'s chunk.
- **The static files' headers.** Without headers of its own the route
  was served with `s-maxage=31536000` alone, which browsers cannot
  revalidate; the final review's fixes set them (decision 7).

The checks, against a production build (webpack) served by `next
start` on 127.0.0.1, screenshots and the report in
`~/.cache/hall-seo/shots/`:

- **Gates**: each commit, one at a time, `install --frozen-lockfile`,
  `check`, `typecheck`, `test:coverage` and `build`; `loom check`, the
  magick-data smoke test and `check:turbopack` ran at the tip only.
  Rewritten commits were gated again. One run of the stage 9 gate
  failed `TrainingUpload.test.tsx` (a FilePond timing test) while two
  builds ran beside it; that commit was rewritten and gated again.
- **Build**: 476 static pages, the fourteen hall pages and their 56
  files among them; the prerendered PNG of Zelator 1 has the pinned
  bytes.
- **HTTP**: each file kind served with its type; `X-Robots-Tag:
  noindex` on the medium and small PNGs and the API copy, none on the
  full PNG and the SVG; the PNGs carry the `iTXt` packet and the SVG
  its RDF; an unknown slug or file is a 404.
- **Sitemap**: 196 URLs, 28 image entries, the image namespace
  declared, no `&` in an image URL; a test parses the XML.
- **Structured data, offline**: for the Neophyte, Zelator 1 and Portal
  2 pages, every type and property checked against schema.org's
  (`BreadcrumbList`, `ListItem`, `ImageObject`, `Organization`,
  `Person`, `Book`) and Google's image licence fields (`contentUrl`,
  `license`, `acquireLicensePage`, `creator`, `creditText`,
  `copyrightNotice`), the PNG's `contentUrl` the `<img src>` and the
  SVG's the download link: no problems. The canonical and the two
  `og:image`s, card first, are in the HTML; Next derives the
  `twitter:image`s from them. Google's Rich Results Test and the live
  Search Console checks remain for after the release (follow-ups).
- **Browser** (headless Chromium, 1,440 × 900 and 390 × 844 at 2×):
  Zelator 1 and Portal 2's pages, `/gd/hall`, `/gd/hall#preset=
  philosophus-4`, `/gd` and the Portal's grade page: one `h1`, no
  horizontal scroll, no console error, layout shift 0 throughout; the
  hall image loads, the full PNG on the desktop at 2× and the medium on
  the phone (a 1× desktop picks the 750 w candidate, right for its
  568 px slot; the full PNG from about 1.33×); the preset link opens Philosophus 4 with its note; the gallery
  starts below the screen (at 1,360 and 2,138 px) and loads only small
  PNGs; the card draws the hall. Firefox, Safari and real devices were
  not checked.
- **Bundles** (gzip -6, against `main` a633e95, both built here):
  `/gd/hall`'s page chunk 10,070 → 10,243 bytes (3,793 → 3,861); the
  editor's chunk 40,423 → 41,791 (14,937 → 15,552, the `#preset` link
  and the credit); `/gd/hall`'s HTML 9,282 → 10,919 gzipped; a hall
  page's chunk 4,246 bytes (1,876), as a grade page's (3,988, 1,768),
  and its HTML 11.7 to 12.1 KB gzipped; all JavaScript chunks
  8,018,894 → 8,029,295.
- **Documentation screenshots**: none shows a changed screen; none
  recaptured.

## The final reviews' fixes (26 October 2026)

Two final reviews of the branch (Opus and Fable; evidence in
`~/.cache/review-seo-opus/` and `~/.cache/review-seo-fable/`) found it
mergeable once the first three points below were settled. Every point
was folded into the commit it belongs to, and every rewritten commit
gated again:

- **Caching** (stage 8): the files' `Cache-Control` and ETag, as
  decision 7 now says.
- **The PNG's XMP** (stages 4 and 7): the `iTXt` chunk goes right after
  `IHDR`, ahead of the image data, where readers that stop at the data
  find it; `pngText.ts` and the hall images share the code.
- **Compaction** (stage 4): rounding numbers distorted the art (the
  tablets moved about a pixel; Zelator 2 and Portal 2 differed
  visibly). Rounding path data even to a thousandth still moved
  antialiased pixels by up to 19 levels, the glyphs being drawn through
  scaling transforms, so nothing is rounded: the compaction only drops
  resvg's indentation between tags and around path commands, and a
  test holds the compacted raster to the uncompacted one within one
  level (it is identical). The SVGs are 133 KB to 1.02 MB, at most
  289 KB gzipped.
- **The figure's description** (stage 8): `aria-describedby` names the
  section holding the stations' heading and table.
- **Size budgets** (stage 4): a test holds every hall's PNGs to 500,
  150 and 40 KB and its SVG to 300 KB gzipped.
- **A trump's letter** (stage 4): read when the trump is drawn; a path
  naming no letter row fails that drawing with a clear error, which the
  render sweep catches, instead of drawing nothing.
- **`/api/render/gd-hall`** (stage 8): a permanent redirect (308,
  relative `Location`) to the matching static file; a wrong query is
  still a 400.
- **The outliner** (stage 3): every `url(` must be a whole `url(#id)`
  that was validated, so an unclosed one fails closed; tests cover
  filters, masks, images (in a pattern too), scripts, foreignObjects,
  dangling references and malformed forms.
- **One licence constant** (stages 4, 7, 8): `GD_HALL_LICENCE` in the
  image contract, used by the files, the pages' JSON-LD and the
  editor's credit, which takes its host from `SITE_URL`.
- **Polish**: each JSON-LD `Book` is named "The Golden Dawn, vol. 2",
  with author, publisher and year from the cited work and the page and
  leaf in its description; the SVG's and XMP's source is the full
  citation; an unknown preset link says "preset link"; the gallery's
  links carry their grade for screen readers; mid-sentence trumps read
  "the Tower (XVI)"; Theoricus 2 says "the kamea of the Moon"
  throughout; the Neophyte's description names its altar's cross and
  triangle; an empty altar is listed as furniture rather than "nothing";
  the `/gd` tile uses the small PNG; the editor's exported SVG keeps
  its title first.

**Pins that moved** (stage 4, deliberately, once): for all fourteen
halls the SVG digest and the three PNG digests, because the compaction
no longer rounds numbers, the PNG's XMP moved before the image data,
and the files' source citation names the book. The source digests
(the SVG before outlining) did not move, which shows the drawings
themselves are unchanged. No other slug's pins moved.

## Commits

| Commit | Change |
| --- | --- |
| d8811fb | The plan, Gadi's answers folded in |
| 89fa92d | Halls drawn without hooks: `GdHallSvg` |
| 87aba04 | A viewBox per request: `viewBoxOf` |
| 249f357 | The outliner keeps the halls' paint servers |
| a5956e0 | The `gd-hall` image: contract, registration, fonts, licence metadata, pins |
| c684e5d | The halls' names and generated words for search |
| 1a0a73f | The fourteen leads |
| 834687c | `#preset=<slug>` and the exports' file names |
| 289bd25 | The spike's record |
| dbac425 | The editor's exports credit the art |
| 349ba03 | A page per hall, its files, JSON-LD and cards |
| a0a4098 | The presets below the editor |
| 77a0253 | The sitemap's image entries |
| 72bce4b | Links from `/gd`, the grade pages, the guide and `/about` |

## Questions answered

All of the plan's questions were answered by Gadi on 26 October 2026
and are folded in above: Enochian Plain, the social image, the credit,
editor exports, Digital Source Type, the leads and the gallery's place
first; then the outliner (option (a)), the SVG (indexable, with its own
`ImageObject` and sitemap entry) and phones (the 750 px medium PNG in
the `srcset`; `contentUrl`, the sitemap and the download stay the full
PNG).

**Why not `next/image`** (Gadi asked):

- Its optimiser serves `/_next/image?url=…&w=…`, URLs with query
  strings rather than our stable named files, so the image Google sees
  is not the canonical, licensed file.
- It strips embedded metadata, our XMP licence included.
- It does not optimise SVG.
- On Vercel it counts against image-optimisation usage.
- With fourteen fixed images, three static sizes give the same `srcset`
  benefit with stable URLs and the licence metadata intact. If WebP or
  AVIF variants are wanted later, they are generated statically the
  same way.

## Stages

Each stage is one or a few gated commits on `gate/hall-seo`, each
building and passing on its own; Opus subagents implement, fresh Opus
High reviews per stage, and Fable High reviews the whole before merge
(the model policy).

| Stage | Commit (subject) | Content |
| --- | --- | --- |
| 0 | — (spike, nothing committed) | In a scratch worktree, first: option (a) of decision 5 on all fourteen presets, every reference and element kind resvg emits listed. Then: `GdHallSvg` through the route in the server condition; the integer viewBox through resvg; the TTF twins under bare names, label widths against Chromium, and Practicus 1 and 2 and Philosophus 1 and 2 outlining to different bytes with their letters and trumps; the three PNG sizes and the SVG for all fourteen, sizes measured, with and without palette quantisation; determinism across processes; the `iTXt` packet read back by a chunk walk and `sharp().metadata()`; the `next.config` headers on `next start`; a sheet of the fourteen PNGs beside the editor's exports for Gadi |
| 1 | `refactor(gd): Draw halls without hooks` | `GdHallSvg`, `idPrefix`, stacks prop, image mode with the integer viewBox; snapshots unchanged; the server-condition test |
| 2 | `feat(render): Size component images per request` | `viewBoxOf`; every existing golden pin unchanged |
| 3 | `feat(render): Keep paint servers in hall images` | decision 5 as Gadi confirms it; the other slugs' pins unchanged |
| 4 | `feat(render): Render temple halls as images` | the font twins and their pins; `hallImageArt`; the `gd-hall` contract, registration, `inputs`, `indexed: false`; licence metadata (`<metadata>`, `iTXt`); golden pins per hall and size |
| 5 | `feat(seo): Name the hall presets for search` | `src/seo/halls.ts`: the slug table, titles, file names, grade ids; `describeHall` (package) with its pinned tables; alt text and descriptions; tests |
| 6 | `docs(gd): Describe each temple hall` | the fourteen authored leads and conflict sentences, after Gadi's review of the sheet |
| 7 | `feat(gd): Open a preset from a link` | `#preset=` in `HallPlayground`; the art attribution in editor exports; export file names |
| 8 | `feat(gd): Give each temple hall its own page` | `[slug]/page.tsx`, `[slug]/[file]/route.ts`, `next.config` headers, JSON-LD, metadata and cards (`raster: "query"`), `pathnames.ts` section, route classification |
| 9 | `feat(gd): Show the hall presets on /gd/hall` | gallery, the shared `min-height`, new title and description |
| 10 | `feat(seo): List hall images in the sitemap` | `images`, the sitemap tests and XML parse |
| 11 | `feat(gd): Link the grades to their halls` | `/gd` tile, grade pages, `/help/ritual-pug`, `/about` licence paragraph |
| 12 | `docs(plan): Record the hall search pages` | this plan's results, plan 000 and plan 061 |

The `#preset=` link (stage 7) lands before the pages that link it.
Stages 1–4 are what the pages stand on and go back only with them;
stages 7 and 9–11 can each be reverted alone.

## Verification

- **Unit tests**: the slug table (decision 1); the contract round trip
  and refusals (`width`, `height`, unknown halls and sizes, a `size` on
  SVG); every preset renders through the registry in the server
  condition; the viewBox table against image mode; the two art
  registries give one layout; golden pins; the outliner's option
  (references kept, prefixed and resolved, everything else still
  refused, the other slugs' bytes unchanged); `describeHall` against its
  pinned tables; alt text and description lengths and uniqueness; the
  page's metadata (canonical, `og:url`, the two `og:image` entries in
  order, no `twitter` object, title); the JSON-LD (parses, no
  `</script`, the PNG's `contentUrl` equal to the `<img src>` and
  the SVG's to the download link, `license`,
  `creator`, `creditText` and `copyrightNotice` exact,
  `BreadcrumbList` matching the app bar's trail); the `iTXt` packet; the
  `noindex` headers; the sitemap entries and XML; route classification;
  the `#preset=` flow (jsdom, as the share link's).
- **Rich results**: the rendered HTML of two hall pages (Neophyte and
  Portal 2) pasted into Google's Rich Results Test (code mode) and
  validator.schema.org, which accept code without a public URL; their
  findings recorded here. After deploying, the live URL in the Rich
  Results Test and the sitemap resubmitted in Search Console
  (follow-up).
- **Built output**: in `next build` (webpack), the fourteen pages and 56
  image files are prerendered (`.next/server/app`), no hall route
  renders at runtime, and `next start` serves the image files with the
  expected type and headers (`noindex` on the medium and small PNGs);
  an
  unknown slug and an unknown file are 404s that add no cache entry (as
  plan 028's review checked).
- **Browser** (headless Chromium over CDP on 127.0.0.1 and a fresh
  port, per the stale service worker note): each hall page at 1,440 ×
  900 and 390 × 844, no horizontal scroll, one `h1`, the image sharp and
  its alt text present, the phone fetching the medium file, the links
  working, "Open in the editor" loading the right preset with Undo back
  to the draft; `/gd/hall`'s editor loading as before, the gallery
  below it, layout shift on load 0; no console errors or hydration
  warnings. Firefox, Safari and real devices are not available here and
  are stated as unchecked.
- **Budgets**, from the gates' production builds (gzip -6), against
  `main`: the hall page has no page-specific client chunk and the
  shared chunks are unchanged; a hall page's HTML at most 40 KB
  gzipped; each full PNG at most 500 KB, each medium at most 150 KB and
  each small at most 40 KB, each SVG at most 300 KB (the review measured
  26–162 KB outlined without label fonts; the spike sets the final
  numbers, recorded here, and a test holds them); `/gd/hall`'s own chunk
  and the editor's chunks grow by at most 1 KB gzipped and its HTML by
  at most 8 KB gzipped; the build's time, measured before and after,
  recorded.
- **Documentation screenshots**: no shot in `scripts/docs-screenshots`
  shows `/gd/hall`, a hall page or a hall (they show temples, the ritual
  list and form, the editor and the reader), and this work changes none
  of those screens, so none is recaptured; each stage's review confirms
  that still holds.
- **Gates**, per commit, in a clean export on `/home` (not `/tmp`) with
  Node 24 and the CI placeholder environment: `pnpm install
  --frozen-lockfile`, `loom check`, `pnpm check`, `pnpm typecheck`,
  `pnpm test:coverage` and `pnpm build`; `pnpm check:turbopack` and the
  magick-data smoke test for stages 4 and 8 and the plan's commit. The
  compiler identity files (`semantic.ts`, `semanticCompilerImpl.ts`,
  `ritualNodeIds.ts`) must show no diff, and `src/components` must
  import no app code.

## Risks

- **Duplicate content.** The editor page renders no hall on the server,
  and the gallery has thumbnails and short names only, so the hall pages
  do not duplicate `/gd/hall`. Halls the book arranges alike could read
  as near-duplicates; the authored leads and the generated lists name
  what differs, and the images differ. Each hall has two indexable
  files, the PNG and the SVG, which search engines group as one
  drawing; the other sizes and the API copies are `noindex`.
- **Slug permanence.** The table is the contract and its test says so;
  renaming a preset id cannot move a slug; a withdrawn hall redirects.
  The titles and descriptions may change freely.
- **Image bytes.** Plan 061 still has art to decide (the Chiefs on the
  new daises, Eden, the Fall, the markers), so the images will change at
  the same URLs. The golden pins make each change explicit, search
  engines re-crawl, and revalidating headers keep browsers current;
  the service worker shows a changed image stale once per client. A
  regression in the shared outliner would move every hall image at
  once; the pins catch it.
- **The outliner.** Admitting paint servers (decision 5) loosens a
  check that guards the closed renderer; it is scoped to one
  registration, resolves every reference, and the other slugs' bytes
  are pinned.
- **The renderer.** resvg's font matching and text outlining are the
  likely failures (plan 061 met one, the review another); the spike
  runs before any commit. If resvg cannot draw the halls' labels
  faithfully, the work stops and goes back to Gadi with the options
  (for example, images drawn in headless Chromium at build time).
- **The editor's chunk.** Splitting `GdHall` touches code the reader and
  editor load; the snapshots and hydration test hold its output, and the
  bundle budget holds its size. The gallery adds no client code.
- **Build time and size.** Seventy-one renders at build (56 files, 14
  hall cards and `/gd/hall`'s); the route is fully prerendered, but its
  function trace still carries the fonts, as plan 028 notes for `/og`;
  the spike measures both.
- **Licences.** The Enochian glyphs are the one part of a drawing that
  is not ours; Gadi accepts them, and their licence is a follow-up.
  Nothing from the copyrighted editions enters the repository.

## Follow-ups

Recorded in [plan 061](061-gd-hall.md#follow-ups) and
[current status](000-current-status.md):

- **"+ Image" in the hall editor** (Gadi, 26 October 2026: should a hall
  allow images?). Saved for later; Gadi wants the current work finished
  first. The ritual renderer may already draw images in rituals, but
  offline bundles and rights need thought. Options to weigh, not
  decided: users upload images and assert their rights; for private
  temples rights may not matter; or an uploader consents to (donates
  under) CC BY 4.0, against keeping copyright for internal use.
- **Enochian Plain's licence** (Gadi: fine to publish the halls with
  it): no licence text is known; the published CC BY images draw its
  glyphs. Revisit if its terms are found, or when our own Enochian
  letterforms exist.
- **IPTC Digital Source Type**, left out: the value is ambiguous for
  these images (vector art computed by code that AI agents wrote under
  Gadi's direction, not the output of a trained image generator).
  Revisit if a platform asks for it, or if Gadi wants to disclose the
  AI involvement.
- After the release: the hall pages' live URLs in the Rich Results Test,
  the sitemap resubmitted in Search Console, and Search Console's image
  reports watched for the licence badge.
- After the release, also: whether Vercel's edge answers a hall
  file's `If-None-Match` with a 304 (`next start` sends the whole file),
  and whether the neighbours' prefetched images at a hall page's foot
  are worth their bytes on phones.
- Stage I of plan 061: link each built-in ritual's hall to its page,
  and decide whether the editor's source list keeps citing the
  `public/pics` drawings (the hall pages no longer do).
- The reader's hall could take a `<desc>` from `describeHall`.

## Amendment: the halls under `/gd/halls` (28 October 2026)

Status: built on `gate/halls-i` (from `main` at ec6f765) on 28 October
2026, every commit gated; see A11. Gadi chose option A of the UX mock-ups on 28 October 2026
(`~/.cache/halls-ux/`: sheets `A1-index.png`, `A2-hall.png` and
`A3-editor.png`, the mock pages in `mock/`, and the README's URL and
redirect plan). Today `/gd/hall` puts a full-screen editor in front of
the gallery: people who came to look scroll past, and download, a code
editor, and the hub search engines see is a page of two paragraphs and a
loader. Option A gives each job its own URL. It supersedes the "URLs"
decision and decisions 2, 12 and 13 wherever they name `/gd/hall`;
everything else in this plan stands (the slugs, files, licence,
JSON-LD, cards and sitemap images), at the new paths. Nothing has been
pushed, so the old URLs were never public; the redirects are for
bookmarks and copied links.

Gadi's decisions of 28 October 2026:

- **Option A**: a server-rendered index, hall pages with a rail, and the
  editor on a route of its own.
- **Group headings** are the grade names with their numbers ("Practicus
  3=8"). No "Outer Order" label: it would cover twelve of the fourteen
  halls and tell them apart from nothing.
- **On a phone** the lede sits below the plan; on the desktop it is
  beside it. Fine.

### A1. URLs

| URL | What | Rendering |
| --- | --- | --- |
| `/gd/halls` | The index, the hub: a short intro, "Open the editor", the fourteen halls grouped by grade | Server, static; no client code of its own |
| `/gd/halls/<slug>` | A hall's page (decision 2), with a rail of every hall on the desktop and a "Jump to hall" select on a phone | Server, static (`dynamicParams = false`); the select is the only client code |
| `/gd/halls/<slug>/<file>` | The four image files (decision 3), unchanged but for the path | Prerendered route handler |
| `/gd/halls/editor` | The editor, with its preset dropdown, a "Browse halls" link and no gallery | As `/gd/hall` today |

Permanent redirects (308) in `next.config.ts`'s `redirects()`:

| Old | New |
| --- | --- |
| `/gd/hall` | `/gd/halls/editor` |
| `/gd/hall/:slug` | `/gd/halls/:slug` |
| `/gd/hall/:slug/:file` | `/gd/halls/:slug/:file` |

- **Fragments survive.** A `Location` without a fragment inherits the
  request's (RFC 9110 §10.2.2), so `/gd/hall#hall=1.…` lands on
  `/gd/halls/editor#hall=1.…` and `/gd/hall#preset=portal-2` on
  `/gd/halls/editor#preset=portal-2`, which the editor reads as it does
  today. Checked in Chromium and Firefox (both installed here); no Safari
  device, so WebKit ships on the same RFC rule, stated as unchecked.
- **Share links** come out right without a change: the editor builds
  them from `window.location.pathname` (`HallPlayground.tsx`).
- **Drafts** survive: the `localStorage` key
  (`magickli:gd-hall-draft:v1`) is per origin, not per path.
- **Queries** pass through a Next redirect, so `/gd/hall?x=1` keeps its
  query; nothing reads one.
- **`#halls`** (the gallery's anchor) needs no redirect: it was never
  public, and its two internal links (`/about`, `/help/ritual-pug`) move
  to `/gd/halls`.

### A2. "editor" is a reserved slug

`src/app/gd/halls/editor/page.tsx` is a static segment beside
`[slug]`, and Next matches static segments first, so a hall slugged
`editor` could never be reached. `GD_HALL_RESERVED_SLUGS = ["editor"]`
goes beside `GD_HALLS` in `src/render/contracts/gdHall.ts`, with the
rule in its doc comment, and a contract test fails if a slug is
reserved. The existing test that no slug names a static child of the
route directory (`src/seo/halls.test.ts`) reads `src/app/gd/halls` and
now also requires every static child to be listed in the reserved set,
so a later `/gd/halls/<name>` page cannot be added without reserving
its name. It counts only folders that are routes: it skips dynamic
segments (`[…]`), private folders (`_*`, which covers the presets'
`__snapshots__`), route groups (`(…)`) and parallel slots (`@*`), so
the snapshots stay where they are. `[slug]` keeps `dynamicParams = false`: an unknown slug,
`/gd/halls/editor/<anything>` among them, is a 404 that renders
nothing.

### A3. The index (`/gd/halls`, sheet A1)

- **H1** "Golden Dawn temple halls"; one intro paragraph in our words
  (the fourteen halls of the Outer Order's grades and the Portal, drawn
  from the 1938 layouts with our own art; each page shows where every
  officer stands, with its sources and the plan to download under CC BY
  4.0); an outlined "Open the editor" link (`/gd/halls/editor`) with
  one line on what it does; and a note under the grid that East is at
  the top of every plan and North on the left.
- **Cards**, grouped by grade in the presets' order: a heading per
  grade, the name bold and the number light ("Practicus 3=8"); each
  group's cards in a row, the groups flowing in one wrapping grid with
  small gaps, so all fourteen sit above the fold at 1,440 × 900. A card
  is the small PNG (the existing 360 px file) shown 120 CSS px wide on
  the desktop and 82 px on a phone, with its label under it: "The hall"
  for the Neophyte, otherwise "Part N · <path or place>" ("Part 1 ·
  31st path", "Part 2 · In Yesod", "Part 1" for the Zelator and
  Portal), stacked on two lines on a phone. Screen readers hear the
  grade too, as the gallery does now. The labels come from one function
  beside the slug table, which the rail and the select share.
- **Code**: today's `HallGallery` becomes the index's grid
  (`HallIndex`), still Next's own `Link` with `prefetch={false}` (a hall
  page preloads its full image), images `loading="lazy"` with `width`
  and `height` set. No client component.
- **Metadata** (`src/seo/pages.ts`): "Golden Dawn Temple Halls: Floor
  Plans", described as "Floor plans of the fourteen Golden Dawn temple
  halls, Neophyte to Portal: officers' stations, sources, and PNG and
  SVG downloads under CC BY 4.0." (145 characters, measured; the cap in
  `src/seo/pages.test.ts` is 160). Its card draws the Neophyte
  hall (today's `/gd/hall` card). It is a public page, in the sitemap
  as a bare entry, and its canonical is itself.
- **The app bar**: `pathnames.ts` makes `gd.halls` the section
  `{ "/": "Temple Halls", editor: "Hall Editor" }`, so the index is
  "Temple Halls", a hall page shows the trail, and the editor "Hall
  Editor".

### A4. A hall's page (`/gd/halls/<slug>`, sheet A2)

- **Content** as decision 2 built it: trail, H1, lede, the figure with
  its credit line, the actions, the stations table, sources, licence,
  previous and next. The trail and "All temple halls" go to
  `/gd/halls`; "Open in the editor" to `/gd/halls/editor#preset=<slug>`.
- **Layout.** The page leaves `EntityFrame`'s 600 px column for a frame
  of its own (still the entity parts: `Trail`, `Lede`, `EntityTable`,
  `Row`, `PrevNext`), in a CSS grid:
  - **From 1,200 px**: three columns, the rail (200 px), the plan
    (at most 480 px) and the text (the H1, the lede, the actions,
    previous and next, the stations), with the sources and the licence
    under the text column.
  - **From 900 to 1,199 px**: the rail and one column (the plan, then
    the text).
  - **Below 900 px**: no rail; the "Jump to hall" select under the
    trail, then the H1, the plan with its credit, previous and next, the
    actions, the lede and the rest (Gadi: fine).
  The DOM order is the trail and the select, the H1, the plan with its
  credit, then the words in the desktop's order (lede, actions,
  previous and next, the rest), with the rail's `<nav>` last, so a
  screen reader meets the hall before fourteen links; the grid places
  the rail on the left. On the desktop the tab order therefore differs
  from the visual order: Tab reaches the rail after the page's text,
  though it stands first on the left. On a phone, CSS `order` moves
  previous and next and the actions above the lede, so there too the
  visual order differs from the DOM's (corrected after the review of
  28 October 2026; a follow-up in plan 000). The figure's `sizes` follows the columns, so the
  phone still fetches the medium PNG and the desktop at 1× the medium
  or full by width.
- **The rail** (desktop): a server-rendered `<nav aria-label="All
  temple halls">` headed by an "All temple halls" link, the grade groups
  and their cards at 56 px, the current hall outlined and marked
  `aria-current="page"`. It is sticky below the app bar and scrolls
  within itself if the window is shorter than the rail. Links have
  `prefetch={false}`. Its thumbnails are the small PNGs (14 to 23 KB
  each, about 250 KB for all fourteen), `loading="lazy"`; on a phone
  the rail is `display: none`, and only a screen 900 px or wider
  fetches them (see A11: a hidden lazy image is fetched all the same,
  so each is a `<picture>` source for that width).
- **"Jump to hall"** (phone): a native `<select>` with an `<optgroup>`
  per grade and the shared labels, the current hall selected, in a small
  client component (`HallJump`) that calls `router.push` on change.
  Without JavaScript it does nothing, and the trail, previous and next
  remain. It is the one piece of client code on a hall page: decision 2
  said "no page-specific client code", which this relaxes, with the
  budget below.
- **JSON-LD**: the `BreadcrumbList`'s second item is Temple Halls at
  `/gd/halls`; the `ImageObject`s are unchanged but for their URLs.

### A5. The editor (`/gd/halls/editor`, sheet A3)

- Today's editor unchanged, moved: the preset dropdown, undo, the
  layout switch, the panels, the draft, `#hall=` and `#preset=`.
- The intro's link becomes "Browse the halls" (`/gd/halls`), and a
  "Browse halls" button stands beside the preset dropdown.
- No gallery below it, and no `min-height: calc(100vh - 64px)` spacer,
  which existed only to keep the gallery below the fold.
- Metadata: "Golden Dawn Temple Hall Editor", described as "Edit a
  Golden Dawn temple floor plan in the browser: start from any of
  fourteen halls, arrange officers and furniture, export SVG or PNG,
  share a link." (151 characters, measured). A public page, in the sitemap as a
  bare entry, its canonical itself; its card draws the Neophyte hall.

### A6. Every path that moves

- **Routes**: `git mv src/app/gd/hall src/app/gd/halls`; the editor's
  page, its loader and the modules only it uses (`HallPlayground*`,
  `hallDraft`, `hallHistory`, `hallShare`, `hallLimits`, `exportFonts`,
  `exportCredit`, their CSS and tests) move into `halls/editor/`
  (`exportCredit.ts` writes `${SITE_URL}/gd/hall` into every export's
  credit; it becomes `${SITE_URL}/gd/halls/editor`, and its test's
  expected text and the exports' credit pins follow); `art`,
  `fontBase`, the presets' snapshots and `presets.test.tsx` stay in
  `halls/`, since the reader and the ritual editor import them. Imports
  of `@/app/gd/hall/...` follow (`src/doc`, `src/offline`,
  `src/render`).
- **The page path** moves into the contract, `gdHallPagePath(slug)` →
  `/gd/halls/<slug>`, which `hallPath` (`src/seo/halls.ts`) and the
  image files' metadata (`licenceFacts` in `src/render/gdHallImage.tsx`,
  which writes `${SITE_URL}/gd/hall/<slug>` today) both use, so the path
  is written once.
- **Image pins move** (deliberately, once): each file names its page
  (the SVG's `cc:attributionURL`, the PNG's XMP), so all fourteen halls'
  SVG and three PNG digests change. The source digests (the SVG before
  outlining) must not, which shows the drawings are unchanged.
- **`next.config.ts`**: `HALL_SMALLER_IMAGES` →
  `/gd/halls/:slug/:file([a-z0-9-]+-(?:medium|small)\.png)`; the three
  redirects.
- **`/api/render/gd-hall`**'s redirect follows `hallFiles`, so it moves
  with them.
- **`src/seo/pages.ts`**: `/gd/hall` gives way to `/gd/halls` and
  `/gd/halls/editor`. **`cards.ts`**: the two cards (A3, A5).
  **`pathnames.ts`**: A3. **`routes.test.ts`**: `/gd/halls` and
  `/gd/halls/editor` public, `/gd/halls/[slug]` an entity route.
  **Sitemap**: `/gd/halls` and `/gd/halls/editor` bare, the fourteen
  hall pages with their images at the new paths.
- **Links**: the `/gd` tile (`/gd/halls`); the grade pages' "Temple
  halls" row (through `hallPath`); `/about`'s licence paragraph and
  `/help/ritual-pug` (`/gd/halls`, and "temple hall editor" to
  `/gd/halls/editor`); the hall page's trail, "Open in the editor" and
  previous and next.
- **Words**: doc comments and test names that say `/gd/hall`, in the app
  and in `src/components/gd/hall` (comments only there; the directory
  keeps its name, which is the package's, not a URL). At the end, a
  grep for the URL forms only (a bare `/gd/hall\b` would also match
  every `@magick-components/gd/hall` import), a quote, backtick,
  bracket, brace or space before the path and a separator or the line's
  end after it:
  `` git grep -nE "(^|[\"'\`( }])/gd/hall([/#\"'\` ]|$)" -- . ':!plans' ``
  finds only the redirects and their test. On `main` it finds 75 lines
  today, none of them an import.

### A7. Commits

Each is one gated commit on `gate/halls-i`, building and passing alone.

| # | Commit (subject) | Content |
| --- | --- | --- |
| P1 | `feat(gd): Move the temple halls to /gd/halls` | A2, A5 and A6: the route move, the editor alone at `/gd/halls/editor`, `/gd/halls` serving today's gallery with the intro and "Open the editor", the redirects and their test, the reserved slug, every path, the moved pins |
| P2 | `feat(gd): Group the halls on their index` | A3: the compact grouped cards, the shared labels, the index's metadata |
| P3 | `feat(gd): Show every hall beside each hall` | A4: the hall page's grid, the rail, `HallJump`, the phone order |
| — | (with plan 061's stage I record) | this amendment's results, and plan 000 |

P1 is a move, kept whole so that no commit has a link to a page that is
not there; P2 and P3 are each revertable alone.

### A8. Verification

- **Unit tests**: the redirect list (the three entries, `permanent`,
  read from the built `next.config` as the `headers()` test does);
  `GD_HALL_RESERVED_SLUGS` against the slugs and against the static
  children of `src/app/gd/halls`; `hallPath` and the files' paths; the
  page metadata of the index, the editor and a hall (canonical, title,
  description lengths); the JSON-LD breadcrumb; the sitemap entries; the
  route classification; the moved pins; the shared labels (all fourteen,
  pinned literally); the rail's `aria-current` and the select's groups
  and selected option in the hall page's render test; the index's
  render test (one `h1`, fourteen links, grade headings).
- **Built output** (`next build`, webpack; `next start` on 127.0.0.1):
  `/gd/halls`, `/gd/halls/editor` and the fourteen pages and 56 files
  prerendered; `curl -I` of `/gd/hall`, `/gd/hall/zelator-1` and
  `/gd/hall/zelator-1/golden-dawn-zelator-1-temple.png` gives 308 to the
  new paths; `noindex` still on the medium and small PNGs only;
  `/gd/halls/editor/x` and `/gd/halls/nope` are 404s.
- **Browser** (headless Chromium over CDP, 127.0.0.1, a fresh port,
  never 3004 or 3011): the index, Practicus 1's page and the editor at
  1,440 × 900, 1,024 × 768 and 390 × 844 at 2×: one `h1`, no horizontal
  scroll, no console error or hydration warning, layout shift 0; the
  rail sticky with the current hall outlined; on the phone no rail
  thumbnail fetched and the select navigating; `/gd/hall#preset=
  philosophus-4` and a `/gd/hall#hall=1.…` share link landing on the
  editor with that hall. **Firefox** (headless, `firefox --headless
  --screenshot` and a WebDriver run if one is to hand): the same two
  fragment links through the redirect. Safari and real devices are not
  available; stated.
- **Budgets** (gzip -6, against `main` ec6f765): the index's HTML at
  most 15 KB and no page-specific client chunk; a hall page's own
  client chunk (`HallJump`) at most 1 KB gzipped and its HTML at most
  20 KB (it gains the rail's markup); the editor's chunks unchanged
  within 0.2 KB (only the "Browse halls" link).
- **Documentation screenshots**: none shows `/gd/hall` or a hall page;
  none recaptured for this piece.

### A9. Risks

- **A permanent redirect is cached for good.** If `/gd/hall` were ever
  wanted back, browsers that saw the 308 would keep going to
  `/gd/halls/editor`. Nothing public links `/gd/hall`, and nothing
  plans to reuse it.
- **The rail's weight**: about 250 KB of thumbnails on every desktop
  hall page, loaded lazily but all in view. Accepted in the mock-ups'
  review; a 56 px thumbnail size would be a new image size and new
  pins, not done.
- **A client component on the hall pages** (the select): a little
  JavaScript and a hydration boundary where there was none; the budget
  and the hydration check hold it.
- **The pins move** for every hall image at once, by text only; the
  source digests prove the drawings did not.
- **Search engines** have not seen `/gd/hall/<slug>` (never deployed),
  so nothing is lost; the 308s cover anyone who kept a link from a
  preview.

### A10. Gadi's answer (28 October 2026)

1. **The editor in the sitemap**: a plain entry, as recommended.

### A11. As built (28 October 2026)

Gadi added on 28 October 2026: the editor page keeps its sitemap entry
and gets a better title, description and short intro in our own words,
its licence line matching what the exports embed (the art credited
under CC BY 4.0 to Magick.ly, no licence over the user's arrangement).

| # | Commit | Change |
| --- | --- | --- |
| P1 | cdb7bab | the move, the redirects (`src/seo/hallRedirects.ts`), the reserved slug, every path, the editor alone with "Browse halls", the editor's title, description and intro, the moved pins |
| P2 | 1678397 | the index's grouped cards (`HallIndex`) and the shared labels (`hallGroups`) |
| P3 | 0f0fc86 | the hall page's grid, the rail (`HallRail`) and "Jump to hall" (`HallJump`) |

How the build departs from A1 to A10:

- **Headings.** The app bar names a page that has a title in its own
  `h1` ("Temple Halls", "Hall Editor"), so the index's "Golden Dawn
  temple halls" is an `h2` and its grade headings `h3`; a hall page's
  title stays the page's `h1` (the bar shows the site's name there).
- **The editor's words** (Gadi's addition): the title "Golden Dawn
  Temple Hall and Floor Plan Editor" (57 characters with the site's
  suffix); the description "Design a Golden Dawn temple hall in your
  browser: place officers, furniture, banners and tablets in Pug source
  or visually, then export SVG or PNG." (147); and the intro "An editor
  for Golden Dawn temple halls. Start from any of the fourteen halls, or
  build your own from composable tags in its Pug source or on the
  drawing. Download it as SVG or PNG: our artwork is CC BY 4.0, free to
  use with credit to Magick.ly.", the licence linked to its deed, before
  the existing paragraph on drafts. Its Open Graph follows the page
  entry; its JSON-LD came later (A12).
- **The redirects** live in `src/seo/hallRedirects.ts`, which
  `next.config.ts` imports, so they import nothing; a test resolves each
  through the built config with `path-to-regexp`.
- **The rail** labels a card by its place where it has one ("31st
  path", "In Hod") and by its part otherwise; the select's options read
  "Practicus · Part 1 · 31st path", since a closed native select shows
  only the chosen option. The previous and next links appear twice,
  under the actions ("Previous and next halls") and at the foot ("More
  temple halls"); the rail is "All temple halls".
- **`EntityFrame`** takes a `maxWidth` (`lg` for the hall pages).
- **The export credit** names `/gd/halls/editor`; the image files name
  their pages under `/gd/halls`, so all fourteen halls' SVG and three
  PNG digests moved (56), the source digests did not.

The checks:

- **Gates**: each commit, one at a time, in a clean `git archive` export
  on `/home` with Node 24 and the CI placeholder environment:
  `install --frozen-lockfile`, `check`, `typecheck`, `test:coverage` and
  `build`, every status 0; the tip also `loom check`, the magick-data
  smoke test and `check:turbopack`.
- **HTTP** (`next start` of the gate's build, 127.0.0.1): `/gd/hall`,
  `/gd/hall/zelator-1` and its full PNG answer 308 to the new paths;
  `/gd/halls`, `/gd/halls/editor` and the hall pages 200;
  `/gd/halls/editor/x` and `/gd/halls/nope` 404; `noindex` on the
  medium and small PNGs only; `/api/render/gd-hall?hall=portal-2` 308 to its SVG. The
  sitemap has 197 URLs and 28 image entries, `/gd/halls` and
  `/gd/halls/editor` among them, and no `/gd/hall/`.
- **Fragments through the redirect**: `/gd/hall#preset=philosophus-4`
  opened Philosophus 4 in the editor, a `/gd/hall#hall=1.…` share link
  opened its hall (a changed caption), and `/gd/hall/zelator-1` landed on
  the hall's page, in headless Chromium and in headless Firefox 157
  (WebDriver BiDi). Safari and real devices were not checked.
- **Browser** (headless Chromium over CDP, 1,440 × 900, 1,024 × 768 and
  390 × 844 at 2×): one `h1`, no horizontal scroll and layout shift 0 on
  the index and the hall pages; the editor's layout shift is 0.03 on the
  desktop (the footer moving when the editor arrives, now that the
  full-screen spacer is gone) and 0 on the phone; the rail sticky
  with the current hall outlined; the select grouped by grade.
- **The rail's thumbnails, corrected after the review.** The first
  build hid the rail with `display: none` and trusted lazy loading,
  and Chromium fetched all fourteen small PNGs on a phone all the same
  (the review measured them at 375 × 812, about 250 KB a page; this
  record's first check, on a dev server, had missed it). Each thumbnail
  is now a `<picture>` source for `(min-width: 900px)` over an inline
  transparent pixel, which costs no request. Measured on the production
  build of P3 (headless Chromium, a fresh profile each, the page
  scrolled to its foot): at 375 × 812 and 390 × 844, no small PNG (the
  page's medium PNG and its neighbours' prefetched ones only); at
  1,440 × 900, the fourteen small PNGs, 250,357 bytes.
- **The review's other fixes in P1 to P3**: the per-file coverage
  thresholds (95/90) now cover `src/app/gd/halls`, its `editor` and
  `[slug]` folders and `src/seo/hallRedirects.ts` (the move had left
  the old glob matching nothing), with tests of the index page, the
  hall route's metadata and 404s, and `HallJump`; the select is named
  "Jump to hall" alone (`htmlFor`) and keeps the chosen hall while the
  next page loads; the rail and the index take the theme's link colour
  (MUI `Typography color="primary"`) and outline the current hall in
  it, with no fixed colours. The rail's "All temple halls" link is
  still a plain link in the browser's colour (a follow-up).
- **Budgets** (gzip -6, against `main` ec6f765 built here; after the
  review's fixes): the index's HTML 11,073 bytes and its page chunk
  8,616 (3,223); a hall page's chunk 4,246 → 5,919 bytes (1,877 →
  2,446, the select), its HTML 11,970 → 15,612 (Zelator 1); the editor page's chunk 10,278 → 10,070 (3,877 →
  3,792) and its HTML 11,031 → 9,424 (the gallery gone); the hall
  editor's own chunk 41,803 → 41,997 (15,558 → 15,599).
- **Documentation screenshots**: none shows these pages.

A `WebApplication` node in the editor's JSON-LD would fit (name,
`applicationCategory` "DesignApplication", `operatingSystem` "Any",
`offers` free, `url`); proposed for Gadi rather than added. Gadi
approved it on 29 October 2026 (A12).

### A12. The editor described as an app (29 October 2026)

Gadi approved A11's proposal on 29 October 2026. `/gd/halls/editor`
carries one JSON-LD node, `hallEditorJsonLd()` in `src/seo/halls.ts`,
rendered and escaped by `JsonLd` as the hall pages' is:

- `@type` `WebApplication`; `name`, `description` and `url` are the
  page's own title, meta description and canonical (a test holds them
  to `pageMetadata("/gd/halls/editor")`).
- `applicationCategory` "DesignApplication" and `operatingSystem`
  "Any", Google's recommended properties; `browserRequirements`
  "Requires JavaScript.", which is true (the page says so where scripts
  are off).
- `offers`: price "0" in `USD`, as in Google's own examples; the apps
  are free (Gadi's choice, 29 October 2026; Google recommends a
  currency only for paid apps).
- `publisher` and `creator`: the `Organization` "Magick.ly", the same
  node (`SITE_ORGANIZATION` in `src/seo/site.ts`) the hall images'
  `ImageObject`s now take as their creator, rather than a second copy.
- No `license`: CC BY 4.0 covers the hall art, not the app (its code is
  AGPL, the hall package MIT). No rating or review.

Google's software-app documentation (last updated 8 September 2026)
requires `name`, `offers.price` and either `aggregateRating` or
`review` for the rich result, and supports the `WebApplication` subtype.
With no rating the page earns no software-app rich result; the node is
structured data only, which is what was wanted.

