# magick-components

React components that draw magickal figures from
[magick-data](https://www.npmjs.com/package/magick-data): the Tree of Life,
the Golden Dawn's temple halls, its lamens and symbols, the rose-cross
sigil, the Enochian tablets, the planetary kameas and seals, the planetary
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
- `gd/RoseSigil`, which draws the sigil on.

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
| `gd/hall` | `GdHall` (also the default export), a Golden Dawn temple hall drawn from a hall description, and what a page needs to draw, check or describe one: the description's types, lenient and strict ([below](#a-hall-on-your-page)), `validateHall()`, `describeHall()`, `estimateHallAspect()`, `GdHallSvg` and the layout it draws, the default art and the fonts |
| `gd/hall/presets` | The halls of the grades, Neophyte to Philosophus and the Portal, as descriptions `GdHall` draws |
| `gd/hall/tags` | The hall's tags, for writing a hall as JSX in `GdHall` (`import * as Hall`, then `<Hall.Floor>`, `<Hall.Pillar>` …; [below](#a-hall-written-as-tags)), with `defineHallTag()` and `defineHallItem()` for your own art's tags and item kinds, and `hallFromTags()`, which gives the hall the tags describe as data |
| `gd/Lamen` | An officer's lamen |
| `gd/lamenGrades` | Which grades' lamens each officer wears |
| `gd/RoseSigil` | The rose-cross sigil of a Hebrew text, drawn on in the browser (`"use client"`) |
| `gd/RoseSigilImage` | The same sigil with no hooks, for the server |
| `gd/roseSigilGeometry` | The rose's letters and where a text's letters stand on it, on either version of the rose: `ROSE_LETTERS`, `roseRings()`, `roseLetters()`, `letterPoint()` and `sigilPoints()`, with `ROSE_VERSIONS` and `ROSE_VERSION_NOTES` |
| `gd/roseSigilLayout` | The rose as a sigil layout, `roseSigilLayout()`, and the Golden Dawn's rules for it, `ROSE_SIGIL_PROFILE`, for the engine below |
| `gd/roseSigilStyles` | A one-word sigil as a finished figure, with no hooks, for the server: in a ring with its name, alone with its name, or as a talisman with its verse (`StyledRoseSigilImage`, and `styledRoseSigilLayout()`, the same worked out without drawing), with `SIGIL_STYLES`, `SIGIL_STYLE_NOTES` and `SIGIL_STYLE_FONTS`; the rose's own style is `gd/RoseSigilImage`'s |
| `sigil/types` | The sigil engine's contract ([below](#a-sigil-on-your-own-layout)): `SigilLayout`, `SigilProfile`, `SigilPlan` and the placed words' types |
| `sigil/planSigil` | `planSigil()`, what each vertex of a text's sigil says (its place, visit, crooks and marks), and `sigilWords()`, which splits a text into words |
| `sigil/ink` | The renderer: `wordInk()` and `sigilSubpaths()`, placed words as ink and path data, `sigilFrame()` and `sigilViewBox()`, and `DEFAULT_SIGIL_MARKS`, the mark sizes a profile can change |
| `sigil/placeSigil` | `placeSigil()`, where each vertex of a plan is drawn, by rule; `placeSigilWords()`, the same with what each word still fails of placement's checks; `DEFAULT_SIGIL_PLACEMENT` |
| `sigil/SigilImage` | `SigilImage`, a text's sigil planned, placed and drawn on any layout, with no hooks, and `sigilFigure()`, the same worked out without drawing |
| `sigil/kameaLayout` | A planet's kamea as a sigil layout, `kameaLayout()`, its letters reduced by Aiq Bekar to cells, the rules Regardie gives for it with the rose's marks, `KAMEA_SIGIL_PROFILE`, and `kameaSigilMinSize()`, the least width a figure on each square is drawn at |
| `gd/SevenBranchedCandlestick` | The seven-branched candlestick, with its planets, in two versions: *The Equinox*'s figure of 1909 (the default) and the modern arrangement (`CANDLESTICK_VERSIONS`, `CANDLESTICK_VERSION_NOTES`) |
| `gd/TableOfShewbread` | The table of shewbread, with the signs and the tribes |
| `gd/FylfotCross` | The fylfot cross of the signs and elements |
| `enochian/Tablet` | An Enochian tablet, a Watchtower or the Tablet of Union, in the Golden Dawn's, Dee's or another tradition's letters |
| `enochian/pyramidMarks` | The symbols on a pyramid's sides, as `Tablet` draws them with `pyramidSymbols`: `sideSymbol()`, which symbol a side shows, `SideMark`, its mark centred on 0, 0, their inks and outlines, and `PYRAMID_SYMBOL_TURNS`, how each side's mark is turned for `"outward"`, for drawing one square large ([below](#a-tablet-as-pyramids)) |
| `chakras/Chakras` | The seven chakras, in their colours, on the outline of a body |
| `astrology/Kamea` | A planet's kamea, its magic square |
| `astrology/KameaSigil` | A name's sigil traced on its planet's kamea, a figure per word on its own square, wrapping (`KameaSigil`), or in one row in one `<svg>` for a download (`KameaSigilImage`), with no hooks; `kameaSigil()` works it out without drawing and says whether placement left a word failing |
| `astrology/PlanetarySeal` | A planet's seal after Agrippa (1533), on the bare page or on a silver plate |
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

## A hall on your page

`GdHall` draws a Golden Dawn temple hall from its description: a tree of
nodes, `{type, …attributes, children}`, as the presets are.

```tsx
import { GdHall } from "magick-components/gd/hall";
import { neophyte } from "magick-components/gd/hall/presets";

export const Neophyte = () => <GdHall hall={neophyte.hall} />;
```

`GdHall` and `validateHall()` take a `HallNode`, which is lenient: a
hall a ritual stores may hold anything, and draws what it can. To write
a hall in code, type it with the strict node types, one per tag
(`GdHallNode`, `FloorNode`, `OfficerNode` …), as the presets are typed.
TypeScript then checks much of what the validator checks: which tag may
stand where, the values each attribute takes, and the values a tag needs
(an officer's `role`, an item's `kind`, a caption's `text`, a door's
place along its wall). It leaves the rest to the validator: ranges,
numbers that are not finite (`NaN`, `Infinity`), whole numbers where
one is needed (a tarot key's `n`), letter names (an empty `letter`
included), the length of text, and the hall's bounds (24 deep, 4000
nodes). They are type aliases, so any strict node is a `HallNode`:

```tsx
import { GdHall, type GdHallNode } from "magick-components/gd/hall";

const hall: GdHallNode = {
  type: "gdHall",
  children: [
    {
      type: "floor",
      children: [
        { type: "pillar", kind: "black", x: 4, y: 3 },
        { type: "pillar", kind: "white", x: 12, y: 3 },
        {
          type: "altar",
          at: "center",
          children: [{ type: "item", kind: "cross", form: "calvary" }],
        },
        { type: "officer", role: "hiereus", x: 8, y: 14 },
        { type: "door", side: "north", y: 12 },
      ],
    },
    { type: "caption", text: "A hall" },
  ],
};

export const Hall = () => <GdHall hall={hall} />;
```

The floor is 16 squares each way, `x` running North to South and `y`
East to West, with the dais beyond its East edge. The strict types
offer only the vocabulary's spellings, `center` and `gray`, which
stored halls may also write `centre` and `grey`. An item takes only its
kind's attributes (`form` on a cross, `light` on a lamp or a lantern);
as anywhere in TypeScript, only an object literal is checked for one it
does not take. A hall that uses a tag or an item kind your own art adds
is a `HallNode`.

`validateHall()` checks any hall, typed or stored, and returns what it
finds; it never throws. Give it the art you draw with: without it, what
the art adds is unknown to it: the tags (`tarotKey`, `tablet`, `kamea`
…), the item kinds `pantacle` and `lightning`, a light's `light`, an
officer's `grade` and a tablet's `element`, `version`, `reversed` and
`alt`.

```ts
import { DEFAULT_HALL_ART, validateHall } from "magick-components/gd/hall";
import { neophyte } from "magick-components/gd/hall/presets";

export const diagnostics = validateHall(neophyte.hall, {
  art: DEFAULT_HALL_ART,
});
```

### A hall written as tags

The same halls can be written as JSX, with the tags of
`gd/hall/tags`, one per tag of the description, as `GdHall`'s children.
The hall's own attributes (`wall`, `dais`, `compass`, `padding`,
`labelSize` and the margins) are then `GdHall`'s props. A `GdHall`
takes `hall` or tags, never both. The Neophyte preset, written so:

```tsx
import { GdHall } from "magick-components/gd/hall";
import * as Hall from "magick-components/gd/hall/tags";

const DAIS = [
  "imperator",
  "cancellarius",
  "hierophant",
  "pastHierophant",
  "praemonstrator",
] as const;

export const Neophyte = () => (
  <GdHall wall="gradient">
    <Hall.Dais>
      {DAIS.map((role) => (
        <Hall.Officer key={role} role={role} />
      ))}
    </Hall.Dais>
    <Hall.Floor>
      <Hall.Banner kind="east" x={9.57} y={-0.06} />
      <Hall.Pillar kind="black" x={4} y={3} glow />
      <Hall.Officer role="hegemon" x={8} y={3} labelPos="top" />
      <Hall.Pillar kind="white" x={12} y={3} glow />
      <Hall.Altar at="center">
        <Hall.Item kind="cross" y={-0.36} />
        <Hall.Item kind="triangle" y={0.24} />
        <Hall.Item kind="rose" at="east" x={0.08} />
        <Hall.Item kind="salt" at="north" y={-0.3} />
        <Hall.Item kind="bread" at="north" x={0.05} y={0.34} />
        <Hall.Item kind="lamp" at="south" />
        <Hall.Item kind="cup" at="west" y={0.1} />
      </Hall.Altar>
      <Hall.Officer role="stolistes" x={1.05} y={8} labelPos="bottom" />
      <Hall.Officer role="dadouchos" x={14.75} y={8} labelPos="bottom" />
      <Hall.Platform x={8} y={14.5} w={4} h={3}>
        <Hall.Officer role="hiereus" labelPos="top" />
      </Hall.Platform>
      <Hall.Banner kind="west" x={4.8} y={14.3} />
      <Hall.Officer role="keryx" x={14} y={15} labelPos="top" />
      <Hall.Door x={14} width={2} />
      <Hall.Officer role="sentinel" x={14} y={17.15} labelPos="bottom" />
    </Hall.Floor>
    <Hall.Caption text="Neophyte Temple" />
  </GdHall>
);
```

`GdHall` reads the tags; they render nothing themselves. The rules:

- **Tags and Fragments only.** A component of your own inside a hall is
  not drawn: `GdHall` cannot see what it would render. Write a shared
  piece as a function and call it in braces, `{pillars()}`. `null`,
  `undefined` and booleans are skipped, so `{grade > 0 && <Hall.Veil />}`
  and `.map()` work; text is a prop (`text`), and text or numbers as
  children do not compile.
- **The props are typed, the nesting is not.** Each tag takes its
  node's attributes, as strictly as the strict node types do, but JSX
  gives every element one type, so TypeScript cannot tell an altar on
  the dais from one on the floor: `validateHall()` does. For the same
  reason a hall built from tags is a `HallNode`.
- **Build the hall where `GdHall` runs.** Tags passed through a client
  component's props arrive as `null`, and the hall draws empty. A
  Server Component that hands a hall to a client component hands it
  the data, `hallFromTags(<GdHall …>…</GdHall>).hall`, which takes the
  root's attributes from that `GdHall` and ignores what only draws
  (`width`, `className` …). Its `diagnostics` list what it dropped: a
  dropped child has no node, so each names its parent's `path` and,
  as `child`, its place among the parent's children as written.
- **Warnings are for development.** When `process.env.NODE_ENV` is not
  `production`, `GdHall` warns about each child it dropped, about tags
  that gave no hall at all, and about `hall` given with children or
  with root attributes, which it ignores; a tag warns when React
  renders it, outside a `GdHall` or across a client boundary. Where
  `process.env.NODE_ENV` cannot be read at all, as on a page loaded
  without a bundler, they stay silent. From a Server Component the
  warnings appear in the server's terminal, not the browser's console.
  Each message is given once per process, so a long-running development
  server repeats none until it restarts.
- **Keys are optional.** React does not ask for keys on tags in an
  array, since it never renders them; Biome's `useJsxKeyInIterable`
  still does.
- **One error reads oddly.** A `GdHall` given both `hall` and children
  reports that `GdHallNode` is not assignable to `undefined`: the
  children chose the tags form, which takes no `hall`.

Your own art's tags and item kinds get tags of their own, typed by the
props you give them; a hall that uses them is a `HallNode`:

```tsx
import { GdHall, type HallNode } from "magick-components/gd/hall";
import * as Hall from "magick-components/gd/hall/tags";

// A node type your art registers as `serpentTree`, and an item kind it
// registers as `item:sistrum`.
const SerpentTree = Hall.defineHallTag<Hall.HallPlaced & { coils?: number }>(
  "serpentTree",
);
const Sistrum = Hall.defineHallItem<{ metal?: "gold" | "silver" }>("sistrum");

export const { hall, diagnostics } = Hall.hallFromTags(
  <GdHall>
    <Hall.Floor>
      <SerpentTree coils={3} at="center" />
      <Sistrum metal="gold" x={4} y={12} />
    </Hall.Floor>
  </GdHall>,
);
export const same: HallNode = hall;
```

`<Sistrum metal="gold" x={4} y={12} />` is `{type: "item", kind:
"sistrum", metal: "gold", x: 4, y: 12}`. Besides the tags, `Hall.`
offers `defineHallTag`, `defineHallItem` and `hallFromTags`.

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

## The rose sigil

`RoseSigil` and `RoseSigilImage` draw a sigil by the Golden Dawn's rules
for the rose (*The Golden Dawn*, vol. 4, 1940, p. 57): a circle at the
first letter, straight lines letter to letter, a crook where a letter is
doubled, a noose where the line passes straight through a letter of the
name, and a bar at the last. Each word is its own sigil, side by side
from right to left. The points are placed by rule, with only arithmetic
and square roots on coordinates rounded to 0.001, so the server and
every browser draw the same figure and nothing waits on the client.
Text that is not Hebrew is left out of the sigil, and final forms are
drawn as their base letters.

`RoseSigilImage`'s `points` prop is deprecated: given, the sigil is drawn
through those points by the old rules, as one word. The optimiser that
made such points, `optimizeSigilPoints` (`gd/roseSigilOptimizer`, on
[nlopt-js](https://www.npmjs.com/package/nlopt-js)), is gone as of 0.4.0,
and with it the need to stub out Node's `fs` in a browser bundle.

The rose has two versions, which differ in where Kaph and Tau stand on its
middle ring: the Golden Dawn's, as *The Equinox* printed it (`gd`, the
default), and Regardie's of 1939 (`version="regardie1939"`).
`ROSE_VERSION_NOTES`, from `gd/roseSigilGeometry`, names each and says
where it comes from.

### The sigil's styles

`gd/roseSigilStyles` draws a one-word sigil as a finished figure, in the
rose's 100-unit box, so that a style never changes the figure's size:

- `band`: inside a ring, the Hebrew name at the top of the band, tops
  outward, and the roman name upright at the bottom, after the angels'
  names round a pentacle in Mathers's *Key of Solomon* (1889), Plate IV,
  Fig. 18;
- `bare`: alone, the roman name beneath in capitals, as Regardie prints
  the Golden Dawn's own sigils (*The Golden Dawn*, vol. 4, 1940, p. 58);
- `talisman`: inside a ring lettered with a verse, clockwise from a cross
  at the top, tops outward, the Hebrew name inside, as Lenain describes a
  genius's talisman (*La Science cabalistique*, 1823, p. 45);
- `rose`, the sigil on the rose, is `RoseSigilImage`'s.

```tsx
import { StyledRoseSigilImage } from "magick-components/gd/roseSigilStyles";

export const Vehuiah = () => (
  <StyledRoseSigilImage
    text="והויה"
    sigilStyle="talisman"
    legend="Et tu Domine susceptor meus et gloria mea et exaltans caput meum"
    aria-label="A talisman of Vehuiah"
  />
);
```

The sigil is centred on its ink's bounds and scaled to its field, its
line 1 unit wide at every scale. Every letter is its own `<text>`, placed
and turned from measured advances, so no renderer's text layout decides
where a letter goes or in what order. The verse is set in capitals by a
fixed table, accents and ligatures kept, with its punctuation and without
a final full stop, whose place the cross takes (`sigilStyleLegend()`),
at the largest size up to a cap at which it fills the ring.
`SIGIL_STYLE_NOTES` says where each style comes from and what is ours.

The letters are measured in two faces, and the markup asks for each by
its own family name, weight and style (`SIGIL_STYLE_FONTS`): upright Noto
Serif Regular (400) and Frank Ruhl Libre Bold (700), as the repository's
`scripts/gd-hall-fonts/build.py` subsets them from google/fonts at the
commit [fonts/SOURCES.md](./fonts/SOURCES.md) names.

- **The Hebrew** is the hall's own subset, which the package ships:
  `fonts/FrankRuhlLibre-Bold-letters.woff2`, declared in
  [fonts/gd-hall.css](./fonts/gd-hall.css) under the family name
  "GdHall Frank Ruhl Libre". With that stylesheet on the page, pass
  `hebrewFamily="GdHall Frank Ruhl Libre"`.
- **The roman letters and the verse** need upright Noto Serif Regular,
  which the package does **not** ship. The hall's Noto Serif in
  `gd-hall.css` is italic, under "GdHall Noto Serif", and is no
  substitute: the letters are placed by the upright face's advances, so
  an italic or another serif draws them at the wrong widths. Supply the
  upright face yourself, to the page (an `@font-face` for "Noto Serif",
  weight 400, `font-style: normal`) or to your renderer, or name it with
  `latinFamily`. The repository's server-side images use its TrueType
  subset, `assets/fonts/NotoSerif-Regular-latin1.ttf`, built by the
  same script from the same commit.

Another build of either face may set the letters differently. A character
outside the subsets (Latin-1, and the 22 Hebrew letters with their final
forms) is refused.

### A sigil on your own layout

The rules know nothing of the rose. A layout (`SigilLayout`, from
`sigil/types`) says where each token is drawn and how far a visit may
stray from its place; a profile says how the rules are tuned (how close
to a line a letter must lie to be "passed through", the marks' sizes).
`sigil/SigilImage` draws any text on any layout, the rose among them:

```tsx
import { ROSE_SIGIL_PROFILE, roseSigilLayout } from "magick-components/gd/roseSigilLayout";
import { SigilImage } from "magick-components/sigil/SigilImage";

export const Sigil = ({ text }: { text: string }) => (
  <SigilImage text={text} layout={roseSigilLayout()} profile={ROSE_SIGIL_PROFILE} />
);
```

`planSigil()` and `placeSigil()` are the two steps it takes, for a page
that draws the figure its own way: the plan says what each vertex is
(its place, which visit to that place, its crooks and its marks), and
placement says where it is drawn.
`sigil/ink` is the third step, the renderer: `wordInk()` turns a placed
word into its marks and strokes, `sigilSubpaths()` into SVG path data in
drawing order, and `sigilFrame()` and `sigilViewBox()` say where words
sit; `DEFAULT_SIGIL_MARKS` are the mark sizes a profile can change.

Placement checks every figure against the figure grammar (strokes kept
apart, marks clear of other ink, corners that show, unbent nooses) and
moves vertices until it passes. Words of up to 12 letters are the domain
this is tested on, and nearly all of them pass. Longer words, and a few
hard shorter ones, are drawn best effort: `sigilFigure()` returns, in
`failures`, what each word still fails (empty when every mark stands
clear), `placeSigilWords()` the same per placed word, and
`wordFailures(word, layout, profile)` judges any placed word, so a page
can say when a figure may be hard to read.

Placement keeps the words it places, keyed by the layout and profile
objects themselves, and hands them out frozen. So give it a layout or
profile that does not change after first use; to change one, make a new
object.

### A sigil on a kamea

`astrology/KameaSigil` traces a name on its planet's magic square by the
method Regardie sets out in *The Golden Dawn*, vol. 4 (1940), pp. 78–80:
each letter reduced by Aiq Bekar to a number the
square holds (`sigil/kameaLayout`), the line drawn from cell to cell
with the rose's marks. Each word is its own figure on its own square,
set right to left and wrapping on a narrow screen; `KameaSigilImage`
draws the same figures in one row, one `<svg>`, for a download:

```tsx
import { KameaSigil } from "magick-components/astrology/KameaSigil";

export const Agiel = () => <KameaSigil planet="saturn" text="אגיאל" />;
```

`finals` counts final forms at Aiq Bekar's 500 to 900; `ink`,
`squareInk` and `paper` colour the sigil, the square and its ground, for
a dark theme too. A figure is never drawn smaller than its square needs
for the marks to show (`kameaSigilMinSize()`: 240 pixels a word on the
smaller squares, 256 on Venus', 292 on Mercury's and 329 on the Moon's),
and `size` larger is taken as asked. Placement keeps strokes off the
square's rules and frame (a stroke along a rule for more than a cell
could be in either column) and, for a word it cannot otherwise clear, tries seeded
random starts, the same in every engine. A word that still fails is
drawn best effort and marked `data-placement="failed"`; `kameaSigil()`
gives the figure and `failed` for the page to say so.

## A tablet's highlights

`Tablet` draws over a Watchtower's grid what `highlights` asks for, one
layer at a time, so the letters, the Enochian font and the mirrored
letters are untouched and an export draws what is shown. None of it is
drawn with dashes. A name's squares are given in reading order, as
magick-data's `enochian/tabletNames` gives them (from its next release);
here Earth's Senior Laidrom, read leftward along the seventh row:

```tsx
import Tablet from "magick-components/enochian/Tablet";

// Row 7 from the centre to the edge, counting rows and columns from 0.
const laidrom = [6, 5, 4, 3, 2, 1, 0].map((column) => ({ row: 6, column }));

export const ChosenSenior = () => (
  <Tablet
    tablet="earth"
    highlights={{
      // No squares outlined.
      squares: [],
      // The rest dimmed, the name outlined, its first square flagged and
      // each numbered in its bottom left corner.
      name: {
        squares: laidrom,
        numbers: laidrom.map((_, index) => index + 1),
      },
      // The Great Cross and the Calvary crosses tinted, the top rows
      // hatched.
      regions: true,
    }}
  />
);
```

`preview` rings a name's squares without dimming the rest, for a name
under the pointer; `squares` (always given, `[]` for none) and `selected`
outline squares as before;
and `onSelect` is called for a square clicked, an outlined one, or any
with `anySquare`. Leave out `numbers` where the squares are too small to
read them. The pointer is a shortcut only: offer the same choices in a
list for keyboards and screen readers.

The Tablet of Union (`tablet="union"`) takes the same highlights over
its five by four squares, counted from 0 as its rows are: a line
(`{ row: 0, column }` for EXARP) or its first column. It has no
regions, so `regions` draws nothing there.

## A tablet as pyramids

The Golden Dawn treats every square of the tablets as a truncated
pyramid: four sides, each with an element, round a flat top that holds
the letter. `pyramids` draws every square so, its sides in their
elements' colours (Fire red, Water blue, Air yellow, Earth black,
Spirit white, and white for a Calvary square's lowest side, which
carries its Sephirah), from magick-data's `enochian/tabletPyramids`:

```tsx
import Tablet from "magick-components/enochian/Tablet";

export const FireAsPyramids = () => <Tablet tablet="fire" pyramids />;

// The Union's tops a quarter of the square, as the Equinox's plates draw them.
export const UnionQuarterTops = () => (
  <Tablet tablet="union" pyramids pyramidTop={0.25} />
);

// Each side's symbol on it, standing on its side's outer edge, as Regardie's drawings (vol. 4) have them.
export const FireWithSymbols = () => (
  <Tablet tablet="fire" pyramids pyramidSymbols="outward" />
);
```

The top is half the square unless `pyramidTop` gives another share
(from 0.2 to 0.8). Thin grey lines part the sides, so two black Earth
sides never run together. The colours are exported as
`PYRAMID_COLOURS` for a key beside the drawing. Second letters are not
drawn; the highlights, the regions' tints among them, are drawn over
the pyramids as over the flat squares. Dee's and Raphael's tables carry
no elements, so in their versions the tablet is drawn flat.

`pyramidSymbols` draws each side's symbol in the middle of its side, in
the side's complementary colour (Regardie, *The Golden Dawn*, vol. 4
(1940), p.295) with a thin outline: its sign, the Sephirah's number,
its planet, its Hebrew letter or its geomantic figure, whichever it
carries first in that order, and otherwise its element's mark.
`"outward"` stands each on its side's outer edge with its head toward
the top, as Regardie's drawings have them (vol. 4, pp.294 and 296), so
that the top side's symbol is upside down on the page (we take a face
to be read from outside the pyramid); `"upright"` stands them all
upright on the page, as *The Equinox* I(7)'s plates draw them. Which
way the Order itself painted them, these two witnesses do not settle. The turns are exported
as `PYRAMID_SYMBOL_TURNS` from `enochian/pyramidMarks`, by side. The top is then a
third of the square (`PYRAMID_TOP_SYMBOLS`) unless `pyramidTop` says
otherwise. The signs and planets are Unicode symbols drawn as text,
which a font such as Noto Sans Symbols and Symbols 2 must set; the
Hebrew letters ask for Frank Ruhl Libre, then Noto Sans Hebrew.

