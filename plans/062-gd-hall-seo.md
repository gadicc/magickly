# Search pages for the temple halls — 26 October 2026

Status: design only, no code. Read
[current status](000-current-status.md) first. This plan builds on the
whole-site SEO of [plan 028](028-seo.md), the image route of
[plan 027](027-component-exports.md), the entity pages of
[plan 036](036-entity-pages.md) and the halls of
[plan 061](061-gd-hall.md), whose presets it publishes. Revised the same
day after an adversarial review (verdict "not ready as written", the
design sound apart from the findings folded in below; evidence in
`~/.cache/review-seo/`) and Gadi's answers to the first draft's seven
questions; Gadi answered the last three the same day (the outliner's
option (a), the SVG indexable, a medium size for phones).

Gadi's decisions of 26 October 2026:

- **Licence.** The hall images are CC BY 4.0. The art is original and,
  as code, MIT (plan 061, decision 9); the presets are MIT data.
- **URLs.** One server-rendered, statically generated page per preset
  under `/gd/hall/<slug>`. `/gd/hall` stays the editor and gains a
  server-rendered gallery, below the editor with a jump link to it.
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
  search engines keep its history. The static files are served with the
  platform's revalidating headers and ETag, the CDN purges on deploy,
  and the API copy keeps its `s-maxage` of a day. The service worker
  caches images stale-while-revalidate, so a client that has seen an
  image is shown the old one once after it changes, and the new one
  from then on; acceptable for a drawing.

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
- Stage I of plan 061: link each built-in ritual's hall to its page.
- The reader's hall could take a `<desc>` from `describeHall`.
