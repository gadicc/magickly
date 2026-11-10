# Place search data

`places.tsv` is the data behind the place picker's search
(`GET /api/places`, plan 072). It is read only on the server, by
`places.ts`; it lives outside `public/` so nothing serves it by URL and
the service worker never precaches it. Committed as generated data under
the exception in AGENTS.md "Outside sources".

## Source and licence

From [GeoNames](https://www.geonames.org/), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The data has
been **modified**: we keep only places' names, ASCII names, first-level
region names (with their codes where those are letters, such as "TX"),
coordinates rounded to 3 decimals (about 100 m), time zones and a district
flag; drop the population and order by it instead; keep Latin-script
alternate names of four letters or more, folded to lower case without
accents, only for places of 300,000 people or more, and not those
beginning "xx"; and drop all other columns. The about page credits
GeoNames.

Downloaded from `https://download.geonames.org/export/dump/` on
10 November 2026. That directory changes daily, so the build reads the
copies saved to archive.org the same day, and refuses any other bytes:

| File | Bytes | SHA-256 | Archived copy |
| --- | --- | --- | --- |
| `cities15000.zip` | 3,366,739 | `0df068fe1eb445f18655559b9d80fdd45ac88535d8c27b7b4f5ce5e66b1107b3` | [web.archive.org](https://web.archive.org/web/20261110090942id_/https://download.geonames.org/export/dump/cities15000.zip) |
| `admin1CodesASCII.txt` | 151,571 | `2e4867f5397acb056ea26377601b57af37cb4c81399770225018e9e439e91ad3` | [web.archive.org](https://web.archive.org/web/20261110091031id_/https://download.geonames.org/export/dump/admin1CodesASCII.txt) |

`cities15000` is every place of 15,000 people or more, plus capitals:
34,210 places. Smaller places are reached with "Use my precise location".

## Format

One JSON header line (format version, source, licence, row count, the
time zone and region lists, a region carrying its letter code when it has
one), then one tab-separated line per place in descending population
order. `placesFormat.ts` documents the columns.
`places.fixture.tsv` is a hand-made file in the same format for the tests.

## Rebuilding

```sh
node_modules/.bin/tsx scripts/geonames/build.ts                 # downloads from archive.org
node_modules/.bin/tsx scripts/geonames/build.ts --from <dir>    # cities15000.zip and admin1CodesASCII.txt already in <dir>
```

The same input gives a byte-identical file. To move to a newer GeoNames
dump, save the new files to archive.org, then update the URLs and hashes
in `scripts/geonames/build.ts`, the table above and the download date in
both.
