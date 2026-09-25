# Entity pages

Assessment, design and decisions, 21–25 September 2026. Read
[current status](000-current-status.md) first. The design rests on
[plan 032](032-data-layer.md), whose barrel hands every page a row with its
links resolved, and closes the follow-up both that plan and
[plan 028](028-seo.md#follow-ups) deferred: the four pages that print a row
as JSON. Approved for implementation on 25 September.

Decision taken on 22 September: each of the four pages lays out its row's
correspondences by hand, in one order, as a Server Component, with every
value that has a page linked to it; the graph gains the back-links the pages
read; and a test holds each page to the whole of its row, so that a field
added to the data is a field a page has to decide about.

## Assessment (before)

`/astrology/planet/[id]`, `/gd/grade/[id]`, `/kabbalah/sephirah/[id]` and
`/kabbalah/path/[id]` each look their row up with `rowOf()`, 404 on an
unknown id, carry a search description built from their correspondences
([entities.ts](../src/seo/entities.ts)) and a social card, and then print
the row: `Object.keys(row)` mapped to a table of `JSON.stringify(decycle(…))`,
which is what the `cycle` dependency is still in `package.json` for. The
sephirah and path pages lay a few fields out first and dump the rest; the
planet and grade pages dump everything. So a reader of `/astrology/planet/luna`
sees `{"he":{"he":"שדי אל חי","roman":"Shaddai El Chai",…}}` beside `godName`,
and a search engine sees a description promising the god name and a page
that has it inside a JSON string.

What is wrong beyond the dump:

- The path page reads `hermetic.hebrewLetter.letter.mathers`, under a
  `@ts-expect-error: later`, and no letter has such a field, so every path
  prints `Aleph ("")`.
- The planet page shows the `kind` row step 3a added, `"planet"` or
  `"sphere"`, which is data for the types and not for a reader.
- Da'at prints `Chakra: None` beside a figure with nothing lit, and two
  empty rows for a scent and a stone that are `""`; the Tree above it is
  drawn without `showDaat`, so the sphere the page is about is not on it.
- The grade page prints `(no sephirah)` for Neophyte and the Portal where a
  tree should be, and `orderId`, `degreeId`, `prevId` and `nextId` as ids.
- Two colour names are misspelt in the data: Keter's King scale is
  `brillliance` and Da'at's Queen scale `lavendar`. Neither field is in any
  image contract ([plan 032, step 3b](032-data-layer.md#step-3b-1) hashes
  the web colours, not the names), so correcting them moves nothing.
- The sephirah and path pages are `"use client"` for the sake of styled-jsx,
  so their route chunks carry the whole barrel: the spike below counted 23
  JSON tables, `assemble.ts`, the Tree and the chakra figure in the sephirah
  route's client chunk, and the barrel's ids in its HTML twice over. The
  grade page is a Server Component but renders
  [GradeTree](../src/components/gd/GradeTree.tsx), a `"use client"` wrapper
  around the Tree that nothing needs to be one, so its route carries the
  barrel too.
- The angel page renders two `h1`s: `pathnames.kabbalah.angel` is a string,
  so the app bar takes "The 72 Angels" as the page's title and renders it as
  the heading, and [Angel.tsx](../src/app/kabbalah/angel/[slug]/Angel.tsx)
  renders its own. The four table routes have no `pathnames` entry and get
  one `h1` each, from the page.
- Seven planets carry a `magickTypes` string ("Career success and
  progression, establishing harmony, …") that the geomancy reading shows as
  a hint and nothing attributes. It arrived in one commit on 26 July 2024,
  `2f46a40`, with no source. Its wording is a modern intention table's:
  Agrippa's *Three Books of Occult Philosophy* (1533), Book I, catalogues the
  stones, plants, animals and body parts under each planet rather than
  operations, and the operations-by-planet lists descend from the grimoires'
  hour tables (the *Key of Solomon*, which the planetary hours page cites)
  through modern tables such as d'Este and Rankine's *Practical Planetary
  Magick* (2007), whose index of intentions phrases its entries as
  "Clairvoyance, developing" and "Glamour, developing". None of the
  phrases is findable verbatim. The attribution is the owner's to confirm.

What the data offers each page, and what it lacks, is the design's raw
material. Every link a row declares is present as an object (plan 032,
decision 4), and the derived back-links are these: `planet.sephirot`,
`element.zodiacs`, `element.tetragrams`. The pages want six more on the
planet and the letter, and two on the sephirah, none of which needs a JSON
edit except the last ([The data](#the-data)). `assemble()` already derives an
inverse from a list link and from a nested one, and the types derive the
accessor from the link's `inverse` name whatever its field is called; both
were proved on the real data by the review ([below](#adversarial-review)).

Two figures already draw on the server. The registry renders the Tree with
`renderToStaticMarkup`, and the grade tree is a `"use client"` wrapper around
it; whether the Tree renders inside a Next Server Component, under the RSC
runtime, with its guarded hook and its `<a xlink:href>` links, was the one
claim the design rested on that nobody had checked ([Spike](#spike)).

## Decisions

Taken by the owner on 21 and 22 September, on the proposal and the questions
it could not settle from the data; 15 to 17 came from the review and were
approved with the plan on 25 September, as was 18:

1. **Back-links on the planet and the letter, declared in the graph.**
   `zodiac.planetId → planet.zodiacs`, `gdGrade.planetId → planet.gdGrade`,
   `alchemySymbol.planetId → planet.alchemySymbol`,
   `tetragram.planetIds → planet.tetragrams`,
   `planet.hebrewLetterId → hebrewLetter.planet`, and the two nested ones,
   `tolPath.hermetic.hebrewLetterId → hebrewLetter.hermeticPath` and
   `tolPath.hebrew.hebrewLetterId → hebrewLetter.hebrewPath`. The accessor
   keeps the source table's name, as `sephirot`, `zodiacs` and `tetragrams`
   do; the page labels the row Metal, since only the seven rows filed under
   `category: "planets"` carry a `planetId` and the three principles never
   reach it. The singular ones make the integrity check prove that metals,
   grades and letters are one-to-one with planets.
2. **Each path names its two spheres.** `fromId` and `toId` on the 24 rows of
   `paths.json5`, both links to `sephirah`, with `pathsFrom` and `pathsTo`
   derived on the sephirah and a check that the id spells the two indices.
   The two attributions share one row per path, so the pair is the same on
   both trees; only the letter and the numbering differ, and those stay in
   their blocks. The scans by index in `entities.ts` and the path page go.
3. **`magickTypes` is shown, as Magical operations, marked as an editorial
   summary** until its source is named. Hiding it on the planet's own page
   while a geomancy menu shows it would be odd.
4. **All fifteen planet pages stay indexed.** The list page links every one,
   an exclusion list is one more thing the route test has to know about, and
   "the classical attributions stop at Saturn" is the answer a searcher for a
   Uranus correspondence wants. The four with nothing to show — Uranus,
   Neptune, Rahu, Ketu — say so in one sentence; Earth keeps its grade; the
   three spheres get "Sphere of Keter" through the inverse that already
   exists.
5. **The four worlds are named beside their rows**: God name · Atziluth,
   Archangel · Briah, Angelic order · Yetzirah, Planet · Assiah.
6. **Degrees and pillars stay as the data has them.** The three degrees
   group the grades — Neophyte to Philosophus, the Portal, the Second
   Order — and `gdDegree.pillarId` is one view of them that the owner keeps;
   the Degree row reads it as written, "First Degree · Pillar of Severity".
   The built-in rituals are found by name: `neophyte`, `zelator` and
   `theoricus` are the grade names in lower case, which is the mapping the
   data already carries, and a test holds it both ways. The Portal is not
   among them and gets no Ritual row.
7. **Alchemy at Zelator.** The 1=10 page lists the ten symbols and six terms
   whose `gdGrade` is 1: the Second Knowledge Lecture's alchemy, with the
   seven metals linking to their planets. The owner reviews the result
   specifically.
8. **The angel page moves onto the shared pieces**, in this branch, and every
   entity page sits in the site's `Container maxWidth="sm"` frame, which
   narrows the angel page from 44rem. Every link on the five pages is
   [`@magick-components/Link`](../src/components/Link.tsx), the MUI wrapper
   the rest of the site uses, so the angel page's `next/link` goes with the
   move. The owner reviews the result specifically.
9. **Navigation is the arrows and a named nav.** The arrows keep framing the
   figure as they have, gain the neighbour's name as their label, and a nav
   with both names closes the page. Planets are in no chain and get neither.
10. **Server Components and CSS modules**, no `"use client"` and no
    styled-jsx, as the angel page is. Proved by the spike. `GradeTree` loses
    its directive too: every renderer of it is a server page or a test, and
    the directive alone keeps the barrel in the grade route's client chunk.
11. **No new routes.** God names, archangels, orders, letters, signs, souls,
    chakras, elements and trumps render as text with their Hebrew marked
    `lang="he" dir="rtl"`; planets, sephirot, paths, grades, angels and the
    three built-in rituals link.
12. **Each page declares its row.** A module beside each page exports the
    fields it shows and the fields it deliberately omits, one level deep —
    `color.king` and `hermetic.tarotId` are keys, not `color` and `hermetic`,
    the way [integrity.ts](../data/integrity.ts)'s `idFields` walks a block —
    and a test asserts the two lists together are exactly the union of its
    table's keys at that depth, disjoint. A link, inverse or nested field
    added to the data then fails a test until a page decides about it, which
    is the inventory-both-ways rule the graph check uses. `shown` is a
    declaration, not a proof of rendering; the content tests are what bind a
    shown field to the markup.
13. **Titles, descriptions and cards do not change.** The descriptions already
    promise correspondences; the pages now contain what they promise. Da'at's
    description is the one exception (decision 18).
14. **The two colour names are corrected**, `brilliance` and `lavender`.
15. **The angel route gets one `h1`.** `pathnames.kabbalah.angel` becomes a
    section, `{ "/": "The 72 Angels" }`, so the bar stops taking the page's
    title for its own and shows the breadcrumb instead, and the bar's test
    covers the route beside the sephirah one. `/books/la-science-cabalistique/<division>`
    has the same defect and is not this plan's ([follow-ups](#follow-ups)).
16. **A grade with no sphere dims the whole tree.** The Tree lights every
    sphere when `active` names none of them, so Neophyte and the Portal pass
    an `active` that matches no sphere and every sphere is drawn at the
    inactive opacity, which is the figure saying what the missing row says.
    Da'at's page passes `showDaat`, so the sphere it is about is on its Tree
    and lit.
17. **Trumps through `next/image`.** `next/legacy/image` logs a deprecation
    on every render and the call is the same.
18. **Da'at is the hidden Sephirah, on its page and in its description.** Its
    search description said it "is Sephirah 11 of the Tree of Life", from its
    `index`, which numbers a sphere the tradition does not. The page's lede
    and the description both call it "the hidden Sephirah of the Tree of
    Life", from one helper both import, and the criterion is the data's: the
    one sphere outside the `next`/`prev` chain. One pinned string in
    [entities.test.ts](../src/seo/entities.test.ts) moves, in the sephirah
    commit; the title and the card do not.

## What every page shares

```
Planets                                   ← trail: a link to the list page
❮      [figure]      ❯                    ← arrows where the entity is in a chain
Name · Hebrew                             ← h1
One sentence of orientation               ← lede, from the data
<table> label | value                     ← one table; an empty row is not rendered
❮ Previous name          Next name ❯      ← named nav
```

The pieces live in `src/components/entity/`: `Trail`, `Row` (a labelled
`<th scope="row">`, an optional secondary word for the world, `null` when its
children are empty), `Name` (Hebrew right-to-left, then the romanisation in
the secondary colour, then the meaning in quotes), `PrevNext`, and one
stylesheet, `entity.module.css`, taking the angel page's table, trail, Hebrew
and nav rules. The angel page keeps what is its own: the attribute line, the
prose, the editorial notes and "In the book". Every page body is a
synchronous function — the angel page's is `async` today for its two text
loads, which move up into the route — because React 19's `renderToString`
throws on an async child, and that is how the route test renders a page.

What stays out of every page: ids, `kind`, the `*Id` fields (their links are
shown through the accessors), `nextId` and `prevId` (the nav), `bodyPos` and
the stroke fields (Tree layout), the web colour strings (swatches only),
`tarotId` and the raw enum values. Enums become words: `orderId: "1st"`
reads First Order.

## The pages

### Sephirah

```
Tree of Life
        ❮      [Tree, Tiferet lit]      ❯
Tiferet · תפארת
Beauty, the sixth Sephirah of the Tree of Life

Name                     תפארת   Tiferet   "Beauty"
Heaven                   ראשית הגלגולים   Roshit haGilgulim   "1st Swirlings / Primum Mobile"   (Keter, Chochmah, Malchut)
God name · Atziluth      יהוה אלוה ודעת   YHVH Eloah Ve-da'at
Archangel · Briah        רפאל   Raphael
Angelic order · Yetzirah מלאכים   Malecheem   "Messengers"
Planet · Assiah          ☉ Sol                                → /astrology/planet/sol
Colours                  [King scale · rose-pink]  [Queen scale · gold]
Soul                     רוח   Ruach   "spirit"
Chakra                   Anahata   अनाहत   "Heart"             [chakra figure, heart lit]
Body                     breast
Stone                    topaz
Scent                    olibanum
Grade                    5=6 Adeptus Minor                     → /gd/grade/5=6

Paths
  13   ג Gimel    to Keter      The High Priestess             → /kabbalah/path/1_6
  15   ה He       to Chochmah   The Emperor
  17   ז Zayin    to Binah      The Lovers
  20   י Yod      to Hesed      The Hermit
  22   ל Lamed    to Gevurah    Justice
  24   נ Nun      to Netzach    Death
  25   ס Samekh   to Yesod      Temperance
  26   ע Ayin     to Hod        The Devil

❮ Gevurah                                          Netzach ❯
```

The Tree stays at the top, drawn as today with the sephirah lit, since it
is the page's identity and its card; the chakra figure stays inside its row,
and only where the sephirah has a chakra. The Planet label reads Sphere for
Keter, Chochmah and Malchut, from the planet row's `kind`. The colour
swatches are today's, with the scale named in each. The Heaven row is on
the three spheres that carry `tenHeavens`, Keter, Chochmah and Malchut, and
the schema's comment, which says the three supernals, is corrected with it.
Da'at shows the Queen swatch alone, no chakra, soul, grade or planet, and
its Tree drawn with `showDaat`. The Paths list is the one new section: the
Tree's SVG links made readable, in Hermetic numbering with the letter and
the trump, sorted by path number, then the two Hebrew-only paths with their
Hebrew letter and the note "Hebrew tree only" on the four spheres they
touch, and "Hermetic tree only" on `7_10` and `8_10` for Netzach, Hod and
Malchut.

| Row field | Where it goes |
| --- | --- |
| `index` | the lede's ordinal |
| `name` | the `h1` and the Name row |
| `tenHeavens` | Heaven |
| `godName`, `archangel`, `angelicOrder`, `planet` | the four worlds |
| `color.king`, `color.kingWeb`, `color.kingWebText`, `color.queen`, `color.queenWeb`, `color.queenWebText` | the two swatches |
| `soul`, `chakra`, `body`, `stone`, `scent` | as labelled; an empty string is an omitted row |
| `gdGrade` | Grade |
| `pathsFrom`, `pathsTo` | the Paths list |
| `next`, `prev` | the arrows and the nav |
| `id`, the `*Id` fields, `bodyPos`, `color.strokeColor`, `color.strokeDasharray` | omitted |

### Planet

```
Planets
Sol ☉
In Hebrew שמש, Shemesh, "Sun"

Symbol                 ☉   · alchemical 🜚 Gold
Hebrew letter          ר Resh · 200 · "head"
Path                   30, Hod – Yesod, The Sun            → /kabbalah/path/8_9
Sephirah               Tiferet                              → /kabbalah/sephirah/tiferet
God name               יהוה אלוה ודעת   YHVH Eloah Ve-da'at
Archangel              מיכאל   Michael
Intelligence           Nakhiel
Spirit                 Sorath   [sigil]
Rules                  ♌︎ Leo
Geomantic figures      Fortuna Major, Fortuna Minor         → /geomancy/reference
Grade                  5=6 Adeptus Minor                    → /gd/grade/5=6
Magical operations     Career success and progression, establishing harmony, …
                       (an editorial summary)

See also: Planetary hours
```

The lede carries the Hebrew name, so there is no Name row. The spirit's
sigil is the `PlanetarySpirit` component the geomancy reference already
draws, an SVGR import that the two geomancy page tests mock; the planet
route test mocks it the same way, and the gate renders
`/astrology/planet/sol` on a server to prove it inside a Server Component,
which the spike did not. Rules lists every sign the planet rules, Mercury's
Gemini and Virgo among them. A sphere shows its Hebrew name and "Sphere of
Keter"; Earth its symbol and its grade; Uranus, Neptune, Rahu and Ketu their
symbol and the sentence that the classical attributions stop at Saturn. No
planet is in a chain, so there are no arrows and no nav.

| Row field | Where it goes |
| --- | --- |
| `name`, `symbol` | the `h1`, the lede, the Symbol row |
| `alchemySymbol` | the Symbol row's second half, labelled by the metal's name |
| `hebrewLetter` | Hebrew letter; its `hermeticPath` is the Path row |
| `sephirot` | Sephirah, or "Sphere of" for a `kind: "sphere"` row |
| `godName`, `archangel` | as labelled |
| `intelligenceId`, `spiritId` | Intelligence and Spirit, capitalised; they are pending links and render as text |
| `zodiacs` | Rules |
| `tetragrams` | Geomantic figures |
| `gdGrade` | Grade |
| `magickTypes` | Magical operations |
| `id`, `kind` (drives the label and the lede, not a row), the `*Id` fields | omitted |

### Grade

```
Grades
        ❮      [Grade tree, Yesod lit]      ❯
Theoricus 2=9
A grade of the First Order, attributed to Yesod

Order      First Order
Degree     First Degree · Pillar of Severity
Sephirah   Yesod                                   → /kabbalah/sephirah/yesod
Planet     ☾ Luna                                  → /astrology/planet/luna
Element    🜁 Air · the Sylphs
Ritual     Theoricus 2=9 Ritual                    → /doc/theoricus

❮ Zelator 1=10                              Practicus 3=8 ❯
```

The grade tree stays with its arrows, and for Neophyte and the Portal is
drawn with every sphere dimmed (decision 16) rather than printing "(no
sephirah)". The Portal's lede says it stands between the First and Second
Orders, and its table has Degree and Element only; the three grades of the
Third Order have no degree row. Zelator adds an Alchemy row: the three
principles and seven metals by symbol and name, the metals linking to their
planets, then the six terms by name.

| Row field | Where it goes |
| --- | --- |
| `id`, `name` | the `h1` |
| `orderId` | Order, as words |
| `degree` | Degree, as words, with its `pillarId` |
| `sephirah`, `planet` | as labelled |
| `element` | Element, with `element.elemental.namePlural` |
| `next`, `prev` | the arrows and the nav |
| the `*Id` fields | omitted |

Ritual comes from the grade's name in lower case where
`isPublicRitualId()` accepts it, which is Neophyte, Zelator and Theoricus
and no other; Alchemy from `alchemySymbol` and `alchemyTerm` rows whose
`gdGrade` is the grade's first number, which the schema describes as "the
grade that teaches it, as a number; not a link". Both tables are in the
barrel already.

### Path

```
Tree of Life
        ❮      [Tree, path 1_6 lit]      ❯
Path 13: Keter – Tiferet
Joins Keter and Tiferet                            (both linked)

Hermetic tree
  Letter    ג Gimel · 3 · "camel"                  (the large letter block, as today)
  Tarot     [card image]   The High Priestess (II)
  Planet    ☾ Luna                                 → /astrology/planet/luna
Hebrew tree
  Letter    ד Dalet · 4 · "door"

❮ Path 12: Keter – Binah                  Path 14: Chochmah – Binah ❯
```

The `h1` uses the Hermetic number where there is one. The Tree is drawn on
the tree the path belongs to — `letterAttr="hebrew"` for `2_5` and `3_4`,
whose heading is "Path Chochmah – Gevurah" and whose lede says the Hermetic
tree does not draw them — and `7_10` and `8_10` get the mirror-image sentence
under their Hermetic block. The Planet row appears on the seven double-letter
paths, since only the planets carry a letter in the data. The `mathers` read
goes.

| Row field | Where it goes |
| --- | --- |
| `id` | the pair in the `h1` |
| `from`, `to` | the `h1` and the lede |
| `hermetic.pathNo`, `hermetic.hebrewLetter`, `hermetic.tarotId` | the Hermetic block; the trump through `tarotDeck.getByRank` |
| `hebrew.hebrewLetter` | the Hebrew block |
| `hermetic.hebrewLetter.planet` | Planet |
| `next`, `prev` | the arrows and the nav, labelled by number and pair |
| `fromId`, `toId`, `hermetic.hebrewLetterId`, `hebrew.hebrewLetterId`, `nextId`, `prevId` | omitted |

## The data

In [graph.ts](../data/graph.ts), no JSON touched:

```ts
zodiac:        { links: { planetId: { to: "planet", inverse: "zodiacs", inverseMany: true }, … } },
gdGrade:       { links: { planetId: { to: "planet", inverse: "gdGrade" }, … } },
alchemySymbol: { links: { planetId: { to: "planet", inverse: "alchemySymbol" } } },
tetragram:     { links: { planetIds: { to: "planet", many: true, inverse: "tetragrams", inverseMany: true }, … } },
planet:        { links: { hebrewLetterId: { to: "hebrewLetter", inverse: "planet" }, … } },
tolPath: {
  links: {
    "hermetic.hebrewLetterId": { to: "hebrewLetter", inverse: "hermeticPath" },
    "hebrew.hebrewLetterId":   { to: "hebrewLetter", inverse: "hebrewPath" },
    fromId: { to: "sephirah", inverse: "pathsFrom", inverseMany: true },
    toId:   { to: "sephirah", inverse: "pathsTo",   inverseMany: true },
    …
  },
},
```

In `paths.json5`, `fromId` and `toId` on all 24 rows, and in `sephirot.json5`
the two spellings. The schema needs no edit: `ids()` derives both new fields
from the graph as required strings, which is right for all 24 rows. The
integrity check gains one rule beside the chain check: a path's id is
`${from.index}_${to.index}`. The singular inverses are proved unique by the
existing `inverse-not-unique` rule, and the accessor-collision rule stands
guard over the nine new names. The barrel keys pin
([barrel.keys.test.ts](../data/barrel.keys.test.ts)) moves by nine names,
interleaved by position rather than appended — the planet row ends
`archangel, alchemySymbol, gdGrade, sephirot, tetragrams, zodiacs`, the
letter `planet, hermeticPath, hebrewPath`, the sephirah
`…prev, pathsFrom, pathsTo` — and `tolPath` gains `fromId, toId, from, to`
in the second commit. [assemble.declared.test.ts](../data/assemble.declared.test.ts),
which says the real graph declares no singular or list-derived inverse,
moves with the first. `Row` types gain the accessors without a runtime
change, since `Inverses<T, I>` reads the `inverse` name off any link whose
`to` is `T`, nested or not.

No image contract names any of these fields, so no rendered image's bytes
or inputs hash moves, and the registry test asserts it.

## Tests

- [entityRoutes.test.tsx](../src/app/entityRoutes.test.tsx) grows from four
  ids to every id of the four tables, 62 pages, and asserts of each: the
  `h1`; none of the strings today's defects render — `{&quot;`,
  `[object Object]`, `undefined`, `(&quot;&quot;)`, `(no sephirah)`,
  `: None` — in the markup; and that every `href` and `xlink:href` it emits
  is a key of `PUBLIC_PAGES`, an entity id's route, or a built-in ritual.
  The Luna pin keeps its god name. The planet route mocks `PlanetarySpirit`
  as the geomancy tests do.
- `entityFields.test.ts`: for each of the five entity pages, the exported
  `shown` and `omitted` lists are disjoint and together equal the union of
  the table's keys one level deep over every row (decision 12). The union
  is a set, so row order does not matter, and `assemble()` attaches every
  accessor to every row, so an inverse a row has nothing for is still a key
  (Da'at's `pathsFrom` is `[]`). The angel page declares its row too, which
  proves the harness on a page that exists.
- The angel page's refactor is pinned by a golden: the text content of one
  angel, tags stripped, captured on the tree before the refactor and
  committed with it, rendered by calling the page body rather than the
  route, since the route is `async` and `renderToString` refuses that.
- A test that every key of `publicRitualQueryKeys` is the lower-cased name
  of exactly one grade, and that the grade page links exactly those.
- Representative content tests: Keter (heaven, sphere, no `prev`), Da'at
  (Queen only, no chakra, drawn), Malchut (heaven), Sol, Uranus,
  `primum-mobile`, Neophyte (dimmed tree, ritual), the Portal (no ritual),
  Ipsissimus, `1_2`, `2_5`, `7_10`, `9_10`.
- The bar's test covers `/kabbalah/angel/<slug>` (decision 15).
- The barrel keys pin, [types.test.ts](../data/types.test.ts) and
  `assemble.declared.test.ts` gain the nine accessors.

## Migration

On `gate/entity-pages`, each commit checked on its own tree with
`pnpm check`, `pnpm typecheck`, `pnpm data:check` and `pnpm test`,
`data/dist` wiped before each; the branch gated as
[plan 032](032-data-layer.md#results) was; an adversarial review on the
final tree; commit footers naming every model that worked on the change.
The design and its review ran on Fable 5.1 at xhigh; implementation runs on
Opus 5.5 at xhigh, in subagents, with Fable for review where it earns it.

0. `docs(plan): Plan the entity pages` — this plan, as approved, and the
   status page's pointer.
1. `feat(data): Declare the entity pages' back-links` — the seven inverses
   of decision 1, the pins, the uniqueness they prove.
2. `feat(data): Name each path's two sephirot` — `fromId`/`toId`, the two
   inverses, the id check; `entities.ts` reads the links.
3. `fix(data): Spell brilliance and lavender`, and the `tenHeavens` comment.
4. `refactor(kabbalah): Share the angel page's table` — `src/components/entity/`
   extracted from the angel page, which moves onto it, into the Container and
   onto the MUI link, with its body made synchronous; the `pathnames` section
   and the bar test; `entityFields.test.ts` with the angel page's
   declaration; the golden.
5. `feat(kabbalah): Show a sephirah's correspondences` — with decision 18.
6. `feat(kabbalah): Show a path's correspondences`.
7. `feat(astrology): Show a planet's correspondences`.
8. `feat(gd): Show a grade's correspondences` — with `GradeTree`'s
   directive gone.
9. `build: Retire cycle` — `pnpm remove cycle`; the lockfile diff must show
   only that package's entries.
10. `docs(plan): Record the entity pages` — this plan's results.

Each page commit brings its declaration, its ids into the route test and its
content tests; the shared pieces exist from commit 4, before any page uses
them, and the ritual test arrives with the grade page. The gate counts the
client chunks of all four routes in the production build, not the sephirah's
alone. Nothing lands on `main` but by the owner's fast-forward.

## Spike

Run on 22 September by Opus 5 in a throwaway worktree on `main`'s tip, with
the webpack dev server on a fresh port, no browser. A Server Component route
rendered the Tree three times — `active="tiferet"`, `activePath="1_6"`, and
`activePath="2_5"` on the Hebrew tree — with the chakra figure, a
`next/legacy/image` trump, the MUI frame and a god name read off the barrel.

- **The Tree renders inside a Server Component.** HTTP 200, and the server
  log held nothing but the compile line and the `next/legacy/image`
  deprecation notice: no hook, boundary, ref or hydration warning. Under
  `--conditions=react-server`, `"useEffect" in React` is `false`, so the
  guarded hook is skipped; it is a no-op for these pages anyway, since it
  early-returns without a `ref` and only `/kabbalah/tree` passes one. The
  markup carried `id="TreeOfLife"` three times, thirty sephirah links and 132
  path links as `xlink:href`, the lit sphere at opacity 1 and the rest at
  0.1, `2_5` and `3_4` on the Hebrew render only and `7_10` and `8_10` on the
  Hermetic ones only, the heart chakra lit, and the trump's `<img>`.
- **The barrel leaves the client.** The spike route's chunk held zero
  app-local modules; the current sephirah route's held 33, the 23 tables,
  `data.ts`, `assemble.ts`, the Tree, the chakra figure and the rest. The
  barrel's ids appeared in neither the spike's chunks nor its HTML, and in
  the current page's four and eight times. Dev chunks are unminified, so the
  production figure is the gate's to measure.
- `renderToString(await Page(props))` in vitest, as the route test does it,
  passes on the spike page.

## Results

Pending the gate.

## Adversarial review

Run on 22 September at xhigh by Fable 5.1 against the plan as first written,
using `loom-torvalds-review` and scratch scripts over the real data under
Node 24. Its findings and their disposition:

| Finding | Disposition |
| --- | --- |
| The grade route keeps the barrel on the client: `GradeTree` is `"use client"` and nothing renders it from a client component | Decision 10 extended; the gate counts all four routes |
| The angel route renders two `h1`s, the bar's and the page's, and the plan's refactor kept both | Decision 15 |
| The row declaration saw top-level keys only, so `color.strokeColor` or a nested field added later would pass with no page deciding | Decision 12 walks one level, as `idFields` does; `shown` stated as a declaration, not a proof |
| `renderToString` throws on an async component, and the angel page's body is `async`; "one angel before and after" cannot be rendered in one tree | Bodies synchronous, loads in the route; the pin is a golden captured before the refactor |
| The Portal has no ritual, and `tenHeavens` is on Keter, Chochmah and Malchut, not Binah | Both corrected, and the schema's comment with them |
| The Tree lights every sphere when `active` names none, so "unlit" for Neophyte was the opposite of what would draw; Da'at's page omits `showDaat` | Decision 16 |
| The route test's `()` marker matched none of today's defects, which render `(&quot;&quot;)` and `(no sephirah)`, and would have matched "(II)" | The markers name the failure strings |
| Da'at's lede, "the hidden Sephirah", against its pinned description, "Sephirah 11" | Decision 18 |
| Which `Link` the shared pieces use was unspecified | Decision 8: the MUI wrapper on all five |
| `7_10` and `8_10` had no "Hermetic tree only" note on the sephirah page | Added |
| The href assertion must read `xlink:href`; `assemble.declared.test.ts` goes stale at commit 1; the keys pin moves by nine names interleaved, not appended; `next/legacy/image` logs on every render | All folded in; decision 17 |

Verified true by the review, with scripts: the nine inverses and
`fromId`/`toId` assemble over the real data with no problem and pass the
integrity check with no failure; the schema needs no edit; the singular
inverses are unique — eight grades, seven metals, seven double letters (bet,
gimel, dalet, kaf, pe, resh, tav), 22 Hermetic and 22 Hebrew paths; Tiferet's
`pathsFrom` and `pathsTo` are three and five, the mockup's eight; the types
derive an accessor from a nested link, proved by `tsc` over a copy of the
type layer against the modified graph, 0 errors with the negatives holding,
and 12 errors against the unmodified one; the Tree's inputs hash over a
barrel with every change applied equals the pinned `2591a504…`, so no image
identity moves; the ritual mapping is exactly three both ways; every
`chakraId` is one the figure knows; every Hermetic path has one letter and
a trump rank the deck resolves, with all 22 images on disk; the
descriptions, titles and cards are unchanged by `from.name.roman`; the
typos exist and nothing pins them; the alchemy tables are in the barrel.

Refuted: one premise of the review's own brief — that Next rejects an
unknown export from `page.tsx`. In 16.3.5 the typegen check is
`Specific extends AppPageConfig` and the build's strict parse collects only
the segment-config keys, and `dynamicParams` already proves an extra export
passes. The declaration may live in the page file; a sibling module is
cleaner and is what the plan names. Refuted in the plan as first written:
the unlit tree, the Portal's ritual, Binah's heaven, "the barrel leaves the
client" claimed for all four routes on a spike that proved one, the `()`
marker, and "moves by exactly those nine".

Not checked: the provenance of `magickTypes`, which needs the books; the
SVGR sigil inside a Server Component, which the gate proves on
`/astrology/planet/sol`; production chunk sizes and any browser rendering.


## Deferred

- Pages for what is text today: the Hebrew letters, the signs, the god names
  and archangels, the trumps. Each would be a route, a description, a card
  and a sitemap entry, and none is asked for yet.
- JSON-LD on entity pages. Plan 028 gave the home page `WebSite`; nothing
  here needs structured data to say what the tables say.
- Anchors on `/geomancy/reference` for each figure, so a planet's Geomantic
  figures row can land on the figure rather than the page.
- `pathTarget()` does not walk a derived inverse; no public dotted path
  uses one, and the Tree's field list is the place it would first matter.

## Follow-ups

- The source of `magickTypes` ([assessment](#assessment-before)); once named,
  the editorial-summary note becomes a citation.
- The alchemy row and the angel page refactor are the owner's to review
  specifically once rendered (decisions 7 and 8).
- `/books/la-science-cabalistique/<division>` renders two `h1`s for the
  reason the angel route did (decision 15); plan 033's to fix.