`enochian/pyramidMarks` holds the marks, for a page that draws one
square large: `sideSymbol(side)` says which symbol a side of
magick-data's `tabletPyramids` shows, `SideMark` draws it centred on
0, 0 in a box of about 34 units, `inksOf(side)` and
`PYRAMID_SYMBOL_INKS` give its colour and outline, `MARK_OUTLINES`
and `TABLET_MARK_OUTLINES` the outlines' widths, large and small, and
`PYRAMID_SYMBOL_TURNS` how each side's mark is turned for `"outward"`;
`asText(symbol)` asks for a symbol's text presentation (U+FE0E), so that
no browser draws a sign as an emoji.

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

- **Ink, on the page.** A planet's seal on the bare page is drawn in
  `currentColor`, the text's colour, so it follows your colour scheme;
  `ink` gives it another, set as a style, so it may be your theme's custom
  property. On the silver plate (`look="plate"`) it is black on silver
  unless you pass `ink` and `plate`.
- **Ink, where it is not black.** The fylfot cross borders its squares,
  and a planetary spirit's sigil is drawn, in black unless you pass `ink`,
  a CSS colour such as your theme's custom property
  (`ink="var(--my-ink, black)"`), as magick.ly does for the cross in its
  dark mode. The sigil's path keeps its `stroke="#000"` attribute, which
  your stylesheet may select, and takes `ink` as its style, which wins.
