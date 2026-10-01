# Correspondence tables

Assessment and decisions, 1 October 2026. Read
[current status](000-current-status.md) first. This takes up the data
follow-ups [plan 036](036-entity-pages.md#follow-ups) left: the entity pages
set fields side by side that had only ever been read one at a time, and set
side by side they disagree. Approved for implementation on 1 October.

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

## Review

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

## Deferred

- Pictures of stones and scents (decision 7).
- Stones and scents for the planets and signs, which other tables give
  them; the tables are built so that a planet can link them later.

## Follow-ups

- The source of magickTypes, should it turn up.
