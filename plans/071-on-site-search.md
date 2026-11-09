# On-site search work — 9 November 2026

Status: decided and reviewed 9 November 2026; the spike next. Read
[current status](000-current-status.md) first. This plan
follows the whole-site SEO of [plan 028](028-seo.md) and the hall pages
of [plan 062](062-gd-hall-seo.md). It covers what the site itself can
do; links from other sites, Bing and keyword volumes are out of scope
(see "Not in scope").

Gadi's decisions of 9 November 2026, after the mock-ups
(`~/.cache/onsite-seo/seo-nav-mockups.png`: A a row under the bar, B the
trail in the bar, C section text and a footer):

- **No breadcrumb row (A).** The bar's dropdown was designed to keep the
  page uncluttered; it stays, made crawlable, with its hierarchy restored
  and the section's other pages added.
- **The trail in the bar (B) on wide screens only**, where it fits; phones
  keep the title and the dropdown arrow.
- **The footer (C), yes**, and the section text below the tiles.
- **`BreadcrumbList` structured data** on every page below a section.
- **Code shape.** One footer component beside the root layout and the app
  bar, given the current path, its links from the same registry as the
  dropdown; section text stays with each section's own page.

## Background

Search Console, read through the GSC Wizard plugin (read-only), property
`sc-domain:magick.ly`:

- **Little traffic.** 3 clicks and 387 impressions in the 28 days to
  7 November, average position 32 (`get_site_summary`); 104 clicks in the
  twelve months to October (`get_decay_overview`).
- **Most pages unseen.** 70 of the sitemap's 197 URLs had any
  impressions from 1 August to 6 November (`get_sitemap_performance`).
  None for the Tree of Life, Planetary Hours, the Enochian dictionary,
  Keys and Tablets, the 72 Angels list, any grade page, or eleven of the
  fourteen halls. Indexing of these is unconfirmed: URL Inspection needs a
  read-write connection, which we chose not to grant.
- **Section pages are thin and draw the impressions.** Server-rendered
  text, measured on 9 November: home 33 words, `/kabbalah` 22,
  `/astrology` 22, `/geomancy` 16, `/enochian` 179. Over 1 August to
  6 November they drew `/kabbalah` 981 impressions at position 70,
  `/enochian` 693 at 61, `/astrology` 395 at 66, `/geomancy` 165 at 73
  (`get_sitemap_performance`): Google tries them for broad terms and
  finds little to rank.
- **Tool pages have no text for search.** `/astrology/planetary-hours`
  serves 19 words; the hours appear only in the browser.
- **No navigation in the server HTML.** The app bar's trail is a closed
  menu and the drawer renders nothing on the server, so the dictionary's
  only link is "sign in". Section tiles link down; nothing links up or
  across.