- **Labels.** `label` means one thing wherever a drawing takes it
  (`Tablet`, `Kamea`, `PlanetarySeal`). Not given, the drawing is an image named for what
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
candidate 0.1.0-rc.0, was published by hand.

0.2.0 adds the strict hall node types and changes three things, as a
0.x minor may:

- `HallPreset.hall` narrows from `HallNode` to `GdHallNode`, which is
  still a `HallNode`. Code that reads an attribute off a preset's nodes
  by name (`preset.hall.children?.map((c) => c.x)`), or assigns a
  `HallNode` to `preset.hall`, stops compiling; widen the hall first:
  `const hall: HallNode = preset.hall`.
- The Neophyte preset's altar is `at="center"`, no longer
  `at="centre"`; the two draw the same.
- `validateHall()` reads an attribute or `children` set to `undefined`
  as absent, as the layout does: it reports fewer problems, never more.

0.3.0 adds the hall tags, `gd/hall/tags`, and `GdHall`'s tags form.
`GdHallProps` is as it was, the `hall` form's props, and `GdHall`
takes `(GdHallProps & { children?: never }) | GdHallTagsProps`, where
`GdHallRenderProps`, the props that only draw, is `GdHallProps` without
`hall`. A wrapper that extends, destructures or forwards `GdHallProps`
still compiles. One that hands `GdHall` children of its own, which
0.2.0 ignored, no longer does: children now mean tags, so leave them
out of what reaches `GdHall`.
`ComponentProps<typeof GdHall>` is now that union, in which `hall` may
be missing: code that types its props so and destructures `hall`, reads
it as a `HallNode`, or leaves a prop out with `Omit` (which flattens a
union) no longer compiles. Name the form instead: `GdHallProps`, or
`Omit<GdHallProps, …>`, for the `hall` form, and `GdHallTagsProps` for
tags. In
development, `GdHall` and the tags warn on the console as above, the
package's first reading of `NODE_ENV`; in production they stay
silent. That includes `<GdHall hall={hall} />` while `hall` is still
`undefined` (data loading, say): it draws the empty hall it drew
before, and now warns that it did.

