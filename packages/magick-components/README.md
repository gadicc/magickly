# magick-components

React components that draw magickal figures from
[magick-data](https://www.npmjs.com/package/magick-data): the Tree of Life,
the Golden Dawn's temple halls, its lamens and symbols, the rose-cross
sigil, the Enochian tablets, the planetary kameas and the planetary
spirits' geomantic sigils, and the Moon in its phases. They are the drawings of
[magick.ly](https://magick.ly), which consumes this package as anyone else
would. The figures are drawn from the data as inline SVG, so they scale,
print and can be styled by the page around them. A few wrap their drawing
in HTML: the fylfot cross is a table of squares, `MoonWidget` and
`MercuryWidget` are tiles around a drawing or a picture, and a planetary
spirit's sigil is
centred in a `<div>` you may style.

The markup inside a drawing is not part of the API: its elements, ids and
attributes may change in any release. What is part of it is each
component's props and the classes a component documents as a styling hook
(the Tree's layers, [below](#the-tree-on-your-page)).

It is built and tested in
[the repository](https://github.com/gadicc/magickly/tree/main/packages/magick-components),
whose smoke test installs the packed tarball as a stranger would and
checks the published shape this README describes.

## Licences

Copyright (c) 2020-2026 Gadi Cohen. The package is under three licences,
by path, and [LICENSE.txt](./LICENSE.txt) says which file is which:

- **The code is MIT**, and that includes the drawings. A component whose
  code *is* the drawing (the sigils, the lamens, the hall's art, the
  planetary spirits' sigils) is MIT as code, path data and all, so you may
  take the drawing from the package under MIT. magick.ly licenses the
  images it serves under CC BY 4.0, but anyone can render the same drawing
  from this package under MIT.
- **The Moon's paths are also under BSD 3-Clause**: `astrology/Moon` and
  the module of its paths adapt `phase_junk()` from
  [moon-phase](https://github.com/tingletech/moon-phase/blob/643015a83509ca6a662d1af6e1ac14661852cedb/moon-phase.js),
  Copyright © 2012, Regents of the University of California. Keep its
  notice, in LICENSE.txt, with copies of those two modules, including in
  what you build from them.
- **The hall's three fonts are under the SIL Open Font License 1.1**:
  subsets of Noto Serif and Frank Ruhl Libre in `fonts/`, with their
  notices and [their sources](./fonts/SOURCES.md).

The data the components read is magick-data's, which is licensed by its
own files: its code MIT, its data CC BY 4.0, with credit to
[magick.ly](https://magick.ly). The app around these components is
[AGPL-3.0-or-later](https://github.com/gadicc/magickly/blob/main/LICENSE.txt);
this package is deliberately freer, so that it can travel.

A drawing after an old source is our own drawing of a public-domain
printing, cited by page and scan: the planetary spirits' geomantic sigils
(the Rulers of the geomantic figures) follow John Heydon's *Theomagia*
(1663/4), and the Enochian Watchtowers' plain sigils, and the form of
Air's in colour, the plate of *The Equinox* (1912). Air's is a Tau with
four Yods above it, drawn as small flames (Regardie, *The Golden Dawn*,
vol. 4, 1940, p. 307). Regardie says the sigils are taken from Dee's
Sigillum Dei Aemeth (p. 308), whose T carries a 4 above it (*The
Equinox* I(7), Plate II, archive.org `crowley-equinox_202110`, leaf
n238), so the four Yods likely stand for that 4; the inference is ours,
not a source's. The form follows Plate X (leaf n256). The coloured Water and
Fire sigils are drawn from Regardie's description of them (1940), and
Earth's is a cross in four colours. Layouts taken from modern books are
facts, drawn in our own art.

## Installing

```sh
npm install magick-components react
```

It needs React 19, and it is ES modules only. `@types/react` is an optional
peer: TypeScript users have it already. In a Server Component, or anything
that renders React:

```tsx
import TreeOfLife from "magick-components/kabbalah/TreeOfLife";

export default function Page() {
  return <TreeOfLife field="name.he" colorScale="queen" width={300} />;
}
```

## Server and Client Components

Most of the components use no hooks, or only `useId` and `useMemo`, and
render as Server Components, in plain Node with `renderToStaticMarkup`, or
in the browser. Three need the browser, and are marked `"use client"`:

- `astrology/MoonWidget`, which works out today's phase after hydration;
- `astrology/MercuryWidget`, which works out Mercury's next retrograde;
- `gd/RoseSigil`, which optimises and animates the sigil.

A client module's exports all become client references, so each of these
exports only its component. Their helpers live in modules of their own
(`astrology/Moon`, `gd/RoseSigilImage`, `gd/roseSigilGeometry`).

The Moon's drawing alone, `astrology/Moon`, needs no browser: it draws a
phase you give it, or a date's, which a page that knows the date passes:

```tsx
import { Moon } from "magick-components/astrology/Moon";

export const Tonight = ({ date }: { date: Date }) => (
  <Moon date={date} height={85} hemisphere="south" />
);
```

## The entry points

Each is a subpath of the package; there is no root entry. Most subpaths
are one module, and `gd/hall` gathers the hall's: its exports come from
several modules, and the package declares no side effects but its CSS,
so a bundler takes from it only the modules whose exports a page uses.
Each component is its entry's default export and a named export too
(`import TreeOfLife from …` or `import { TreeOfLife } from …`). Each
component imports only the magick-data tables it draws, except
`TreeOfLife` and `GradeTree`: a sphere's label may be any field of the
assembled graph, so they import magick-data's root entry, every table.

| Subpath | What it is |
| --- | --- |
| `kabbalah/TreeOfLife` | The Tree of Life, its spheres labelled from any field of magick-data's sephirot, in the Queen or King scale, with the Hermetic or the Hebrew letters on its paths |
| `kabbalah/fieldPath` | `readFieldPath()`, which reads a dotted field path (`planet.name.en.en`, `stones.*.name.en`) from a row, as the Tree's labels do |
| `gd/GradeTree` | The Tree as the map of the Golden Dawn's grades |
| `gd/hall` | `GdHall` (also the default export), a Golden Dawn temple hall drawn from a hall description, and what a page needs to draw, check or describe one: the description's types, `validateHall()`, `describeHall()`, `estimateHallAspect()`, `GdHallSvg` and the layout it draws, the default art and the fonts |
| `gd/hall/presets` | The halls of the grades, Neophyte to Philosophus and the Portal, as descriptions `GdHall` draws |
| `gd/Lamen` | An officer's lamen |
| `gd/lamenGrades` | Which grades' lamens each officer wears |
| `gd/RoseSigil` | The rose-cross sigil of a Hebrew text, optimised and drawn on in the browser (`"use client"`) |
| `gd/RoseSigilImage` | The same sigil with no hooks, for the server, from points you give it |
| `gd/roseSigilGeometry` | The rose's letters and where a text's letters stand on it: `ROSE_LETTERS`, `roseLetters()`, `letterPoint()` and `sigilPoints()` |
| `gd/roseSigilOptimizer` | `optimizeSigilPoints()`, the layout optimiser (nlopt, compiled to WASM) |
| `gd/SevenBranchedCandlestick` | The seven-branched candlestick, with its planets |
| `gd/TableOfShewbread` | The table of shewbread, with the signs and the tribes |
| `gd/FylfotCross` | The fylfot cross of the signs and elements |
| `enochian/Tablet` | An Enochian tablet, a Watchtower or the Tablet of Union, in the Golden Dawn's, Dee's or another tradition's letters |
| `chakras/Chakras` | The seven chakras, in their colours, on the outline of a body |
| `astrology/Kamea` | A planet's kamea, its magic square |
| `astrology/PlanetarySpirit` | A planetary spirit's geomantic sigil (the Rulers of the figures) |
| `astrology/Moon` | The Moon in a phase you give, or a date's, as seen from either hemisphere |
| `astrology/MoonWidget` | A tile of today's Moon and its phase's name, as seen from the viewer's hemisphere (`"use client"`) |
| `astrology/MercuryWidget` | A tile of Mercury's current or next retrograde, under a picture of the planet you give it (`"use client"`) |
| `astrology/mercuryRetrograde` | Mercury's stations and retrogrades, from astronomy-engine |
| `fonts/*` | The hall's fonts and `gd-hall.css` ([below](#the-halls-fonts)) |

### Not stable

| Subpath | What it is |
| --- | --- |
| `gd/hall/editor` | The toolkit of magick.ly's hall editor: the hall vocabulary, the attribute readers and the layout's measures that the editor reads beyond `gd/hall`. It serves that editor and may change in any release, a patch included |

## The Tree on your page

Without props, `TreeOfLife` draws as magick.ly's Tree page does by
default: each sphere's Roman name (`field="name.roman"`), numbered above
(`topText="index"`) and named in English below (`bottomText="name.en"`),
in the Queen scale (`colorScale="queen"`), with the Hermetic Tree's
letters on its paths (`letterAttr="hermetic"`), and its labels at 10
(`fontSize`; another field sizes its own, 32 for `index` and 20 for
Hebrew). Stating a default draws the same Tree as leaving it out:

```tsx
import { TreeOfLife } from "magick-components/kabbalah/TreeOfLife";

export const Tree = () => <TreeOfLife width={300} />;
```

`activeSephirah` draws one sphere and fades the rest (`null` fades them
all), and `activePath` does the same for a path; an id the Tree does not
have throws. The spheres and paths are links only where you give them
one ([below](#what-you-supply)). The `<svg>` is well-formed XML, its
links and its labels' curves `xlink:href` with the prefix declared.

It keeps to itself, so that several can share a page:

- **Ids.** The `<svg>`'s id is the `id` you pass (letters, digits, `-`
  and `_`, starting with a letter) or one from React's `useId`, and every
  id inside it begins with that id and a hyphen (`tree-sephirot`,
  `tree-topTextPath0`). The ids are not a styling hook; they may change.
  `useId` is unique within one React render, so Trees that separate
  renders put on one page (two `renderToStaticMarkup` calls joined) need
  an `id` each.
- **Classes.** Its three layers carry classes you may style by, which are
  part of its contract (`TREE_LAYER_CLASSES`): `magick-tree-paths` (the
  paths' outlines), `magick-tree-path-letters` (their letters) and
  `magick-tree-sephirot` (the spheres and their labels). magick.ly's dark
  mode re-inks the outlines through them.
- **Its stylesheet** names only its own `<svg>`, `flip` included.
- **Without hooks.** `TreeOfLifeSvg`, from the same entry, draws the same
  Tree with no hooks and needs its `id`: for `renderToStaticMarkup` in a
  route handler, where React's server build has no dispatcher for
  `useId`.
- **Fonts.** It sets its labels in Noto Sans and Noto Sans Hebrew (both
  OFL), falling back to Arial and sans-serif, and loads nothing itself:
  load the two families on your page, or serve `NotoSans-Regular.ttf` and
  `NotoSansHebrew-Regular.ttf` and pass where they are as `fontBaseUrl`
  (`<TreeOfLife fontBaseUrl="/fonts" />`). The SVG then carries
  `@font-face` rules for them, which an exported SVG needs; like any
  `@font-face`, they define the two families for the whole page.

## The hall's fonts

`GdHall` measures its labels with the three font subsets in `fonts/`, and
names its own font families so that no other build of Noto Serif or Frank
Ruhl Libre stands in for them. Load them in one of two ways:

- **Import the stylesheet**, and your bundler emits the fonts with the
  rest of your assets:

  ```ts
  import "magick-components/fonts/gd-hall.css";
  ```

  The package's `sideEffects` keeps the import under any bundler.
  TypeScript 6 checks that a side-effect import names a module it knows
  of. Next's types, which `next-env.d.ts` brings in, declare CSS files;
  elsewhere, a declaration file of your own does:

  ```ts
  // css.d.ts
  declare module "*.css";
  ```
- **Serve the files yourself** and pass where they are as `fontBaseUrl`
  (`<GdHall hall={…} fontBaseUrl="/fonts" />`); the SVG then carries its
  own `@font-face` rules, which an exported SVG needs.

## The rose sigil and nlopt

`RoseSigil` optimises the sigil's layout with
[nlopt-js](https://www.npmjs.com/package/nlopt-js), whose Emscripten glue
asks for Node's `fs` even in a browser bundle. Both of Next's bundlers then
fail with `Can't resolve 'fs'` until you stub it out:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack (next dev, and next build since Next 16): empty.ts is an
  // empty module of your own.
  turbopack: { resolveAlias: { fs: { browser: "./empty.ts" } } },
  // webpack (next build --webpack)
  webpack: (config, { isServer }) => {
    if (!isServer)
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

export default nextConfig;
```

Only `RoseSigil` and `gd/roseSigilOptimizer` reach nlopt; a page that
draws the sigil on the server with `RoseSigilImage`, or uses nothing of the
sigil, needs no stub. If the optimiser fails to load, `RoseSigil` keeps the
letters' centres it first drew. Text that is not Hebrew is left out of the
sigil, and final forms are drawn as their base letters.

## What you supply

- **An Enochian font.** `Tablet` draws the Latin transliteration unless you
  pass `enochianStyle`, the CSS of a font that sets the Enochian letters.
  The one magick.ly uses has no licence text, so it is not in the package.
- **The tiles' pictures.** `MoonWidget` and `MercuryWidget` take their
  background as `background`, a URL drawn to cover, and `MercuryWidget`
  the planet's picture
  as `image` (a URL, or `<img>` props such as Next's `getImageProps()`
  gives). Neither draws a picture of its own; without them the tile has
  no background.
- **The Tree's fonts**, Noto Sans and Noto Sans Hebrew, on your page or
  through `fontBaseUrl` ([above](#the-tree-on-your-page)).
- **Links.** `TreeOfLife` and `GradeTree` link nothing unless you pass
  `sephirahHref` and `pathHref`. Each is given the sphere's or the path's
  magick-data row and returns a URL, or `null` for no link; the links are
  plain SVG links, which the browser follows:

  ```tsx
  import { TreeOfLife } from "magick-components/kabbalah/TreeOfLife";

  export const LinkedTree = () => (
    <TreeOfLife
      sephirahHref={(sephirah) => `/sephirot/${sephirah.id}`}
      pathHref={(path) => `/paths/${path.id}`}
    />
  );
  ```

- **Ink, where it is not black.** The fylfot cross borders its squares,
  and a planetary spirit's sigil is drawn, in black unless you pass `ink`,
  a CSS colour such as your theme's custom property
  (`ink="var(--my-ink, black)"`), as magick.ly does for the cross in its
  dark mode. The sigil's path keeps its `stroke="#000"` attribute, which
  your stylesheet may select, and takes `ink` as its style, which wins.
- **Labels.** `label` means one thing wherever a drawing takes it
  (`Tablet`, `Kamea`). Not given, the drawing is an image named for what
  it draws ("Enochian Watchtower of Fire", "Kamea of Saturn"); a string
  names it otherwise; and `label={false}` marks it decorative, hidden
  from assistive technology (`aria-hidden`), as for a drawing inside one
  that names itself or beside text that says what it is.

## Versions

The props are still settling, so the package stays at 0.x: a minor version
may change them, and a patch will not. It depends on magick-data at the
version it was built with (`^0.x`), and moves with it.

From 0.1.0, each release is published by the repository's CI when the
version changes on `main`, with npm provenance naming the commit it was
built from, as magick-data's are. CI publishes a pre-release under the
`next` tag and a release under `latest`. The first version, the release
candidate 0.1.0-rc.0, is published by hand.

## Requirements

React 19 and an ES module environment: Node 22 or later (`engines`
says so), or any current bundler. The declarations name `.ts` files, as magick-data's do;
TypeScript 6 reads them under `bundler` and `nodenext`.

## Provenance

Every drawing here is either drawn in code from magick-data's tables or
our own drawing after a source, and the table below says which, with the
source. The code is MIT and that cannot be taken back, so "Signed off"
is the date the owner checked the row's provenance, and no version past
0.0.0 ships while a row has none; a test holds the first column to the
package's entries.

| Drawing | Source | Signed off |
| --- | --- | --- |
| The planetary spirits' sigils (`astrology/PlanetarySpirit`) | Our own drawings of 13 November 2026 after John Heydon, *Theomagia*, vol. 1 (London, 1663/4), book I, ch. V, pp. 13 and 15 (archive.org `theomagiaortempl00heyd`, leaves n124 and n126): a few strokes of one width placed by eye over the scan, not traced. They replace tracings of a 1994 printing in copyright, which the repository's history keeps and the package does not |  |
| The Enochian tablets' letters (`enochian/Tablet`) | magick-data's `enochian/tablets.json5`, in each tradition's reading, signed off in its Sources; the tablet draws them as text |  |
| The Watchtowers' sigils (`enochian/Tablet`) | Drawn in code from lines, arcs and curves. The plain sigils, and the form of Air's in colour, after *The Equinox* I(7) (1912), Plate X (archive.org `crowley-equinox_202110`, "The Equinox Vol. 1, No. 7", leaf n256); the coloured Water and Fire sigils from Regardie's description, *The Golden Dawn*, vol. 4 (1940); Earth's a cross in four colours |  |
| The Air sigil's four Yods (`enochian/Tablet`) | Regardie, *The Golden Dawn*, vol. 4 (1940), p. 307 (archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaf n299) describes a Tau with four Yods above it; drawn as small flames after Plate X (above), hand-placed curves in code, not traced. That the Yods stand for the 4 over the T of Dee's Sigillum Dei Aemeth (*The Equinox* I(7), Plate II, leaf n238) is our inference, not a source's. They replace two fonts' glyphs, which the repository's history keeps |  |
| The kameas (`astrology/Kamea`) | A grid drawn in code around magick-data's squares (`magick-data/astrology/kameas`), which are Agrippa's, *De occulta philosophia* (Cologne, 1533), book II, ch. 22 |  |
| The rose-cross sigil (`gd/RoseSigil`, `gd/RoseSigilImage`, `gd/roseSigilGeometry`, `gd/roseSigilOptimizer`) | Drawn in code: the rose's letters are geometry written out in `gd/roseSigilGeometry`, and the sigil's path is laid out by the optimiser over them |  |
| The temple halls' art (`gd/hall`, `gd/hall/presets`, `gd/hall/editor`) | Our own art, in code. The halls' layouts are facts from Regardie, *The Golden Dawn*, vol. 2 (Aries Press, Chicago, 1938), cited for each hall by page and archive.org leaf (`IsraelRegardie-TheGoldenDawn-Vol2-1938`); no drawing of his is copied. Venus' and the Moon's seals follow Agrippa's woodcuts (1533), book II, ch. 22, pp. CLI and CLIII (archive.org `DeOccultaPhilosophiaLoc1533`, leaves n166 and n168), their geometry only. Each art records its source in its `provenance` |  |
| The halls' fonts (`fonts/*`) | Subsets of Noto Serif and Frank Ruhl Libre under the SIL Open Font License 1.1, made from google/fonts at a pinned commit; [fonts/SOURCES.md](./fonts/SOURCES.md) gives the files, their hashes and how they are made |  |
| The Moon (`astrology/Moon`, `astrology/MoonWidget`) | The paths of the lit part and the disc adapt `phase_junk()` from moon-phase, Copyright © 2012 Regents of the University of California, under the BSD 3-Clause License, at a pinned commit (see [Licences](#licences)); the phase comes from lune (Apache-2.0, a dependency). The tile draws no picture of its own |  |
| Mercury's retrogrades (`astrology/MercuryWidget`, `astrology/mercuryRetrograde`) | Our code, MIT, computing the stations with astronomy-engine (MIT, a dependency). The tile draws no picture of its own: the planet's is the page's |  |
| The Tree of Life and the Grade Tree (`kabbalah/TreeOfLife`, `kabbalah/fieldPath`, `gd/GradeTree`) | Drawn in code, its labels and colours from magick-data's sephirot and paths |  |
| The lamens (`gd/Lamen`, `gd/lamenGrades`) | Drawn in code. The officers' lamens and collars are facts from Regardie, *The Golden Dawn*, vol. 3 (Aries Press, 1939), pp. 82–84 and 88–90, and the Portal's from vol. 2 (1938), p. 156 (archive.org leaf n149); the rings' colours are our own convention. `gd/Lamen`'s comment cites these pages and the modern works it compared |  |
| The seven-branched candlestick (`gd/SevenBranchedCandlestick`) | Drawn in code, its planets from magick-data |  |
| The table of shewbread (`gd/TableOfShewbread`) | Drawn in code, its signs and tribes from magick-data |  |
| The fylfot cross (`gd/FylfotCross`) | A table of squares in code, its signs and elements from magick-data |  |
| The chakras (`chakras/Chakras`) | The seated figure is an original drawing of 13 November 2026, hand-placed curves in code, nothing traced or adapted; it replaces a silhouette of unrecorded source, which the repository's history keeps. The chakras' places and colours are magick-data's `chakras.json5` |  |