- **The Tree's SVG** puts `<title>Letter: ש, pathNo: 31, tarotId:
  20</title>` on every path (`src/components/kabbalah/TreeOfLife.tsx`
  ~393): debug text in the page and in its tooltips.
- **What works.** Angel pages rank 3 to 10 for several names (Sealiah,
  Poiel, Anauel, Omael, Mikael). `/enochian/oration` earns most clicks
  (24 of 49 since May, 24% CTR). `/geomancy/reference` sits near
  position 11.

## Goals and how we measure them

Each target page, the searches it should answer, and its baseline
(`get_sitemap_performance`, 1 August to 6 November 2026; "–" is no
impressions):

| Page | Searches it should answer | Impr. | Pos. |
| --- | --- | --- | --- |
| `/astrology/planetary-hours` | planetary hours calculator, planetary hours today | – | – |
| `/geomancy/reading` | geomancy reading online, geomancy generator | – | – |
| `/geomancy/reference` | sixteen geomantic figures, geomantic figure meanings | 61 | 10.7 |
| `/enochian/dictionary` | enochian dictionary, enochian words, enochian translator | – | – |
| `/enochian/keys` | enochian keys, enochian calls, 19 keys | – | – |
| `/enochian/oration` | john dee oration to god | 37 | 20.7 |
| `/kabbalah/tree` | interactive tree of life, tree of life diagram | – | – |
| `/kabbalah/yhvh/72angels` | 72 angels, shem hamephorash angels list | – | – |
| `/kabbalah/angel/<slug>` | "<name> angel", "<name> angel meaning" | e.g. Sealiah 14 | 15 |
| `/gd/halls` and halls | golden dawn temple layout, neophyte hall diagram | – | – |
| `/kabbalah`, `/enochian`, `/astrology`, `/geomancy` | mid-length terms in their subject | 981 / 693 / 395 / 165 | 60–73 |

After release: the same report at four and eight weeks, the pages'
impressions and positions against this table, and Vercel Web Analytics'
referrers for search traffic. Success at eight weeks: every target page
with impressions, and the section pages' positions moving from the 60s
towards 30. Rankings take weeks, so no earlier verdict.

## Decisions

Revised the same day after an adversarial review (Fable 5.1; verdict
"ready with changes", one blocker), whose findings are folded in below.

### 1. The bar: the `h1` alone, the trail beside it, the menu crawlable

Today the dropdown lists only the parent section and the page, and MUI
mounts a menu only when it opens, so none of its links are in any HTML
Google reads. The menu also sits inside the `Typography` that renders the
`h1` (`MyAppBar.tsx` 359–442); while portalled that does no harm, but in
place it would put every menu item inside the heading. So:

- **The `h1` holds the page title alone.** The menu moves out of the
  `Typography`; a test pins `h1.textContent` to the title.
- **Inline trail on wide screens**: a sibling `<nav
  aria-label="Breadcrumb"><ol>` of the ancestors as links, before the
  title, shown from MUI's `sm` breakpoint (600 px; `theme.ts` keeps the
  defaults) and `display: none` below it.
- **The menu kept mounted and not portalled.** Verified in
  `@mui/material` 9.5.0: `Modal.js` 190 returns null only when neither
  open nor kept mounted, and `exited` starts as `!open`
  (`useModal.js` 47), so the server and the first client render agree;
  the closed root is `visibility: hidden` (`Modal.js` 59–61), out of the
  accessibility tree and the tab order; scroll lock runs only on open; on
  open, `aria-hidden` spares the ancestor chain (`ModalManager.js`
  74–99). The root is `position: fixed; inset: 0`, so no layout shift.
  One risk for the spike: `HideOnScroll`'s `Slide` transforms the bar
  while it animates, which makes the bar the containing block of the
  fixed menu; open it mid-slide.
- **The menu's items**: the trail (Home, each section above, the page),
  then the section's other static pages (for the Tree, the 72 Angels; for
  a hall, the halls index). Each item is `MenuItem component={NextLink}`,
  not a link nested in a menu item. On a dynamic page the bar has no
  title for the page (it falls back to the site name, `MyAppBar.tsx`
  106), so the current item is left out there rather than reading
  "Magick.ly".

What this is worth to search, honestly: Google indexes with a phone
viewport, where the inline trail is hidden and the menu closed. It reads
links from the DOM and indexes content hidden for layout, so they count,
but they are not the fix for "nothing links up or across". The visible,
load-bearing links are the footer (decision 3) and the section text
(decision 4).

### 2. Breadcrumb structured data

A `BreadcrumbList` in the JSON-LD of every public page below a section.
The bar cannot emit it (a client component in the root layout), so each
page does, through one helper beside `pageMetadata`: `pageJsonLd(path,
current?)` returns a graph node, which a page renders, or which the
halls (`halls.ts` 389–400) and La Science Cabalistique (`lenain.ts`
144–154) splice into their existing graphs instead of their own lists.
`routes.test.ts` requires it in every public and entity page source, as
it requires `pageMetadata`.

- **Names**: crumbs use short names from `pathnames.ts`; a dynamic page's
  own crumb is its short name (the angel's English name, the Sephirah's
  roman name, `gdHallShortName`), not its SEO title.
- **Google's rules**: `name` on every item, `item` on all but the last.
  The list starts at Home.
- **Top-level pages** (`/about`, `/study`, `/chat`, `/help/*`, and the
  built-in readers `/doc/neophyte`, `/doc/zelator`, `/doc/theoricus`)
  carry no list: a one-level trail says nothing.
- Entity pages emit it from their existing `Trail` back link
  (`src/components/entity/index.tsx`), where they know their own name.

### 3. A site footer

One component, `src/app/SiteFooter.tsx`, beside the root layout and the
app bar, rendered by the layout. It marks the current section with
`aria-current`, from the bar's path resolution, extracted into a shared
hook so both handle the static 404 the same way (it is prerendered at
`/_not-found` but served for any path; `MyAppBar.tsx` 53–72). Its links
come from the registry the menu uses, checked against `PUBLIC_PAGES`.

It renders only on the pages search is for: paths in `PUBLIC_PAGES` and
the entity routes, minus the full-screen ones (the readers under `/doc/`,
`/gd/halls/editor`, `/chat`). Private, account and offline pages get none
by construction, so the temples' docs screenshots do not change. The
route lists that `src/seo/routes.test.ts` keeps (`ENTITY_ROUTES`,
`PRIVATE_ROUTES`) move into a module both the footer and the tests use.

### 4. Text on the section pages

Home, `/kabbalah`, `/astrology`, `/enochian`, `/gd`, `/geomancy` and
`/books` gain 150–300 words below their tiles: what the section holds,
in our own words, linking every child page and listing its entities
(the Sephiroth, the planets, the grades, the sixteen figures). Tiles stay
first, so the pages still open as the app. This, with the tool text, is
the main lever: these pages already draw most impressions.

### 5. Text on the tool pages

Planetary Hours, Moon Phases, Geomancy Reading and Reference, the
Enochian Dictionary, Keys, Tablets and Oration, the Tree of Life, the 72
Angels and the halls index gain a section below the tool: what it shows,
how it works (for the hours: unequal hours from sunrise and sunset, the
Chaldean order), how to use it, and links to related pages; 150–400
words each. It lives in the server `page.tsx`, outside the client tool
and any `useSearchParams` Suspense boundary (the Tree's server HTML shows
one before its container). The dictionary's fixed definition panel
(`dictionary.tsx` 42) covers what is below the tool, so the page keeps
room for it. No FAQ markup: Google shows FAQ results only for government
and health sites.

### 6. Fuller headings

The bar's title is the page's `h1` for static pages, and several read
bare out of context: "Dictionary", "Keys", "Tablets", "Reading",
"Reference", "Oration". They become "Enochian Dictionary", "Enochian
Keys", "Enochian Tablets", "Geomancy Reading", "Geomantic Figures",
"Oration to God" in `pathnames.ts` (plan 028's follow-up). Measured
(spike findings): three of them overflow a 360 px phone at 20 px, so the
bar sets a title wider than 160 px at 18 px. One source: a test requires
each `pathnames.ts` title to appear in its `PUBLIC_PAGES` title, so the
two cannot drift.

### 7. The angel pages

The cluster closest to page one. Keep the titles; add "meaning" to the
descriptions where the page carries one; link the decade's planet to
`/astrology/planet/<id>` and the sign to `/astrology/zodiac`.

### 8. Small fixes

- The Tree's path `<title>` reads "Path 31: Shin (ש), Judgement" from
  the data, not debug keys.
- Home tiles link `/enochian/`, `/geomancy/` and `/gd/`, which redirect;
  link the canonical paths, and grep every tile `to:` for a trailing
  slash.

### 9. Text, in our own words

The implementing agent drafts every text; Gadi reviews them on one sheet
before they are committed, as with the hall leads (plan 062, decision 9).
Facts only from our data and public-domain sources; nothing copied or
paraphrased closely from copyrighted books (AGENTS.md, "Outside
sources").

### Not in scope

Links from other sites, Bing Webmaster Tools and IndexNow, keyword
volumes, the chat page, and anything private.

## Spike findings (9 November 2026)

- **Entity pages already show a server-rendered back link**, `Trail` in
  `src/components/entity/index.tsx`, on angels, Sephiroth, paths, grades,
  planets and halls (decision 2).
- **The docs screenshots** that omit a clip take the whole viewport, bar
  included, at 1000 to 1280 px (`capture.mts` 99–263), so the inline
  trail changes them; one finds its screen by `h1` text ("Recently
  deleted"). They are regenerated in the stage that changes them.
- **Heading widths** in the bar (Roboto 500, 20 px), measured on the live
  site: 197 px free at 390 px, 167 px at 360 px. "Enochian Keys" 130,
  "Enochian Tablets" 153, "Oration to God" 129 fit both; "Enochian
  Dictionary" 178, "Geomancy Reading" 173, "Geomantic Figures" 169 fit
  only at 390 (at 18 px: 160, 156, 152).
- **Angel pages** name their decade's planet (`planetName(planetOf(no))`,
  `Angel.tsx` ~163) without linking it; `/astrology/planet/<id>` exists
  for each. Signs have no page of their own.

## Stages

Each stage a gated commit on `gate/onsite-seo`; Gadi fast-forwards. The
texts are drafted first, so Gadi's review runs while stages 1 to 3 land.

0. **Spike** (nothing committed): the menu opened mid-slide; trails for
   every sitemap URL; the texts drafted onto one review sheet.
1. **The bar**: the `h1` alone, the inline trail, the crawlable menu with
   trail and siblings, the shared path hook; docs screenshots regenerated
   (`/usr/local/bin/magickli-docs-capture`).
2. **Breadcrumb structured data**: the helper, every public and entity
   page, halls and book pages moved onto it.
3. **The footer**, with its route module.
4. **Small fixes, fuller headings, angel links.**
5. **Section and tool text**, after Gadi's review of the sheet.

## Verification

- `MyAppBar.hydration.test.tsx`, per representative path (a static page,
  a dynamic one, `/_not-found`): server and client agree; `h1` is the
  title alone; the menu's links are in the server HTML.
- `renderToString` of page components, as `src/app/entityRoutes.test.tsx`
  does: each target page's server HTML carries its footer and text; no
  private or full-screen route carries a footer.
- `routes.test.ts`: every public and entity page source calls
  `pageMetadata` and the breadcrumb helper; every sitemap URL has a valid
  list or, for a top-level page, none; every menu and footer link is a
  public page; `pathnames.ts` titles agree with `PUBLIC_PAGES`.
- The gate per commit; a browser check at 360, 390 and 1280 px of a
  section page, a tool page and an angel page, the menu opened.
- After release: the Rich Results Test on a page of each kind, then the
  four- and eight-week reports against the baseline table.

## Risks

- **Accuracy and tone** of written text on subjects readers know well:
  Gadi's review, and our data as the only source of facts.
- **App feel**: text and a footer make pages longer; both sit below the
  tools.
- **The menu's markup** while closed: hidden from screen readers and the
  tab order, verified in the MUI source and by the hydration test; the
  mid-slide case by the spike.
- **Rankings may not move** without links from other sites; this plan
  removes the on-site reasons, it cannot supply authority.
