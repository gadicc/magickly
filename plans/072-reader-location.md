# Reader location — 10 November 2026

Status: agreed with Gadi on 10 November 2026 (decisions below);
spiked the same day (see "The spike"); adversarially reviewed (Fable)
and revised the same day (see "The review"); Gadi answered its two
questions the same day (decisions 5 and 6). Built the same day on
`gate/reader-location` from `main` at 44e2f780, every commit gated and
the branch independently reviewed; see "The build". Awaiting release,
which needs Gadi to open a preview's `/api/geo` first.

Gadi's decisions, 10 November 2026 (questions at the end):

1. **Place search from GeoNames `cities15000`, through our own route.**
2. **Times stay on the device's clock**, with a note when the chosen
   place's timezone differs; the place's own clock is a follow-up.
3. **Development asks production's `/api/geo`** when online, since
   developers work from several countries; the picker otherwise.
   Changed from the proposed fixed London.
4. **"Use my precise location" now**, on click only.
5. **The generated city data is committed**, as an explicit exception
   added to AGENTS.md "Outside sources", with a README and archive.org
   copies of the source files (review finding 4).
6. **The weekday fix goes in this plan** (review finding 1).

Gadi said on 10 November 2026: a browser permission prompt on load is
off-putting; city-level accuracy from the IP is enough; Vercel gives
this free in request headers; choosing a place by hand would be nice.

## What exists

- `src/components/hooks/useGeoIP.ts` fetches
  `https://get.geojs.io/v1/ip/geo.json` from the browser on every mount.
  A third party sees every visitor's IP; a failure leaves `null`.
- Three users:
  - `planetaryHours.tsx` (`/astrology/planetary-hours`) shows
    "Loading location..." until `geo` arrives, **forever** if the fetch
    fails (offline, blocked by an ad blocker, geojs down). It prints
    `geo.city, geo.country` (geojs gives the country *name*).
  - `Moon.tsx` (`MoonWidget`, on `/astrology/planets`) uses only
    `latitude > 0` for the hemisphere; northern while unknown.
  - `geomancy/reading/reading.tsx` uses it for the upcoming planetary
    hours list; empty while unknown, with no message.
- `utils.tsx` needs only `{latitude, longitude}` (SunCalc). Times are
  formatted in the **device's** timezone, and the "day" is the device's
  day.
- `@vercel/functions` 3.10.3 is **already a dependency** (used by
  `src/api-lib/ipCheck.ts`). Its `geolocation(request)` returns `city`
  (decoded), `country` (ISO code), `countryRegion`, `latitude`,
  `longitude` (strings), `postalCode`, but **no timezone**, and its
  `decodeURIComponent` throws on a malformed `x-vercel-ip-city`.
- The service worker never caches `/api/geo` or `/api/places`:
  `src/app/sw.ts` puts `privateRuntimeCaching` before Serwist's
  `defaultCache`, and `src/offline/privateRequests.ts` (lines 28–32)
  treats every `/api/*` path except `file2`, `render/*` and
  `treeOfLife` as private. (The draft wrongly said `defaultCache`'s
  `NetworkFirst` rule would replay `/api/geo` offline; review
  finding 3.) Offline, both fail; only the browser's HTTP cache can
  answer `/api/places`.
- Two bugs in the hours today, reachable more often once anyone can
  choose a place (review findings 1 and 2, reproduced):
  - **Weekday.** `calcPlanetaryHoursForDayAndLocation` takes the
    planet of the day from `getDay(date)`, the *device's* weekday, but
    SunCalc returns the sunrise of the solar day nearest `date` *at the
    place's longitude*. Device in London at 20:00 on Monday, place
    Tokyo: Tuesday's Tokyo sunrise with Monday's (Moon) rulers.
  - **Polar day and night.** SunCalc gives `Invalid Date` sunrise and
    sunset for Tromsø on 1 December and 10 June and Murmansk on
    10 December (both in `cities15000`); date-fns `format` then throws
    during render and the page crashes. Visitors from there already hit
    this today through the IP lookup.

## Proposal

### 1. `GET /api/geo` from Vercel's headers

`src/app/api/geo/route.ts`, a few lines over a pure, tested
`parseVercelGeo(headers)` in `src/geo/`:

```ts
// → { city?, country?, region?, latitude, longitude, timezone? } | null
```