0.3.1 mends three edge cases. `hall={null}`, which only JavaScript
(or TypeScript without `strictNullChecks`) can write, counts as no
`hall` in `GdHall` and in `hallFromTags`: `GdHall` draws its tags with
its root attributes, or warns of an empty hall as it does for
`undefined`. `hallFromTags` given a `GdHall` imported through a
`"use client"` module says so. And `GdHall` given `hall` with root
attributes warns in development that it ignores them: a literal
`<GdHall hall={…} wall="plain" />` does not compile, but a wrapper
whose props extend `GdHallProps` with `wall` or `padding` and spread
them into `GdHall` does, and now hears of it.

0.4.0 draws the rose sigil by rule (plan 088 in the repository): a
crook per repeated letter, a noose only where the line passes straight
through a letter, revisits drawn beside the first visit, and each word
of the text its own sigil, side by side; the server and every browser
draw the same figure, with nothing to wait for. Every sigil's drawing
changes. The engine is exported for layouts of your own (`sigil/types`,
`sigil/planSigil`, `sigil/placeSigil`, `sigil/ink`, `sigil/SigilImage`,
`gd/roseSigilLayout`). It removes `gd/roseSigilOptimizer` and its
`optimizeSigilPoints()`, and the `nlopt-js` dependency with them: an
import of that entry no longer resolves, and a bundler no longer needs
`fs` stubbed out for the sigil. `RoseSigilImage`'s `points` prop still
draws given points by the old rules, and is deprecated.

