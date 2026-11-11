# Planet pages worth indexing — 11 November 2026

Status: decisions accepted by Gadi on 11 November 2026, and the texts on
the same day; **built on 11 November 2026** on `gate/planet-pages` (see
"Build"). Read
[current status](000-current-status.md) first.

## Background

Search Console reports `/astrology/planet/sol` as "Discovered – currently
not indexed": Google knows the URL from the sitemap and from
`/astrology/planets`, and has never fetched it. From 1 August to
8 November 2026 the fifteen planet pages together had 4 impressions
(Neptune 3, Caput Draconis 1). The site as a whole had impressions on 84
of its 197 sitemap pages; the angels, paths, books and halls are among
them, the planets, grades and all sephirot but Keter are not.

Links are not what is missing: 103 sitemap pages link to a planet page,
the indexed angel pages among them. What Google sees from outside is a
family of fifteen short, alike pages, and it has not judged them worth a
fetch. Eight of them are close to empty:

| Page | Shows | Description |
| --- | --- | --- |
| Earth | Symbol, Grade 1=10 | 35 characters |
| Uranus, Neptune | Symbol, "the classical correspondences stop at Saturn" | 36–37 |
| Caput, Cauda Draconis | the same sentence, which is wrong for the nodes | 44 |
| Zodiac, Primum Mobile, World of Foundations | one sentence naming the sephirah | 50–78 |

Bing reports the same descriptions as too short (plans/000, 10 November).

The titles use the Latin and Golden Dawn names, "Sol ☉ Correspondences",
"Caput Draconis ☊ Correspondences", where readers search for the Sun, the
Moon and the north node.

## Decisions

### 1. The names readers search for

A planet may carry a `commonName` in `planets.json5`: "Sun" for Sol, "Moon"
for Luna, "North Node" for Caput Draconis, "South Node" for Cauda Draconis.
Where it has one, the page's title and heading lead with it, "Sun (Sol) ☉",
and so does the English column of `/astrology/planets`. URLs, ids and
`name.en` stay as they are, so every other table that names the planet is
unchanged.

### 2. Our own words for the thin pages

The eight thin rows (Earth, Uranus, Neptune, the two nodes and the
three spheres) gain an `about` (English) in `planets.json5`: two or
three sentences in our own words, from public-domain sources cited in the
file's header (see [Sources](#sources)). The page shows it as its lede, in
place of the sentence it has now; the nodes lose the wrong "stop at
Saturn". What each says:

- **Earth**: Malkuth and the sphere of the elements, the Zelator grade,
  and why astrology gives the Earth no sign or day.
- **Uranus, Neptune**: their discovery (1781, 1846), why the classical
  tables have no place for them, and the modern rulerships (Aquarius,
  Pisces), marked as modern. No Kabbalistic attribution without a
  public-domain source.
- **Caput, Cauda Draconis**: the Moon's nodes and eclipses, their
  traditional natures (Jupiter and Venus; Saturn and Mars), the Indian
  names Rahu and Ketu, and the geomantic figures that share their names,
  linked.
- **The three spheres**: what the heaven is and which sephirah it belongs
  to. Their pages also list the ten heavens of the sephirot in order, each
  linked, from the data the sephirah pages already use.

Earth's page links the element, Malkuth and the Enochian Earth tablet in
the same way.

### 3. The day of the week on the seven planets

The seven planets get a Day row, Sunday for the Sun to Saturday for
Saturn, from the table the planetary hours already use (`start` in
`src/app/astrology/planetary-hours/utils.tsx`, exported); no new data.

### 4. Descriptions of 110 characters or more

`planetPage` leads with the common name and adds the day and the signs a
planet rules; a row with an `about` takes its first sentence. Every one of
the fifteen descriptions is between 110 and 160 characters, and a test
says so.

### Build

What the build changed from the decisions above:

- **Descriptions of their own.** The texts' first sentences run past 160
  characters, so the eight rows with an `about` carry a `description` too,
  written from it, and `planetPage` uses it; the seven planets keep the
  generated one with the day and the signs.
- **The ten heavens are a table**, Heaven and Sephirah, under a heading of
  its own, with each symbol in a slot of its own before the name so that
  the names line up (Gadi, 11 November 2026), and each heaven's Hebrew
  under its name. The lede gives way to the `about`, so without the
  Hebrew there the sphere pages would lose their Hebrew names.
- **Headings keep the symbol after the name**, "Sun (Sol) ☉": a heading
  has nothing to line up with, and search results and screen readers
  read the word first. The planets list already puts the symbol first.