- Reads `x-vercel-ip-latitude`/`-longitude` (required: no coordinates →
  `null`), `x-vercel-ip-city` (RFC 3986-encoded; decoded in a
  `try`), `x-vercel-ip-country`,
  `x-vercel-ip-country-region` and `x-vercel-ip-timezone`.
- **Read the headers directly, not `geolocation()`**: it lacks the
  timezone, throws on bad encoding and returns strings to re-parse. The
  header-name constants can still come from `@vercel/functions`. No new
  dependency either way.
- Coordinates must be finite and in range; a city that fails to decode
  is dropped rather than shown with percent-escapes.
- `Cache-Control: private, no-store`. Pages stay static; the request
  goes to our own origin, so no third party sees the IP.
- Country names come from `Intl.DisplayNames(["en"], {type: "region"})`
  on the client, not a table.

### 2. One hook: `usePlace()`

Replaces `useGeoIP` in all three places:

```ts
const { place, status, setPlace, clearPlace } = usePlace();
// status: "loading" | "ready" | "unknown"
// place: { name, country?, latitude, longitude, timezone?,
//          source: "chosen" | "ip" | "device" }
```

- Order: a place the reader chose (`localStorage`, `magickli.place`) →
  the IP lookup → `unknown`.
- One fetch per page load, shared by all callers (module-level
  promise), and remembered in `sessionStorage` so moving between pages
  doesn't re-ask.
- `unknown` replaces the endless "Loading location...": the planetary
  hours page and the geomancy hours list show the place picker with a
  line saying the location couldn't be found. The moon widget stays
  silent (northern hemisphere).

### 3. "Change location": a place picker

A small `PlacePicker` (MUI `Autocomplete`) beside the place name on
the planetary hours page and above the geomancy hours list. Two ways to
find places:

| | **A. GeoNames, our own route** (recommended) | B. Open-Meteo geocoding API |
| --- | --- | --- |
| Data | `cities15000` (~33k places, pop. ≥ 15,000, or capital), trimmed to name, ASCII name, country, region, lat/long, timezone, population | Same GeoNames data, plus postcodes |
| Size | 1.8 MB raw, 0.77 MB gzipped (measured, see "The spike"), **server side only**; each answer ≤ 8 rows | Nothing in the repo |
| Privacy | Query stays with us | Typed query and visitor IP go to Open-Meteo |
| Terms | CC BY 4.0: attribution on the site (picker footnote + about page) | Free tier is non-commercial, 10k calls/day |
| Offline | Search needs the network; a chosen place still works | Same |
| Upkeep | A script regenerates the file when we want; cited by download date + SHA-256 | None, but a dependency on their uptime |

- Option A: `scripts/geonames/` builds `src/geo/places.json` from
  `cities15000.zip` and `admin1CodesASCII.txt`
  (`https://download.geonames.org/export/dump/`, which changes daily, so
  the plan records the download date and SHA-256 of each zip, per
  AGENTS.md "Outside sources"). `GET /api/places?q=` folds accents and
  case, matches prefixes of the name or ASCII name, ranks by
  population, returns 8. Static data: cacheable
  (`public, max-age=86400`).
- Smaller town than 15,000? `cities5000` (~68k) roughly doubles the
  file; `cities1000` (~165k) is ~5×. Start with 15000; the precise
  location button covers villages.
- Rejected: shipping the list to the browser (offline search, but
  ~0.6 MB on first open of the picker).

### 4. "Use my precise location" (on click only)

A button in the picker calls `navigator.geolocation.getCurrentPosition`
only when pressed, so nothing prompts on load. The result is saved as a
chosen place (`source: "device"`), named "Your location" with
coordinates (no reverse lookup, so nothing leaves the device). Works
offline.

### 5. Development and tests

Locally there are no `x-vercel-*` headers. Gadi develops from several
countries and there may be other developers, so a fixed city would be
wrong more often than right (decision 3). When the headers are absent:

- **Development** (`NODE_ENV === "development"`): the route asks
  production, `fetch(`${SITE_URL}/api/geo`)` from the dev server with
  `cache: "no-store"` and a short timeout, and passes the answer on.
  Server side, so production needs no CORS header; production sees the
  developer's own IP, as it would from their browser. Until
  production has `/api/geo` (the first release), or when offline or it
  fails, it answers `null` and the picker shows, same as production.
- **`GEO_FIXTURE=1`** (any environment except production builds)
  answers a fixed synthetic place (London) without asking anyone. For
  screenshots and browser checks: images contain only synthetic data
  (AGENTS.md), and a proxied answer would put the capturing machine's
  real city in them. No docs shot shows these pages today; a future one
  sets it.