0.5.0 gives `enochian/Tablet` its highlights (see
[A tablet's highlights](#a-tablets-highlights)): `highlights` keeps
`squares`, `selected` and `onSelect`, and adds `name` (the rest of the
tablet dimmed, the name's first square flagged and its squares
optionally numbered), `preview` (a ring round each square), `regions`
(the Great Cross and the Calvary crosses tinted, the top rows hatched;
Watchtowers only) and `anySquare` (`onSelect` for a click on any
square). The Tablet of Union takes them too. With none of them set a
tablet draws exactly as before. It depends on magick-data 0.3.0.

0.6.0 adds the kameas' sigils and the planetary seals (plan 093 in the
repository). `astrology/KameaSigil` traces a name on its planet's
square (see [A sigil on a kamea](#a-sigil-on-a-kamea)), on
`sigil/kameaLayout`: the square as a sigil layout, its letters reduced
by Aiq Bekar, `KAMEA_SIGIL_PROFILE` with its rule against a stroke
running along a cell's rule and its seeded fallback, and
`kameaSigilMinSize()`. `astrology/PlanetarySeal` draws the seven seals
after Agrippa (1533), on the page or on a silver plate; the halls' seal
art now draws it, and Venus' and the Moon's plates are as they were.
`astrology/Kamea` also exports its rules' and frame's widths
(`KAMEA_RULE_WIDTH`, `KAMEA_FRAME_WIDTH`). For layouts of your own, the
engine takes new settings, each off unless set: a layout's `frame` and
`lines`, a profile's `strokeWidth`, and placement's `laneStarts`,
`lineRun` and `fallback`; `SigilImage` takes `strokeWidth`, `width`,
`height`, `className`, `style`, `role`, `aria-label`, `aria-hidden` and
`data-placement`. The rose sigil draws exactly as before. It depends on
magick-data 0.4.0.

0.7.0 adds the rose sigil's styles (plan 096 in the repository):
`gd/roseSigilStyles` draws a one-word sigil in a ring with its name,
alone with its name, or as a talisman with its verse (see [The sigil's
styles](#the-sigils-styles)), with no hooks, for the server. Its Hebrew
can use the shipped hall subset; its upright Noto Serif is not shipped,
and a browser must be given it. The rose
style stays `gd/RoseSigilImage`'s. `astrology/KameaSigilImage` takes
`columns`, setting a name of several words in rows. The rose sigil draws
exactly as before. It depends on magick-data 0.5.0.

0.8.0 adds `pyramids` and `pyramidTop` to `enochian/Tablet` (see
[A tablet as pyramids](#a-tablet-as-pyramids), plan 095 in the
repository) and exports `PYRAMID_COLOURS` and `PYRAMID_TOP`. Without
`pyramids` a tablet draws exactly as before. It depends on magick-data
0.5.0, the first with `enochian/tabletPyramids`.

0.9.0 adds `pyramidSymbols` to `enochian/Tablet`, which draws each
side's symbol on the pyramids, facing out from the top or upright, on
a top a third of the square (`PYRAMID_TOP_SYMBOLS`, exported) unless
`pyramidTop` says otherwise (see [A tablet as
pyramids](#a-tablet-as-pyramids), plan 095 in the repository), and a
new entry, `enochian/pyramidMarks`, with the marks, for drawing one
square large. Without `pyramidSymbols` a tablet draws exactly as
before. It depends on magick-data 0.5.0, as 0.8.0 did.

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
| The planetary spirits' sigils (`astrology/PlanetarySpirit`) | Our own drawings of 13 November 2026 after John Heydon, *Theomagia*, vol. 1 (London, 1663/4), book I, ch. V, pp. 13 and 15 (archive.org `theomagiaortempl00heyd`, leaves n124 and n126): a few strokes of one width placed by eye over the scan, not traced. They replace tracings of a 1994 printing in copyright, which the repository's history keeps and the package does not | 2026-11-14 |
| The Enochian tablets' letters (`enochian/Tablet`) | magick-data's `enochian/tablets.json5`, in each tradition's reading, signed off in its Sources; the tablet draws them as text. The highlights drawn over the squares (a ring, a veil, a flag, order numbers, the regions' tints and hatching) are our own, drawn in code. The squares drawn as pyramids are our drawing after the Golden Dawn's rule for one square (Regardie, *The Golden Dawn*, vol. 4 (1940), pp.291–296): the sides' elements from magick-data's `enochian/tabletPyramids`, coloured as p.294 gives them, and the flat top's size, the grey lines and the white top ours | 2026-11-23 |
| The pyramids' symbols (`enochian/pyramidMarks`, `enochian/Tablet`) | Drawn in code. Each side shows one of the attributions magick-data's `enochian/tabletPyramids` gives it, after Regardie, *The Golden Dawn*, vol. 4 (1940), pp.293–298: a sign's or planet's Unicode symbol, a Sephirah's number or a Hebrew letter, set as text, or a geomantic figure's dots from its rows; where it carries none of these, its element's triangle or Spirit's wheel, our own marks. The complementary colours are p.295 (archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaf n287); the symbols' facing for `"outward"`, each standing on its side's outer edge, is Regardie's drawings on p.294 (leaf n286) and p.296 (leaf n288), and `"upright"` is how *The Equinox* I(7) (1912), Plates IV–VIII (archive.org `crowley-equinox_202110`, "The Equinox Vol. 1, No. 7", leaves n242–n246) draw them. Which symbol a side shows where it carries several, the outlines and the sizes are ours. The facing was corrected on 2026-11-26 (plan 095); that correction awaits the owner's sign-off, and the date beside this row is the earlier one | 2026-11-24 |
| The Watchtowers' sigils (`enochian/Tablet`) | Drawn in code from lines, arcs and curves. The plain sigils, and the form of Air's in colour, after *The Equinox* I(7) (1912), Plate X (archive.org `crowley-equinox_202110`, "The Equinox Vol. 1, No. 7", leaf n256); the coloured Water and Fire sigils from Regardie's description, *The Golden Dawn*, vol. 4 (1940); Earth's a cross in four colours | 2026-11-14 |
| The Air sigil's four Yods (`enochian/Tablet`) | Regardie, *The Golden Dawn*, vol. 4 (1940), p. 307 (archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaf n299) describes a Tau with four Yods above it; drawn as small flames after Plate X (above), hand-placed curves in code, not traced. That the Yods stand for the 4 over the T of Dee's Sigillum Dei Aemeth (*The Equinox* I(7), Plate II, leaf n238) is our inference, not a source's. They replace two fonts' glyphs, which the repository's history keeps | 2026-11-14 |
| The planetary seals (`astrology/PlanetarySeal`) | Our own drawings, geometry in code, after the woodcuts of Agrippa, *De occulta philosophia* (Cologne, 1533), book II, ch. 22 (archive.org `DeOccultaPhilosophiaLoc1533`, the Library of Congress copy): Saturn and Jupiter p. CXLIX (leaf n164), Mars and the Sun p. CL (n165), Venus p. CLI (n166), Mercury p. CLII (n167), the Moon p. CLIII (n168). Each seal's lines, circles and arcs were measured on the leaf and made clean where the cutter's hand wandered, as the component's comments say seal by seal; nothing is traced and no image of the book is in the package. The silver plate is our reading of the chapter's text (leaf n162) | 2026-11-21 |
| The kameas (`astrology/Kamea`) | A grid drawn in code around magick-data's squares (`magick-data/astrology/kameas`), which are Agrippa's, *De occulta philosophia* (Cologne, 1533), book II, ch. 22, pp. CXLIX–CLIII (archive.org `DeOccultaPhilosophiaLoc1533`, leaves n164–n168), checked cell by cell; where the 1533 printing repeats a number (Venus, row 4: 45 for 43, which its Hebrew table gives; the Moon, row 1: 45 for 54) the square has the number that makes it magic | 2026-11-14 |
| A sigil traced on a kamea (`sigil/kameaLayout`) | Drawn in code. The rose-cross sigil's engine (its row below), over the cells of magick-data's squares (Agrippa's, as the row above says); each letter is reduced to a cell by Aiq Bekar, the Qabalah of Nine Chambers (`magick-data/astrology/aiqBekar`), by the rule and the two worked examples in Regardie, *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940), pp. 78–80 (archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaves n72–n74), from which only the method is taken | 2026-11-20 |
| A name's sigil on its kamea (`astrology/KameaSigil`) | Drawn in code: the sigil traced on a kamea (`sigil/kameaLayout`, the row above) over the square `astrology/Kamea` draws (two rows above), a figure per word on its own square | 2026-11-21 |
| The rose-cross sigil (`gd/RoseSigil`, `gd/RoseSigilImage`, `gd/roseSigilGeometry`, `gd/roseSigilLayout`, `sigil/types`, `sigil/planSigil`, `sigil/placeSigil`, `sigil/ink`, `sigil/SigilImage`) | Drawn in code. The rose's construction, three rings of letters at equal angles, is Gadi Cohen's original geometry, written out in `gd/roseSigilGeometry`, and the sigil is planned and placed over it by rule, our code, after the rules Regardie gives in *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940), p. 57 (archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaf n51), from which only the rules are taken. The order of the letters is in two versions. The Golden Dawn's (`gd`, the default) is the figure Crowley printed in *The Equinox* I(3) (1910), Diagram 63, plate facing p. 210 (archive.org `crowley-equinox_202110`, "The Equinox Vol. 1, No. 3", leaf n220), and the colour key to the rose in "The Complete Symbol of the Tarot", *The Equinox* I(8) (1912), plate facing p. 145 (the same item, "The Equinox Vol. 1, No. 8", leaf n174). Regardie's (`regardie1939`), which exchanges Kaph and Tau, is *The Golden Dawn*, vol. 3 (Aries Press, Chicago, 1939), p. 53 and Diagram 20, p. 56 (archive.org `IsraelRegardie-TheGoldenDawn-Vol3-1939`, leaves n46 and n49) | 2026-11-19 |
| An angel's sigil in its styles (`gd/roseSigilStyles`) | Drawn in code: the rose-cross sigil (its row above), moved into a ring or a box and lettered. The band follows the angels' names written round a pentacle in S. L. MacGregor Mathers, *The Key of Solomon the King* (London, 1889), Plate IV, Fig. 18, and its note, p. 61 (archive.org `b24884431`, the Wellcome Library copy, leaves n79 and n80). The bare style follows the Golden Dawn's sigils of Metatron and Elohim in Regardie, *The Golden Dawn*, vol. 4 (Aries Press, Chicago, 1940), p. 58 (archive.org `IsraelRegardie-TheGoldenDawn-Vol4-1940`, leaf n52), from which only the form is taken. The talisman letters the verse Lenain says is written round each genius's talisman, *La Science cabalistique* (Amiens, 1823), pp. 45 and 70 (Google Books `qt9SAAAAcAAJ`), as his title page's talisman is lettered (copied in Ms 5365, archive.org `BIUSante_ms05365`, leaf n2), with the name inside after Mathers's Figs. 20 and 21 (leaf n79; notes pp. 61–62, leaves n80–n81). The rings, the cross, the fit and the lettering's sizes are ours; the faces are Noto Serif and Frank Ruhl Libre (SIL OFL 1.1), which the package does not ship | 2026-11-23 |
| The temple halls' art (`gd/hall`, `gd/hall/presets`, `gd/hall/tags`, `gd/hall/editor`) | Our own art, in code. The halls' layouts are facts from Regardie, *The Golden Dawn*, vol. 2 (Aries Press, Chicago, 1938), cited for each hall by page and archive.org leaf (`IsraelRegardie-TheGoldenDawn-Vol2-1938`); no drawing of his is copied. The planets' seals are `astrology/PlanetarySeal`'s, after Agrippa's woodcuts (1533; its row above), on a silver plate. Each art records its source in its `provenance` | 2026-11-21 |
| The halls' fonts (`fonts/*`) | Subsets of Noto Serif and Frank Ruhl Libre under the SIL Open Font License 1.1, made from google/fonts at a pinned commit; [fonts/SOURCES.md](./fonts/SOURCES.md) gives the files, their hashes and how they are made | 2026-11-14 |
| The Moon (`astrology/Moon`, `astrology/MoonWidget`) | The paths of the lit part and the disc adapt `phase_junk()` from moon-phase, Copyright © 2012 Regents of the University of California, under the BSD 3-Clause License, at a pinned commit (see [Licences](#licences)); the phase comes from lune (Apache-2.0, a dependency). The tile draws no picture of its own | 2026-11-14 |
| Mercury's retrogrades (`astrology/MercuryWidget`, `astrology/mercuryRetrograde`) | Our code, MIT, computing the stations with astronomy-engine (MIT, a dependency). The tile draws no picture of its own: the planet's is the page's | 2026-11-14 |
| The Tree of Life and the Grade Tree (`kabbalah/TreeOfLife`, `kabbalah/fieldPath`, `gd/GradeTree`) | Drawn in code, original geometry: four equal circles through each other's centres (Kether, Daath, Tiphareth, Yesod), the side spheres at their crossings. Its proportions agree with the Order's own Tree, "The Minutum Mundum", in Regardie, *The Golden Dawn*, vol. 1 (Aries Press, Chicago, 1937), plate facing p. 191 (archive.org `IsraelRegardie-thegoldenDawn-vol1-1937`, leaf n182), and the six spheres round Tiphareth are the hexagram of vol. 2 (1938), p. 195 (archive.org `IsraelRegardie-TheGoldenDawn-Vol2-1938`, leaf n188). The arrangement of spheres and paths is Kircher's, *Oedipus Aegyptiacus* II.1 (1653) (Wikimedia Commons, File:Tree of Life (Kircher 1653).jpg). We found no source describing the circle construction itself. Labels and colours come from magick-data's sephirot and paths | 2026-11-14 |
| The lamens (`gd/Lamen`, `gd/lamenGrades`) | Drawn in code from geometry, nothing traced. The officers' lamens and their colours are facts from Regardie, *The Golden Dawn*, vol. 3 (Aries Press, 1939), pp. 82–84 and 88–96 (archive.org `IsraelRegardie-TheGoldenDawn-Vol3-1939`, leaves n74–n76 and n80–n88); the Stolistes' cup follows the Cup of Stolistes, vol. 1 (1937), p. 138 (`IsraelRegardie-thegoldenDawn-vol1-1937`, leaf n128); the Portal's lamens are from vol. 2 (1938), p. 156 (leaf n149). The rings' colours, the Keryx's caduceus and the Sentinel's wedjat are our own; no 1937–40 source gives the Sentinel's design. `gd/Lamen`'s comment cites these pages and the modern works it compared | 2026-11-14 |
| The seven-branched candlestick (`gd/SevenBranchedCandlestick`) | Drawn in code, our own art; the planets, their letters and the angels' and spheres' names are magick-data's. Two versions. The default (`equinox1909`) is after *The Equinox* I(2) (1909), p. 265, Diagram 17 (archive.org `crowley-equinox_202110`, "The Equinox Vol. 1, No. 2", leaf n266), its lettering not traced; the seven churches of Asia are a table in the component that cites the figure. The modern arrangement (`modern`) has no public-domain source: Regardie, *The Golden Dawn*, vol. 2 (Aries Press, Chicago, 1938), p. 62 (archive.org `IsraelRegardie-TheGoldenDawn-Vol2-1938`, leaf n56) describes the lamps but not which planet stands where, and the order is a fact from the 2015 Llewellyn edition of Regardie's *The Golden Dawn*, nothing of which is copied; its angels are Agrippa's planetary angels | 2026-11-14 |
| The table of shewbread (`gd/TableOfShewbread`) | Drawn in code. The Zelator ritual describes it, Regardie vol. 2 (1938), pp. 60–61 (leaves n54–n55); its form is *The Equinox* I(2) (1909), p. 265, Diagram 16 (archive.org `crowley-equinox_202110`, "The Equinox Vol. 1, No. 2", leaf n266); the Kerubim and signs are placed by the elements' quarters, East at the top; the archangels' names, the permutations of the Name and the tribes are magick-data's, the last two after Crowley's *777* (1909), cols. CXL–CXLI | 2026-11-14 |
| The fylfot cross (`gd/FylfotCross`) | A table of squares in code after the Fylfot Cross of the Third Knowledge Lecture, Regardie, *The Golden Dawn*, vol. 1 (Aries Press, 1937), p. 131 (archive.org `IsraelRegardie-thegoldenDawn-vol1-1937`, leaf n122), which the Zelator ritual explains, vol. 2 (1938), p. 57 (leaf n51); the symbols are magick-data's and the arms' colours our own | 2026-11-14 |
| The chakras (`chakras/Chakras`) | The seated figure is an original drawing of 13 November 2026, hand-placed curves in code, nothing traced or adapted; it replaces a silhouette of unrecorded source, which the repository's history keeps. The chakras' places and colours are magick-data's `chakras.json5` | 2026-11-14 |