- **Links.** There is no page for the element of Earth and no anchor
  for one Enochian tablet or one geomantic figure, so Earth links
  `/enochian/tablets` and the nodes `/geomancy/reference`.
- **Sources.** Mathers §53 gives the heavens' names and glosses only;
  where the texts place the spheres (the Primum Mobile outermost, the
  fixed stars beyond the planets, the elements below the Moon) they
  follow the common Ptolemaic order, and the data file says so.
- **The weekday table** moved with `dayOf` to
  `src/components/astrology/planetDays.ts`, so that `src/seo` imports
  nothing from a route.

### Not in scope

The grades and the sephirot share the problem and may want the same
treatment; this plan measures what it does for the planets first. Inbound
links (plans/000) remain the larger lever and are Gadi's.

## Sources

Facts only, in our own words; "n" is the archive.org BookReader index
(`https://archive.org/details/<id>/page/n<N>`).

| For | Source | Where |
| --- | --- | --- |
| The ten heavens of the sephirot | Mathers, *The Kabbalah Unveiled*, 1887, Introduction §53 | `b24884443`, pp. 27–28 (n40–n41) |
| Earth, Malkuth and Zelator | *The Equinox* I(2), 1909: Liber O; "The Temple of Solomon the King" | `crowley-equinox_202110`, file "The Equinox Vol. 1, No. 2", pp. 22, 242 |
| The nodes, eclipses, their natures | Wilson, *A Complete Dictionary of Astrology*, 1819 | `b29298180`, pp. 13, 83 (n44, n114) |
| The Head a fortune, the Tail its contrary | Lilly, *Christian Astrology*, 1647 | `b30338724`, p. 83 (n116) |
| Rahu and Ketu | Monier-Williams, *A Sanskrit-English Dictionary*, 1899 | `ASanskritEnglishDictionary`, pp. 879, 309 (n920, n350) |
| Uranus found, 13 March 1781 | Herschel, "Account of a Comet", *Phil. Trans.* 71 (1781) 492 | doi:10.1098/rstl.1781.0056 |
| ⛢, the platinum sign | Bode, *Von dem neu entdeckten Planeten*, 1784 | `bub_gb_ZqA5AAAAcAAJ`, pp. 95–96 (n98–n99); Commons `File:Uranus_symbol.svg`, `File:Uranus_monogram.svg` |
| Neptune found at Berlin, 1846 | *MNRAS* 7 (1846) 153; Encke, *Astronomische Nachrichten* 25 (1847) 49 | doi:10.1093/mnras/7.9.153; doi:10.1002/asna.18470250402 |
| The modern rulerships, and that they were unsettled | Leo, *Astrology for All*, 1899, ch. XV; *The Art of Synthesis* (1st ed. 1912), pp. 100, 117; *How to Judge a Nativity*, pp. 27, 123, 126 | `bub_gb_8CwSAAAAYAAJ`; `artofsynthesis00leoa` (n127, n144); `howtojudgenativi00leoa` (n50, n146, n149) |

Not verified, so not said: Galle's name and the date 23 September 1846
(the papers are scans we did not read), Lalande as the author of ♅, and
Varley's 1828 rulership of Uranus. The form "Olam Yesodot" has no
public-domain source; Mathers gives "Cholom Yesodoth". The O.T.O.'s
re-keyed *Equinox* (`oto-equinox-vol-1-no-01-10`) carries a copyright
notice and is not used.

## Stages

1. **Names and descriptions**: `commonName`, title, heading, the list
   page, `planetPage`, the Day row; tests; site search refreshed.
2. **The texts**: `about` for the eight rows with the source header, the
   lede, the ten heavens on the sphere pages, the see-also links; tests;
   site search refreshed.

Each commit gated; the texts are accepted by Gadi on a sheet first.

## Verification

- Every planet description between 110 and 160 characters (test).
- `/astrology/planet/rahu` no longer says the correspondences stop at
  Saturn (test).
- The pages checked in a browser at 390 px, light and dark.
- After release: IndexNow lists the fifteen pages; Gadi requests indexing
  for Sol, Luna and the three spheres in Search Console; their state is
  read again after two weeks.

## Risks

- **Nothing may change in Google** until the site has more authority;
  the measurement after release says whether to go on to grades and
  sephirot.
- **Modern rulerships** are a convention, not a correspondence of the
  Golden Dawn; the text says so.