- **Production** (and previews, which have the headers): headers only;
  none → `null` → picker.

Tests: `parseVercelGeo` (all headers, missing coordinates, encoded and
malformed city, non-numeric or out-of-range lat/long), the route
(no-store; in development, production's answer passed on, a production
failure or timeout → `null`, never a proxy in production;
`GEO_FIXTURE`), `usePlace` order and failure → `unknown`, the
places search (accents, prefix, ranking, limit), and the three pages'
tests updated from the `useGeoIP` mock.

## The spike — 10 November 2026

Downloaded from `https://download.geonames.org/export/dump/` on
10 November 2026 (server `Last-Modified` the same day, 02:47 GMT); the
files change daily, so these hashes pin what was measured and the
build script will print its own:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `cities15000.zip` | 3,366,739 | `0df068fe1eb445f18655559b9d80fdd45ac88535d8c27b7b4f5ce5e66b1107b3` |
| `cities5000.zip` | 5,726,161 | `8fa2f61e0fbe6ab023181a7b7dd19ad7994a895aed94a9ef4d301d95ea18fcf5` |
| `admin1CodesASCII.txt` | 151,571 | `2e4867f5397acb056ea26377601b57af37cb4c81399770225018e9e439e91ad3` |

Saved to archive.org the same day, and the archived bytes re-fetched
and matched all three hashes. The build script downloads from these
(the `id_` form returns the raw file) and refuses other bytes:

- `https://web.archive.org/web/20261110090942id_/https://download.geonames.org/export/dump/cities15000.zip`
- `https://web.archive.org/web/20261110091023id_/https://download.geonames.org/export/dump/cities5000.zip`
- `https://web.archive.org/web/20261110091031id_/https://download.geonames.org/export/dump/admin1CodesASCII.txt`

**Size.** `cities15000` has 34,210 places (356 time zones), `cities5000`
70,020. Trimmed:

| Format (cities15000) | Raw | gzip | brotli |
| --- | --- | --- | --- |
| JSON objects (id, name, ascii, country, region, lat, long, pop, tz) | 5,067 KB | 1,269 KB | 780 KB |
| Tab-separated lines, tz as an index | 2,292 KB | 984 KB | 672 KB |
| **Lean**: population order instead of a pop column, no id, region and tz as indexes, 3 decimals (~100 m) | 1,435 KB | 634 KB | 463 KB |
| **Lean + alternate names** (below) + district flag | **1,847 KB** | 773 KB | 570 KB |

`cities5000` in the lean format is 2,936 KB raw, about twice the size,
for small towns that the precise-location button already covers; stay
with 15000 (decision 1). The file is server side only: the browser gets
at most 8 rows per search. Committed as generated data (~1.8 MB, once),
rebuilt by the script.

