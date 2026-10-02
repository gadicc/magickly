# Correspondence tables

Assessment and decisions, 1 October 2026. Read
[current status](000-current-status.md) first. This takes up the data
follow-ups [plan 036](036-entity-pages.md#follow-ups) left: the entity pages
set fields side by side that had only ever been read one at a time, and set
side by side they disagree. Approved and built on 1 October
([Commits](#commits), [Results](#results)).

Decision taken on 1 October: the body parts, stones and scents of the
sephirot become rows of their own tables, linked by id, read through a new
wildcard segment in the field paths; the heavens are the planet rows, and the
three-row `tenHeavens` copy of them goes; romanised Hebrew writes the article
as Israel's official romanisation does; and the Key of Solomon's operations
for the seven planets move from the planetary hours page into the planet
data, shown on the planet page beside the summary it already has. All of it
ships as one release, so that every Tree image is re-identified once.

## Assessment (before)

| Field | Now | Drawn by the Tree |
| --- | --- | --- |
| `sephirah.body` | slugs: "left-face", "right-arm", and "loins; hips", two parts in one string | yes, `body` |
| `sephirah.stone` | "saphire; amethyst" (misspelt), "Star Ruby; Turquoise" (the only capitals), two stones in one string elsewhere | yes, `stone` |
| `sephirah.scent` | "rose, red sandal" (two scents, the only comma), "myrrh; civet" | yes, `scent` |
| `sephirah.tenHeavens` | on Keter, Chochmah and Malchut only; each restates the planet row the sephirah links to, and two disagree with it | no |
| romanised article | "Roshit HaGilgulim", "Roshit haGilgulim", "Olam haYesodot", "Chayot Hakodesh", "Adonai Ha'aretz": five names, four styles | yes, through `planet.name.he.roman`, `angelicOrder.name.roman`, `godName.name.roman` |
| `planet.magickTypes` | a modern, unsourced summary of each classical planet's operations | no |
| Key of Solomon operations | the seven planets' text, inside `planetaryHours.tsx` as select labels | no |

- **The heavens are the planet rows.** Keter's heaven is the primum mobile
  sphere, Chochmah's the zodiac and Malchut's the world of foundations: the
  rows `primum-mobile`, `zodiac` and `olam-yesodot` the sephirot already
  link. The other seven sephirot's heavens are their planets, which is how
  the ten-heavens flashcards already read them ("Sphere of Saturn /
  Shabbathai"). `tenHeavens` stores three of the ten twice, and two of the
  three disagree with the planet table: "haGilgulim" against "HaGilgulim",
  and עולם יסודות "Olam Yesodoth", "Sphere of the Elements", against
  עולם היסודות "Olam haYesodot", "World of Foundations".
- **Romanised Hebrew has two standards.** Israel's official romanisation,
  the Academy of the Hebrew Language's system adopted by BGN/PCGN in 2018
  and used on Israeli maps and signs, capitalises the article and joins it:
  "HaAgudda", "HaYogev", hence "HaYarkon". ALA-LC, the library cataloguing
  standard, writes it in lower case with a hyphen: "ha-Zaken". The data
  follows neither consistently.
- **magickTypes is not an abridgement of the Key of Solomon.** Compared
  planet by planet, the two agree in part on Mercury, Venus, Sol and Jupiter
  and hardly at all on Luna, Saturn and Mars, where magickTypes follows
  modern planetary magic (Saturn as discipline, Luna as the psychic) and
  softens what the Key says ("to bring destruction and to give death"). They
  are two sources saying different things. magickTypes's source is not
  known.
- **What a Tree field costs.** Since plan 032, the Tree's identity carries a
  hash over every field it can draw. Changing any of them re-identifies
  every Tree image once; an image's bytes move only where its query draws
  the changed field. Published rituals keep their stored images until they
  are republished. One release, however many fields, is one
  re-identification.

## Decisions

Taken by the owner on 1 October:

1. **Romanised Hebrew writes the article as Israel's official romanisation
   does: capitalised and joined.** "Roshit HaGilgulim", "Olam HaYesodot",
   "Chayot HaKodesh", "Adonai HaAretz" (an initial aleph's vowel is
   capitalised, as the standard's examples do). The rule is written into
   [data/README.md](../data/README.md) for the next entry.
2. **The heavens are the planet rows; `tenHeavens` goes.** The sephirah
   page drops its Heaven row, and its "Planet · Assiah" row gains the planet
   or sphere's Hebrew name. The sphere rows take the glosses `tenHeavens`
   held. Malchut's sphere is עולם היסודות, "Olam HaYesodot", "World of
   Foundations (Sphere of the Elements)"; "Cholem Yesodoth", which some
   Golden Dawn tables give, is wrong. The name and the gloss are split, as
   Shemesh's "Sun" is: `name.en.en` stays "World of Foundations", which is
   the Tree's label, the sphere page's heading and its search title, and
   "Sphere of the Elements" is the Hebrew name's gloss, `name.he.en`, so the
   sephirah page reads "World of Foundations · עולם היסודות Olam HaYesodot
   “Sphere of the Elements”". Keter's sphere takes "First Swirlings" the same
   way. The ten-heavens flashcards lose their special case and answer with a
   sphere's gloss where it has one: "Sphere of the Elements / Olam
   HaYesodot".
3. **Body parts, stones and scents become tables, linked by id.** Rows carry
   `name.en` now and can take other languages, descriptions and pictures
   later. A sephirah carries `bodyPartIds`, `stoneIds` and `scentIds`, lists
   all three, so the accessors are `bodyParts`, `stones` and `scents`.
   Netzach's scents are two, rose and red sandal. `bodyPos`, the Tree's
   layout key, stays as it is.
4. **A wildcard segment in field paths.** `*` maps the rest of a path over a
   list and joins the results with "; ", the separator the data uses today:
   `stones.*.name.en` reads "pearl; star sapphire". `readFieldPath()` and
   `pathTarget()` both learn it.
5. **No aliases for the old paths.** `body`, `stone` and `scent` are
   replaced in place wherever they are named: the Tree's field list and its
   page's menus, the stones flashcards and the Tree's inputs spec. The image
   route validates field names, so a URL that still names one returns a 400
   rather than drawing a blank. The owner checked the saved rituals: some
   draw the Tree, none with those fields, and no built-in ritual document
   names them; so the 400s are accepted rather than bridged.
6. **The Key of Solomon's operations move into the planet data**, cited, and
   the planetary hours page reads them from there. The hours page is a client
   component that loads no table today, so its server `page.tsx` passes the
   seven strings down as props rather than the component importing the
   barrel. The stored texts are fragments that follow "Planet:" in the
   page's select ("summon the Souls from Hades…"), so the planet page frames
   them, "Its days and hours serve for:", above magickTypes, which keeps its
   editorial-summary note; the geomancy reading keeps magickTypes as its
   hint. Whether the page's wording is Mathers' verbatim is not settled
   (sacred-texts refuses the fetch; the Luna text's "voyages envoys" and
   Sol's missing "and" suggest light abridgement), so it is cited as
   "after Mathers" until it has been checked against a scan.
7. **Pictures are deferred.** A row can later carry one, with its credit and
   licence, which a picture needs and the CC BY data does not give it.
   Whether the data package ships images or only their URLs is step 4's
   question ([plan 032](032-data-layer.md#migration)).
8. **One release.** Everything that touches a Tree field ships together, so
   the Tree's identity moves once.

## The data

Three new tables, named as the barrel names its others, singular:

```json5
// data/materia/stones.json5 — table `stone`
sapphire: { id: "sapphire", name: { en: "sapphire" } },
"star-ruby": { id: "star-ruby", name: { en: "star ruby" } },
// data/materia/scents.json5 — table `scent`
"red-sandal": { id: "red-sandal", name: { en: "red sandal" } },
// data/body/parts.json5 — table `bodyPart`
"left-arm": { id: "left-arm", name: { en: "left arm" } },
```

```json5
// sephirot.json5
hesed: { …, bodyPartIds: ["left-arm"], stoneIds: ["sapphire", "amethyst"], scentIds: ["cedar"] },
daat:  { …, bodyPartIds: ["throat"] },   // no stone or scent: the keys are absent
```

The graph declares the three as `many` links. Names are lower case, as the
data has them; the pages capitalise a value's first letter as they do now.
The values, read off the data as it stands:

| Table | Rows |
| --- | --- |
| `bodyPart` | cranium, left face, right face, left arm, right arm, breast, loins, hips, legs, genitals, feet, throat |
| `stone` | diamond, star ruby, turquoise, pearl, star sapphire, sapphire, amethyst, ruby, topaz, emerald, quartz, rock crystal |
| `scent` | ambergris, musk, myrrh, civet, cedar, tobacco, olibanum, rose, red sandal, storax, jasmine |

Netzach's body is loins and hips, Hod's loins and legs; Hod and Yesod share
quartz. Malchut has no scent and Da'at neither stone nor scent, so those keys
are absent, as plan 032's decision 5 has it for a missing link.

The planet rows gain:

```json5
luna: { …, keyOfSolomon: { en: "embassies; voyages; envoys; messages; navigation; reconciliation; love; and the acquisition of merchandise by water." } },
```

for the seven planets, with the text as the planetary hours page holds it
today, character for character (the example above shows Luna's with the
page's own "voyages envoys"), and the citation, after Mathers' translation
of 1888, Book I, chapter II, recorded once beside the field and in the
README's sources. The sphere rows gain glosses in `name.he.en`:
`primum-mobile` "First Swirlings", `olam-yesodot` "Sphere of the Elements",
and its Hebrew and romanisation as decision 2 has them. `tenHeavens` is
removed from the data, the schema and the types.

## Field paths

`readFieldPath(source, path)`: a segment `*` applied to a list maps the rest
of the path over its elements, drops what is `undefined` or empty, and joins
the rest with "; "; an empty result is `undefined`, so a label or a row is
blank rather than "". `*` applied to anything but a list is `undefined`. No
other segment's meaning changes.

`pathTarget(table, path)`: `*` is valid only directly after a list, a
`many` link's accessor or a list field, and the walk continues in the
list's target table or element. A path through `*` resolves to one joined
string, so its target reports `many: false`.

`dot-prop` gives `*` no meaning: its `setProperty` writes a literal `"*"`
key on an array. The mutation test in
[dataInputs.test.ts](../src/render/dataInputs.test.ts), which changes each
listed field through `setProperty` and requires the hash to move, learns
the wildcard with the reader, changing every element the path reaches.

The Tree's public fields become `bodyParts.*.name.en`, `stones.*.name.en`
and `scents.*.name.en`, in `TREE_IMAGE_FIELDS`, in the Tree page's menus and
in the Tree's inputs spec; the stones flashcards answer
`stones.*.name.en`; [fieldPaths.test.ts](../src/fieldPaths.test.ts) checks
them through `pathTarget()` as it checks the others.

## The pages

- **Sephirah:** the Heaven row goes; "Planet · Assiah" (or "Sphere ·
  Assiah") shows the planet's symbol and name, linked, then its Hebrew name
  through `Name`. Body, Stone and Scent read the linked rows' names, joined
  as today. `fields.ts` declares the new keys.
- **Planet:** a "Key of Solomon" row, cited, above "Magical operations",
  which keeps its editorial-summary note.
- **Planetary hours:** the select's labels come from
  `planet.keyOfSolomon.en`, passed down by the server `page.tsx`; the page
  looks the same and its client bundle does not grow.
- **Flashcards:** "ten heavens" answers from the planet row for all ten;
  "stones" from the stones. Saved progress is keyed by set and card id, the
  sephirah's id, not by the answer's text, so it survives the new wording.

## Effects

- **Images.** The Tree's inputs hash moves once. Bytes move for Trees whose
  query draws a stone, a scent, a body part, a sphere's romanised name, an
  angelic order's or a god name's romanisation. The Theoricus ritual's Tree
  draws `godName.name.he`, `angelicOrder.name.he` and
  `archangel.name.he`, none of which changes, so its bytes should not move;
  the registry test pins it either way.
- **Search.** Three descriptions change and no title: Keter's, whose
  angelic host "Chayot Hakodesh" becomes "Chayot HaKodesh"; Malchut's, whose
  god name "Adonai Ha'aretz" becomes "Adonai HaAretz"; and the
  `olam-yesodot` planet page's, which names the romanisation, "Olam
  HaYesodot". Keter's is pinned by a test, which moves with it.
- **Flashcards.** Answers change in four sets: the stones, the ten heavens,
  the planets' romanised Hebrew names (the spheres are among them) and the
  sephirot's romanised god names (Malchut). Saved progress is keyed by set
  and card id, not by answer, so none is lost.
- **Tree labels.** Stones, scents and body parts are drawn from the tables'
  lower-case names, "star ruby; turquoise" where "Star Ruby; Turquoise" was,
  "left arm" where "left-arm" was; the Tree does not capitalise. Its menus
  list the new paths as they are written, `stones.*.name.en`.
- **Readers.** The fixed spellings and the joined article where the data
  shows them; the sephirah page one row shorter; the planet page one row
  longer.

## Migration

On a gate branch, each commit checked on its own tree, the branch gated,
reviewed independently, and a final adversarial review, per the model
policy in force from 1 October (Opus 5.5 at Medium or High for the work,
fresh-context Opus 5.5 at High to review, Fable 5.1 at High for the final
review).

1. `feat(data): Read a list in a field path` — the wildcard in
   `readFieldPath()` and `pathTarget()`, and the mutation test's
   `setProperty` taught it, with tests. Nothing uses it yet.
2. `feat(data): Give body parts, stones and scents tables` — the three
   tables; `graph.ts` (their `{}` entries and the three `many` links);
   `tables.ts`, `data.ts` (the barrel must hold a link's target), `rows.ts`
   and `NamedRows`; three schemas and the sephirah schema's absent keys; the
   sephirot's ids; `barrel.keys.test.ts`, `types.test.ts`,
   `pathTarget.test.ts`; the `TABLE_FILES` list in
   [renderWithTables.ts](../tests/renderWithTables.ts), so the sweep reaches
   the new tables; the paths moved in place in `TREE_IMAGE_FIELDS`, the Tree
   page's menus and the stones flashcards; the sephirah page, its
   `fields.ts` and its tests; the registry's inputs-hash pin.
3. `refactor(data): Let the planet rows be the heavens` — `tenHeavens`
   removed, the glosses and Malchut's sphere, the sephirah page and the
   flashcards.
4. `fix(data): Write the Hebrew article as Israel does` — the four names,
   the README's rule, Malchut's description.
5. `feat(astrology): Cite the Key of Solomon on the planets` — the field,
   the hours page and the planet page, the README's source.
6. `docs(plan): Record the correspondence tables`.

Commits 2 and 4 move the Tree's inputs hash on the branch (3 does not:
the glosses are not Tree fields); only the release moves it for readers,
once. The Theoricus ritual's Tree bytes are expected to stay, since it draws
none of the changed fields.

## Commits

On `gate/correspondence-tables` from `d25f8d9`. Each commit was checked on
its own tree with `pnpm check`, `pnpm typecheck`, `pnpm data:check` and
`pnpm test`, `data/dist` wiped before each, by a script that records every
step's exit status; the branch was then gated as [below](#results).

| Commit | Change | Tests |
| --- | --- | ---: |
| `7fcab69` docs(plan): Plan the correspondence tables | This plan, as approved, and the status page's pointer | — |
| `ede421d` feat(data): Read a list in a field path | The wildcard in `readFieldPath()` and `pathTarget()`, one per path; the mutation test taught it | 4,898 |
| `3682c85` feat(data): Give body parts, stones and scents tables | The three tables and their wiring, the paths moved in place, the sephirah page and the stones flashcards; an empty id list refused | 4,903 |
| `bce09f5` refactor(data): Let the planet rows be the heavens | `tenHeavens` removed; the spheres' glosses; `glossBeside()` shared by the sephirah and planet pages; the ten-heavens flashcards | 4,905 |
| `138f4d5` fix(data): Write the Hebrew article as Israel does | Three romanisations and the README's rule | 4,905 |
| `147865f` feat(astrology): Cite the Key of Solomon on the planets | The field on the seven planets, the hours page's props, the planet page's row, the README's source | 4,908 |

A seventh commit, `docs(plan): Record the correspondence tables`, adds this
section and the ones after it; as in plans 032 and 036 it is not in the
table, which it would have to predict.

The plan, the reviews and the stacking ran in the orchestrating session on
Opus 5.5 at xhigh; the commits in three Opus 5.5 subagents, the Key of
Solomon in parallel with the tables; the design review and the final review
on Fable 5.1, and an independent review on a fresh Opus 5.5. The model
policy of 1 October asks for High on all but the orchestration; the agent
definitions that pin it load only in a new session, so this branch ran at
the session's xhigh throughout.

## Results

The gate ran on `147865f` in the `gate/correspondence-tables` worktree with
a fresh `pnpm install --frozen-lockfile`, on Node 24.18.0 and pnpm 10.18.0,
under CI's placeholder environment, in
[ci.yml](../.github/workflows/ci.yml)'s order, from a script file whose
every step's status was read:

| Step | Outcome |
| --- | --- |
| `pnpm install --frozen-lockfile` | clean; no dependency added |
| `loom init`, `loom check`, `loom check --production` | good, with the standing pnpm 11 advisory |
| `pnpm check` | no errors, the same 35 warnings as `main` |
| `pnpm typecheck` | clean |
| `pnpm test:coverage` | 4,908 passed, 17 skipped, thresholds met |
| `pnpm build`, `pnpm check:turbopack` | 386 pages prerendered by each |

What a reader sees change:

- **Sephirah pages.** Body, Stone and Scent read the new tables' names:
  "Sapphire; amethyst" on Chesed, "Star ruby; turquoise" and "Left face" on
  Chochmah, "Rose; red sandal" on Netzach. The Heaven row is gone; the
  "Planet · Assiah" or "Sphere · Assiah" row names the planet's Hebrew after
  it, "♃ Jupiter · צדק Tzedek “Justice”", and Malchut's reads "World of
  Foundations · עולם היסודות Olam HaYesodot “Sphere of the Elements”".
- **Planet pages.** The seven classical planets gain a "Key of Solomon" row
  above "Magical operations", "Its days and hours serve for: …", cited after
  Mathers. The sphere pages' ledes end with their gloss where it does not
  repeat the heading.
- **The Tree.** Stones, scents and body parts are drawn from the tables, in
  lower case, through the new paths, which the Tree page's menus now list:
  `stones.*.name.en`, `scents.*.name.en`, `bodyParts.*.name.en`. Chochmah's
  "star ruby; turquoise" wraps after "star". An image URL that still names
  `stone`, `scent` or `body` is refused with a 400.
- **The article.** "Olam HaYesodot", "Chayot HaKodesh" and "Adonai HaAretz"
  wherever they are shown, and three search descriptions with them:
  Keter's, Malchut's and the `olam-yesodot` planet page's. No title changes.
- **Flashcards.** Four sets answer differently, as compared card by card at
  both ends: the stones (Chesed, Chochmah), the ten heavens (Keter,
  Malchut), the planets' romanised names (the world of foundations) and the
  sephirot's romanised god names (Malchut). No card was added or lost, and
  saved progress, keyed by card id, survives.
- **The planetary hours page** looks as it did; its seven texts now come
  from the planet data, passed down by its server page.

Render identity: only the Tree's inputs hash moved, `8d5f06b8…` to
`edab0be8…` with the tables and to `2b895fc2…` with the article. Every other
image kept its bytes and inputs hash, and the Theoricus ritual's Tree kept
its 150,785 bytes, `a1fe82b8…`. The whole-data render sweep passed over the
new tables. Published rituals keep their stored images until they are
republished.

In the browser, against `next start` on a production build of `7249dc7`
(the branch before the wildcard scanner below, which changes nothing a
page renders): the Malchut, Chesed and Saturn pages and the Tree page with
the new paths render as listed; no Safari.

### What was decided while building it

- **One wildcard per path.** The independent review measured a crafted Tree
  page link chaining `*` through links that loop back: 214 ms at six levels,
  growing tenfold a level, so a 240-character link would freeze the tab.
  The Tree page takes its paths from the query string unchecked; only the
  image route validates them. One `*` is all the data needs, and with one
  the cost is linear; `readFieldPath()` reads a path with two as
  `undefined`, `pathTarget()` refuses it, and a test proves the crafted
  path returns at once.
- **An escaped `\*` is a key, and the detection is a scanner.** dot-prop's
  backslash escapes the next character. The first fix detected a wildcard
  with a regular expression and a lookbehind; the final review found it
  inexact in one corner, and a lookbehind is a parse error to Safari before
  16.4, which would have broken the Tree and flashcard pages there. A
  twenty-line scanner that follows dot-prop's rule replaces it.
- **A path through `*` must end on a field**, since a row joined as text
  reads "[object Object]"; `pathTarget()` refuses one that does not.
- **An empty id list fails the data check.** A row with none leaves the key
  out (plan 032, decision 5), so that "none" is spelt one way.
- **`glossBeside()`** in the shared entity pieces decides, for both the
  sephirah and the planet page, when a Hebrew name's gloss only repeats the
  English name and is left out: the zodiac's "The Zodiac".
- **The flashcards read paths through `readFieldPath()`**, where they had a
  walker of their own that could not read `*`.
- **The Key of Solomon's text is held character for character** as the hours
  page had it, "voyages envoys" included, and cited "after" Mathers until
  it is checked against a scan; no copy of the 1888 text could be fetched.
- **`bodyPos`** is a selectable Tree label, not the layout key the plan
  called it; it is unchanged.

## Review

### Of the draft

The draft was reviewed adversarially by Fable 5.1 on 1 October. Its
findings and their disposition:

| Finding | Disposition |
| --- | --- |
| A stale `field=stone` image URL returns 400, not a blank label | Decision 5 restated; the owner checked the saved rituals and accepted the 400s |
| The mutation test writes a literal `*` key through `setProperty`, so commit 2 would fail it | The test learns the wildcard in commit 1 |
| Commit 2's inventory was far larger than listed | Listed in full |
| Three search descriptions change, not two, and four flashcard sets | Effects corrected |
| Where Malchut's gloss lives was unstated, and the full phrase as a name would be a 44-character Tree label and a title | Split into name and gloss (decision 2) |
| The ten-heavens flashcards would read "Sphere of World of Foundations" | They answer with the gloss where there is one |
| The Key of Solomon strings are fragments, and the page's text is not verified verbatim | Framed on the planet page and cited "after Mathers" until checked |
| Reading the barrel would put the data chunk on the hours route | The server page passes the strings as props |
| Smaller: `*`'s `many`, a stale test comment, lower-case Tree labels, the `materia` directory | Folded in; the directory stands, as the owner approved it |

### Of the implementation

An independent review by a fresh Opus 5.5, given the plan, the diff and the
code, found nothing critical or high. Its findings and their disposition:

| Finding | Disposition |
| --- | --- |
| Medium: chained `*` through looping links grows tenfold a level, and the Tree page takes paths from the query string | One `*` per path ([above](#what-was-decided-while-building-it)) |
| An escaped `\*` read as a wildcard | Only an unescaped, whole segment counts |
| `pathTarget()` accepted a path through `*` that ends on a row | Refused |
| An empty id list passed `data:check` | Refused |
| One commit message counted five names and listed four; three long lines | Corrected |

It verified the data row by row for all eleven sephirot, every flashcard
card at both ends, the three search descriptions, the render identity by
mutating a stone, a scent, a body part and a relink, and the hours page's
seven strings against the old labels.

The final review, on Fable 5.1, found nothing of substance on `7249dc7` and
confirmed each of those fixes, with two low notes: the wildcard's regular
expression differed from dot-prop's escaping in one corner and used a
lookbehind, which became the scanner; and a README line ran long, rewrapped.

## After the owner's review

The owner reviewed the pages on 2 October, with the Tree page's new paths.
Three commits followed, checked the same way and gated together:

| Commit | Change |
| --- | --- |
| `b9a2141` fix(data): Romanise Hebrew prefixes as Israel does | The README's rule widened from the article to every prefix, as the official romanisation has it: "YHVH Eloah VeDa'at", and "YHVH Tzvaot" without its stray hyphen; four search descriptions change with them |
| `d91ecde` fix(kabbalah): Set a Tree label's lines closer | A label's lines 1.2 font sizes apart where they were a fixed 22, and a list broken per item, "star ruby" over "turquoise"; the Tree's profile moves to `magickli-tree-image-outlines-v4` |
| `176ee0c` feat(astrology): Quote the Key of Solomon verbatim | Mathers' full sentences, checked against sacred-texts' transcription of his edition, which the owner supplied, and cited plainly |

The Key of Solomon question settled itself once the text was in hand:
each fragment the hours page held was the tail of Mathers' sentence word
for word, "voyages envoys" included, which is his; only Sol's had lost an
"and". Decision 6's "after Mathers" is withdrawn.

The profile move is the Tree's first since plan 030. It re-identifies every
Tree image once, which the two romanisation fixes did in any case through
the inputs hash; bytes move only for a Tree whose middle labels have more
than one word, and the Theoricus ritual's Tree and the social cards keep
theirs.

## Deferred

- Pictures of stones and scents (decision 7).
- Stones and scents for the planets and signs, which other tables give
  them; the tables are built so that a planet can link them later.

## Follow-ups

- The source of magickTypes is deferred indefinitely, by the owner's
  decision of 2 October; the planet page keeps the editorial-summary note.
- Done, 2 October: the Key of Solomon checked against Mathers and quoted
  verbatim, and the two god-name romanisations
  ([above](#after-the-owners-review)).
