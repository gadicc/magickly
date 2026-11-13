# magick-components

React components that draw magickal figures from
[magick-data](https://www.npmjs.com/package/magick-data): the Tree of Life,
the Golden Dawn's temple halls, its lamens and symbols, the rose-cross
sigil, the Enochian tablets, the planetary kameas and the planetary
spirits' seals, and the Moon's phase. They are the drawings of
[magick.ly](https://magick.ly), which consumes this package as anyone else
would. Every figure is an inline SVG, drawn from the data, so it scales,
prints and can be styled by the page around it.

The package is not published yet: it is built and tested in
[the repository](https://github.com/gadicc/magickly/tree/main/packages/magick-components),
and the first release will be announced there. Until then, what follows
describes the published shape that the smoke test checks.

## Licences

Copyright (c) 2020-2026 Gadi Cohen. The package is under two licences, by
path, and [LICENSE.txt](./LICENSE.txt) says which file is which:

- **The code is MIT**, and that includes the drawings. A component whose
  code *is* the drawing (the sigils, the lamens, the hall's art, the
  planetary spirits' seals) is MIT as code, path data and all, so you may
  take the drawing from the package under MIT. magick.ly licenses the
  images it serves under CC BY 4.0, but anyone can render the same drawing
  from this package under MIT.
- **The hall's three fonts are under the SIL Open Font License 1.1**:
  subsets of Noto Serif and Frank Ruhl Libre in `fonts/`, with their
  notices and [their sources](./fonts/SOURCES.md).

The data the components read is magick-data's, which is licensed by its
own files: its code MIT, its data CC BY 4.0, with credit to
[magick.ly](https://magick.ly). The app around these components is
[AGPL-3.0-or-later](https://github.com/gadicc/magickly/blob/main/LICENSE.txt);
this package is deliberately freer, so that it can travel.

Each traced drawing names the public-domain edition it follows: the
planetary spirits' seals follow Agrippa's *De occulta philosophia*
(1533), for example. Layouts taken from modern books are facts, drawn in
our own art.

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

- `astrology/Moon`, which works out today's phase after hydration;
- `astrology/Mercury`, which works out Mercury's next retrograde;
- `gd/RoseSigil`, which optimises and animates the sigil.

A client module's exports all become client references, so each of these
exports only its component. Their helpers live in modules of their own
(`astrology/moonPath`, `gd/RoseSigilImage`, `gd/roseSigilGeometry`).

## The entry points

Each is a subpath of the package; there is no barrel, so a page pays only
for what it imports.

| Subpath | What it is |
| --- | --- |
| `kabbalah/TreeOfLife` | The Tree of Life, its spheres labelled from any field of magick-data's sephirot, in the Queen or King scale, with the Hermetic or the Hebrew letters on its paths |
| `kabbalah/fieldPath` | `readFieldPath()`, which reads a dotted field path (`planet.name.en.en`, `stones.*.name.en`) from a row, as the Tree's labels do |
| `gd/GradeTree` | The Tree as the map of the Golden Dawn's grades |
| `gd/hall` | `GdHall`, a Golden Dawn temple hall drawn from a hall description, with its layout, validation, description and art |
| `gd/hall/presets` | The halls of the grades, Neophyte to Philosophus and the Portal, as descriptions `GdHall` draws |
| `gd/hall/GdHall` | `GdHall` and `GdHallSvg` alone |
| `gd/hall/aspect` | A hall's proportions without laying it out, which a page sizes its frame by before the drawing loads |
| `gd/hall/attributes` | Reading and checking a hall node's attributes |
| `gd/hall/describe` | A hall in words: its stations and objects |
| `gd/hall/layout` | `resolveHall()`, which places a hall's objects and labels |
| `gd/hall/planets` | The planets a hall's kameas and seals name |
| `gd/hall/spec` | What the validator and the layout share: each tag's specification, where it may stand, and the size limits |
| `gd/hall/types` | The hall's types |
| `gd/hall/validate` | `validateHall()`, the warnings for a hall description |
| `gd/hall/vocabulary` | The kinds of hall object and the names they take |
| `gd/Lamen` | An officer's lamen |
| `gd/lamenGrades` | Which grades' lamens each officer wears |
| `gd/RoseSigil` | The rose-cross sigil of a Hebrew text, optimised and drawn on in the browser (`"use client"`) |
| `gd/RoseSigilImage` | The same sigil with no hooks, for the server, from points you give it |
| `gd/roseSigilGeometry` | The rose's letters and the sigil's geometry, `roseLetters()` and `sigilPoints()` among them |
| `gd/roseSigilOptimizer` | `optimizeSigilPoints()`, the layout optimiser (nlopt, compiled to WASM) |
| `gd/SevenBranchedCandleStick` | The seven-branched candlestick, with its planets |
| `gd/TableOfShewbread` | The table of shewbread, with the signs and the tribes |
| `gd/symbols/fylfot-cross` | The fylfot cross of the signs and elements |
| `enochian/Tablet` | An Enochian tablet, a Watchtower or the Tablet of Union, in the Golden Dawn's, Dee's or another tradition's letters |
| `chakras/Chakras` | The seven chakras, in their colours, on the outline of a body |
| `astrology/Kamea` | A planet's kamea, its magic square |
| `astrology/planetarySpirits` | The planetary spirits' seals |
| `astrology/Moon` | The Moon's phase today, as seen from either hemisphere (`"use client"`) |
| `astrology/moonPath` | The Moon drawing's lit part for a phase |
| `astrology/Mercury` | Mercury's next retrograde, under a picture of the planet you give it (`"use client"`) |
| `astrology/mercuryRetrograde` | Mercury's stations and retrogrades, from astronomy-engine |
| `astrology/planetDays` | Which planet rules each day of the week |
| `astrology/planetName` | A planet's name as readers search for it: "Sun (Sol)", "Mercury" |
| `hooks/useHydrated` | `useHydrated()`: false on the server and while hydrating, true after |
| `fonts/*` | The hall's fonts and `gd-hall.css` ([below](#the-halls-fonts)) |

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
const nextConfig = {
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
- **Mercury's pictures.** `Mercury` takes its background and the planet's
  picture as `background` and `image` (a URL, or `<img>` props such as
  Next's `getImageProps()` gives), and draws none of its own.
- **Links.** `TreeOfLife` links each sphere and path to magick.ly's paths
  (`/kabbalah/sephirah/…`) unless you pass `sephirahHref` and `pathHref`.

## Versions

The props are still settling, so the package stays at 0.x: a minor version
may change them, and a patch will not. It depends on magick-data at the
version it was built with (`^0.x`), and moves with it.

## Requirements

React 19 and an ES module environment: Node 22 or later, or any current
bundler. The declarations name `.ts` files, as magick-data's do;
TypeScript 6 reads them under `bundler` and `nodenext`.