**Search speed** (Node 25, one core, whole-list scan): parsing the lean
file takes ~50 ms (a cold start's cost), heap ~25 MB; a query takes
1–7 ms, up to 20 ms on the first queries while the JIT warms. No index
needed.

**Search quality** found two problems and fixed both:

- **Districts** (`PPLX`, 2,393 rows: "Zürich (Kreis 11)", "Paris 15
  Vaugirard") crowded out other towns. They can't be dropped, since some
  are where people say they live (Kowloon, Navi Mumbai, Setagaya), so
  they rank after every other match.
- **Old and other-language names** found nothing: Kiev, Bombay,
  Peking, München. GeoNames' `alternatenames` column has them; keeping
  the Latin-script ones of four letters or more for places of 300,000
  or more (1,951 places) adds about 410 KB raw, 140 KB gzip, and fixes all
  four (Kiev → Kyiv, Bombay → Mumbai, Peking → Beijing, München →
  Munich). They rank after name matches; an exact alternate should rank
  with name prefixes, since "München" put "Ottobrunn bei München" first.
  Smaller towns keep only their own name and ASCII name.
- "Place, where" (`paris, texas`, `paris, us`, `springfield, il`)
  narrows by country code, country name or region name; country names
  come from `Intl.DisplayNames` once at load (per row cost 25 ms).
- Accents and case fold both ways ("sao" finds São Paulo, "koln" finds
  Köln). GeoNames names Cologne "Köln", so "Cologne" works only through
  its alternate name.

**Vercel headers** (Vercel's request-headers documentation, read the
same day): `x-vercel-ip-timezone` is an IANA name (`America/Chicago`);
`x-vercel-ip-city` is RFC 3986-encoded; latitude and longitude are
decimal strings; `x-vercel-ip-country-region` is the up-to-three-letter
ISO 3166-2 subdivision code ("ENG"), not a name, so it is not shown.
Outstanding: the values on a real request, which only a deployment can
show; Gadi to open a preview's `/api/geo` before release.

## The review — 10 November 2026

A fresh Fable 5.1 agent (session effort, not pinned) read the plan,
the code it touches and the bundled Next 16 docs, and reported 15
findings. Findings 1, 2, 3 and 8 were reproduced in this session
(a spike script kept outside the repository); the rest were
checked against the code they cite. Each is accepted unless it says
otherwise. These resolutions override the sections above where they
differ.

1. **Far place, wrong planets** (major). Take the weekday from the
   sunrise's **local solar date**: the sunrise instant shifted by
   `longitude / 15` hours, then its UTC weekday. Needs no time zone or
   library, works for every source including the device, and sunrise
   (~6 a.m. solar) is never near a date line. Tests: Tokyo from London,
   Honolulu from London, home.
2. **Polar day and night crash the page** (major). `utils.tsx` returns
   a "no sunrise" or "no sunset" result instead of hours; the planetary
   hours page says "The sun does not rise (or set) here on this day",
   the geomancy list skips those days. Tests for Tromsø and Murmansk.
3. **Service-worker claim was wrong** (major). Corrected in "What
   exists". Add `/api/geo` and `/api/places` cases to
   `privateRequests.test.ts`. Offline: a chosen place still works;
   the IP lookup fails → `unknown`; search says it needs a connection;
   "Use my precise location" still works.
4. **The committed data file vs AGENTS.md** (major). The rule allows
   committing only small public-domain files; this is a ~1.8 MB CC BY 4.0
   derivative, and a SHA-256 of a URL that changes daily can't be
   re-fetched. **Gadi: allowed (decision 5).** As proposed: an explicit
   exception (a line in AGENTS.md "Outside sources" for generated,
   CC BY data the app serves), a README beside the file with source,
   licence, "modified" statement, download date and hashes, and an
   archive.org capture of the three files so the bytes stay
   retrievable.
5. **Hydration and one store** (major). `usePlace` is a
   `useSyncExternalStore` store: `loading` on the server and the first
   client render (as `useHydrated` does), so the prerendered HTML
   matches; `setPlace` updates every mounted caller and other tabs (the
   `storage` event); stored JSON is validated (version, finite and
   in-range coordinates) and every storage access sits in `try`/`catch`.
   A hydration test, as the repo's `*.hydration.test.tsx` files do.
6. **Failure must not stick** (major). A 5 s client timeout on
   `/api/geo`; only successes are remembered in `sessionStorage`; a
   failure retries on the `online` event.
7. **Picker details** (major). `filterOptions={(x) => x}` (MUI would
   otherwise drop "Kiev" → Kyiv); 2 characters minimum; 250 ms
   debounce; `AbortController` so a late "par" can't replace "paris";
   label "Springfield, Illinois, United States" with a stable key;
   loading, no-results and failed states; a visible label and MUI's
   live region; full width at 390 px.
8. **Time-zone names differ between sources** (major). GeoNames says
   `Asia/Kolkata`, V8 resolves `Asia/Calcutta` (also Kyiv/Kiev). The
   note compares **UTC offsets** at the times shown, not names; no note
   for `device` places, which have no zone of their own.
9. **Keep the data out of the browser bundle** (minor). Server-only
   modules under `src/geo/server/` with `import "server-only"`; read the
   file with `fs` plus an `outputFileTracingIncludes` entry, as
   `/api/search` does; name it for its format (`places.tsv`, tab
   lines with a JSON header); exclude it from Biome (`files.maxSize`
   is 1 MiB by default).
10. **Abuse and cost** (minor). `q` trimmed and capped at 64
    characters; `Cache-Control: public, max-age=86400,
    s-maxage=604800` so Vercel's CDN answers repeats; no usage
    reservation, unlike `/api/search`, because a search costs a few ms
    of CPU and no paid service. One region (`lhr1`) means slower typing
    far from London; acceptable with the debounce.
11. **Development proxy** (minor). Same gate as
    `src/app/api/dev/test-login`: `NODE_ENV === "development"` and no
    `VERCEL_ENV`; `GEO_FIXTURE` has the same gate. The target is the
    `SITE_URL` constant, never env or the request. The upstream answer
    goes through the same validation; non-JSON, redirects and errors
    → `null`. `GEO_FIXTURE=1` is set in the docs capture script's
    allow-listed env now, and agents' browser checks of these pages use
    it.
12. **Precise location** (minor). Round to 3 decimals (~100 m) before
    storing or showing; messages for denied, timed out, unavailable and
    insecure context (http on a LAN address); a "Use detected location"
    action calls `clearPlace`.
13. **Attribution and privacy** (minor). The about page's credits
    (`src/app/about/page.tsx`) name GeoNames with the CC BY 4.0 link and
    say the data was trimmed; the picker repeats a short credit. One
    line there says the location comes from the IP via our host, and a
    chosen place stays in the browser.
14. **Tests** (minor). Only the planetary hours page mocks `useGeoIP`
    today; the moon widget and geomancy reading get new tests for
    `loading`, `unknown` and `ready`. Plus findings 1, 2, 5, 6, 7 and 8.
15. **Nits.** Equator counts as northern (`>= 0`); the geomancy label
    gets wording for "Your location" and for `unknown`; "Done" below.

Not checked by anyone yet: real header values (a deployment), and
whether Vercel's firewall lets the dev server's request reach
`magick.ly/api/geo`.

Finding 1 changes which planet rules a day for every visitor, not only
chosen places: for most nothing changes, but near midnight on the far
side of the world it does. **Gadi: in this plan (decision 6).**

## Done

- `useGeoIP` is gone; the three pages use `usePlace`; no request to a
  third party on load.
- No "Loading location..." that never ends; polar places don't crash.
- Tests for header parsing, the dev path, the store, the picker, the
  search, the weekday and polar cases; the full gate passes in a clean
  worktree.
- Browser check at 390 and 1280 px with `GEO_FIXTURE=1`.
- Gadi opens a preview's `/api/geo` before release.

## The build — 10 November 2026

| Commit | What |
| --- | --- |
| 0377722b | This plan |
| f0fd45c5 | The planet of the day from the place's solar date; polar night and midnight sun |
| 9cb7dbf5 | `/api/geo` from Vercel's headers, the development proxy, `GEO_FIXTURE` |
| 64acb119 | GeoNames data, its build script, `/api/places` and its search |
| a01eef09 | `usePlace`, the picker, the three pages, the about page, search embeddings |
| 72dd15b1 | The day from the place's own calendar (Samoa, Tonga) |

Opus 5.5 subagents built it in parallel where the files allowed: the
hours, `/api/geo` and the places data at once, then the client half.

**Where the build differs from the plan above:**

- **Solar noon, not sunrise** (finding 1). The place's date is read at
  solar noon, which exists on polar days and is never near midnight.
  The day headings show that date, and the upcoming list also counts
  the night still running after solar midnight, which it missed before.
- **The date line** (branch review). Even solar noon shifted by the
  longitude is wrong where a country keeps the far side's date: Apia
  and Nuku'alofa (UTC+13) had Tuesday's planets on their Wednesday. The
  day is now the civil date at solar noon in the place's time zone,
  falling back to the longitude without one; a device position is given
  the device's zone when saved. Its own commit, since the fix needs the
  time-zone helpers of the client commit.
- **Polar transitions.** A day whose next day has no sunrise has day
  hours only; the page says the night has no hours.
- **`src/components` imports no app code or MUI**
  (`src/components/importBoundary.test.ts`, plan 061), so the picker and
  chooser live in `src/geo/`, and the moon widget takes the latitude as
  a prop, which the planets page passes.
- **The picker opens inline** under the place line rather than in a
  dialog: at phone width the keyboard and the suggestions share the
  page's scrolling. It returns focus to its button after a choice and
  has its own polite status line, since MUI's lives inside the popup.
- **Search** also knows "uk", "usa" and "uae", and a first-level
  region's letter code ("paris, tx", "washington, dc"; Canada's codes
  are numbers, so "london, on" works through "Ontario"). GeoNames' junk
  alternates beginning "xx" are dropped. Format 2; the file is
  1,650,444 bytes, SHA-256 `0cf7fb15…748870fd`, and rebuilds
  byte-identical.
- **The fixture** lives in `src/geo/fixture.ts`: a Next route module may
  export only handlers, and the first build of 9cb7dbf5 failed on it.
- **Site search.** The about page's credit and privacy lines are page
  prose, so site search's catalogue changed and its semantic index
  would have switched itself off (`src/search/semantic.test.ts` fails
  until republished). Gadi chose to have `pnpm search:publish
  gemini-embedding-2-768-search-v1` run here with the main checkout's
  environment; two runs embedded 5 passages (859 tokens), the rest from
  the cache, and the about change moved into a01eef09 so only one
  commit changes the catalogue.

**The branch review** (a fresh Opus 5.5 agent, reasoning high, on the
whole branch): one major, the date line above, reproduced here before
fixing; and minor findings, all fixed: a late device position replacing
a place chosen meanwhile, lost focus, no announcements, flicker while
typing, no retry when back online, a dead `onInputChange` guard, the
about page not saying searches reach our server, a magic "Your area",
and the search quality items above.

**Gates** (clean worktree on /home, Node 24, CI's placeholder
environment: frozen install, `loom init` with no diff, `loom check` and
`--production`, `pnpm check`, typecheck, `test:coverage`, `build`; the
tip also the magick-data smoke test and the Turbopack build). Machine
load from other sessions ran at 17–31 for much of the day, and
`test:coverage` failed only on timing tests outside this change, each
passing on a re-run:

| Commit | Result |
| --- | --- |
| 0377722b | All pass |
| f0fd45c5 | All pass but coverage: 2 timeouts (`TrainingUpload`, `sqlLegacyImport`); coverage re-run: 3 timeouts (`ritualPug`, `sqlLegacyImport`, `TrainingUpload`); third run, quieter: pass |
| 9cb7dbf5 | All pass (its first version failed `build` on the route's extra export, see above) |
| 64acb119 | All pass but coverage: 1 focus-timing failure (`SearchDialog`); re-run: pass |
| a01eef09 | All pass |
| 72dd15b1 | All pass, smoke and Turbopack too |

**Browser check** (headless Chromium over CDP at 390×844 and 1280×900,
the Browser pane being hidden; dev server on 127.0.0.1 with CI's
placeholder environment): with `GEO_FIXTURE=1` the hours page shows
"London, England, United Kingdom" with the time-zone note on a device in
Asia/Jerusalem; "kiev" offers Kyiv, choosing it saves it with
Europe/Kyiv, returns focus to "Change place", drops the note (same
offset) and stops calling `/api/geo`; "springfield, il" offers
Illinois; the open picker shows "Use my precise location" and the
GeoNames credit; the geomancy reading says "Planetary Hour for Luna in
London" with "Change place"; no sideways scroll at either width.
Without the fixture the dev server asks production, which has no
`/api/geo` yet, and the page says the location couldn't be found with
the picker open. `/api/geo` answers `private, no-store` and
`/api/places` `public, max-age=86400, s-maxage=604800`. The only
console errors were the auth session's 503s, from having no database.

**Not verified:**

- Real `x-vercel-ip-*` values, and whether Vercel's firewall lets the
  development proxy reach `magick.ly/api/geo`: Gadi to open a preview's
  `/api/geo` before release.
- `navigator.geolocation` in a real browser (the tests mock it), and
  Safari altogether ([no device](000-current-status.md)).
- The installed `/usr/local/bin/magickli-docs-capture` is a root-owned
  copy of `capture-worktree.sh` and lacks `GEO_FIXTURE=1` until it is
  reinstalled; no shot shows these pages today.

## Open questions for Gadi (answered above)

1. **Place search: A (GeoNames, our route) or B (Open-Meteo)?**
   Recommend A.
2. **Timezone of a chosen place.** Times are shown on the device's
   clock. Choosing your own city (VPN, wrong IP) is fine; choosing a
   far city (planning for Tokyo from London) shows Tokyo's hours on
   London's clock, and the day boundary is London's. Recommend: keep
   the device clock and say so when the place's timezone differs
   ("times in your device's time, Europe/London"); showing the place's
   own clock is a follow-up (needs a timezone library and touches
   `utils.tsx`).
3. **Development fallback:** a fixed London (proposed) or the
   picker?
4. **Precise location button:** include now (recommended) or later?

## Release

1. Gadi opens a preview deployment's `/api/geo` and checks the place
   and the time zone look right.
2. Fast-forward `main` to `gate/reader-location` and deploy.
3. Reinstall `magickli-docs-capture` from `capture-worktree.sh`, so its
   dev server gets `GEO_FIXTURE=1`.
