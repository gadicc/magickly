# Geomancy texts from public-domain sources — 10 November 2026

Status: built 10 November 2026, after Gadi accepted the texts on a
side-by-side sheet (with "unfavourable" for "evil", decision 1). Read
[current status](000-current-status.md) first.

## Background

Checking the geomancy credits against Gadi's copy of *The Golden Dawn
Journal, Book 1: Divination* (ed. Chic Cicero and Sandra Tabatha Cicero,
Llewellyn, 1994) showed that the site's geomancy texts follow Mitch and
Gail Henson's essay "By the Signs of the Earth: Geomancy in the Golden
Dawn" (pp. 145–175) closely, under a credit. AGENTS.md ("Outside
sources") keeps copyrighted wording out of the repository; a credit is
not permission.

What the comparison found (word runs of four or more, by script; the
essay's text was never printed or committed):

- **The figure-by-house table** (16 figures × 12 houses, in
  `packages/magick-data/src/geomancy/tetragrams.json5`, `meanings`) is
  the Golden Dawn's own table, which Crowley printed in "A Handbook of
  Geomancy", *The Equinox* I(2), 1909 (archive.org
  `crowley-equinox_202110`), in abbreviated form ("Good, esp. agreeing
  with 5th"). The essay spells the abbreviations out and modernises a few
  words ("Unfavourable" for "Evil"). The table can stay, cited to the
  Equinox, in its wording.
- **Each figure's general meaning and translation**: about half match
  the Equinox; the rest are the essay's.
- **The twelve houses' descriptions** (`houses.json5`): the essay's own
  prose, all twelve.
- **The reading page's invocation** (`src/app/geomancy/reading/reading.tsx`):
  the essay's, p. 155. Its pattern (Adonai ha-Aretz, Uriel, the Ashim,
  then the planet's archangel, Intelligence and Spirit) is Golden Dawn
  correspondence, which we hold as data; its wording is not ours.

## Decisions

### 1. The table from the Equinox

Transcribed from the page images (pp. 154–156, leaves n158–n160; the
figures' English names pp. 141–142, n145–n146), with three editorial
changes, listed under "Edited cells" below:

- Crowley's abbreviations spelled out ("esp." → "especially").
- "Evil" and "ill" read "unfavourable" (Gadi, 10 November 2026: "evil"
  would scare newcomers, and the old sense is a poor outcome, not
  wickedness), or "bad" in the paired formulas such as "good with good,
  bad with bad", where "unfavourable" reads clumsily. Crowley himself
  writes "sometimes good, sometimes bad" for Populus.
- A full stop ends each entry, as before.

The essay had made these changes and more, rephrasing many cells; with
only these, the wording is the Equinox's. 100 of the 192 house cells
were already its words; 92 changed back. Albus in the 7th, long "Good
except in all things", is "Good, except for war".

### 2. The meanings and translations from the Equinox

Where the Equinox prints a figure's meaning or English name, we use it;
where it is silent, our own words from the Equinox's account or
Agrippa's *Fourth Book* (Turner, 1655).

### 3. The houses in our own words

One sentence each, a list of what the house governs, written from the
Equinox's "Of the Figure of the Twelve Houses of Heaven".

### 4. The invocation in our own words

Three sentences on the same Golden Dawn pattern, the code supplying the
names as it does now, the Hebrew of the three fixed names kept. It also
corrects the old text, which made the planet's archangel "Archangel (of
Malkuth?)": Uriel is named archangel of the North and of Earth, as in
the Pentagram ritual (*Liber O*, p. 19), and Malkuth is given only to the
Ashim, since Malkuth's archangel in the usual Golden Dawn tables is
Sandalphon. The drafting agent saw the old invocation once by accident
before drafting; Gadi compared the two on the sheet.

### 5. Clean room

The texts are drafted by an agent that reads only the public-domain
sources, never the essay or the current wording; the comparison against
the essay is run by script afterwards, and any draft that still shares a
long run with it is rewritten.

### 6. Credits

Both geomancy pages credit *The Equinox* and Agrippa, linked to the
archive.org pages, and say which text is ours. The essay is no longer
named, since nothing on the pages comes from it.

### Not in scope

Contacting the publisher or authors: not needed once the text is our
own or public domain. Gadi may still write to thank them.

## Stages

1. **Transcription and drafts** (scratch only): the Equinox table,
   meanings and house section from the page images; the expanded table;
   the house descriptions and the invocation in our own words.
2. **Side-by-side sheet** for Gadi (done; scratch only, not committed): current text, proposed text and its
   source, per field; the script's overlap with the essay for each
   proposed text.
3. **The commit**, after Gadi's acceptance: the data files with their
   source headers, the reading page's invocation, both credits, the
   byte pins and the site search refresh; the gate.

## Verification

- The overlap script: no proposed text shares a run of five or more
  words with the essay, except the Equinox table cells where the essay
  itself copies the Equinox.
- The gate per commit; both pages checked in a browser at 390 px.

## Risks

- **OCR of the Equinox table** is poor; every cell is read from the page
  image, uncertain cells listed.
- **Meanings readers know**: the Golden Dawn table is what GD
  practitioners use, so keeping it (decision 1) changes least.

## Results (10 November 2026)

The script's longest run of words shared with the essay: the house
descriptions 4 ("the end of the matter", also Crowley's phrase for the
4th house), the invocation 5 ("the day and hour of"), against 4 to 22
for the old house descriptions and 15 for the old invocation. The
Equinox's own wording shares long runs with the essay because the essay
copies it.

Uncertain on the page, kept as printed: Puella in the 4th, "But
indifferent". The Equinox gives Acquisitio's English name as
"Obtaining, comprehending without" (the tradition has "within"); the
site keeps its short translations and does not show these names.

## Edited cells

Abbreviations spelled out:

| Printed | Expanded to | Cells |
|---|---|---|
| `esp.` | especially | acquisitio.6, caput_draconis.7, cauda_draconis.4, fortuna_minor.11, puella.6, via.7 |
| `exc.` | except | albus.4, albus.7, amissio.3, amissio.5, amissio.6, amissio.10, carcer.1, cauda_draconis.8, fortuna_major.6, fortuna_minor.4, fortuna_minor.7, fortuna_minor.10, fortuna_minor.12, laetitia.1, puella.1, puella.7, puer.4, puer.8, puer.9, rubeus.3, rubeus.4, rubeus.5, rubeus.6, rubeus.7, rubeus.11, tristitia.6, tristitia.9, tristitia.10, via.1 |
| `v. ` | very  | amissio.meaning |
| `Gd.` | Good | amissio.meaning, tristitia.8 |
| `V. ` | Very  | amissio.2, amissio.7, puella.5 |
| `Cf.` | Compare | conjunctio.4 |
| `Med.` | Medium | tristitia.1, tristitia.2 |
| `gd.` | good | via.meaning |
| `figs.` | figures | via.meaning |
| ` & ` |  and  | via.meaning |

"Evil" or "ill" read "unfavourable" (67 cells):
acquisitio.12, amissio.1, amissio.10, amissio.12, amissio.2, amissio.3, amissio.4, amissio.5, amissio.6, amissio.7, amissio.9, carcer.1, carcer.10, carcer.2, carcer.3, carcer.5, carcer.6, carcer.7, carcer.8, carcer.9, carcer.meaning, cauda_draconis.10, cauda_draconis.11, cauda_draconis.2, cauda_draconis.3, cauda_draconis.5, cauda_draconis.7, conjunctio.10, conjunctio.8, fortuna_minor.4, fortuna_minor.7, fortuna_minor.8, laetitia.12, laetitia.3, laetitia.6, laetitia.8, populus.12, populus.8, puer.10, puer.4, puer.7, puer.8, puer.9, puer.meaning, rubeus.11, rubeus.12, rubeus.2, rubeus.3, rubeus.4, rubeus.5, rubeus.6, rubeus.7, rubeus.8, rubeus.9, tristitia.10, tristitia.11, tristitia.12, tristitia.3, tristitia.4, tristitia.5, tristitia.6, tristitia.7, tristitia.9, tristitia.meaning, via.1, via.6, via.8.

Read "bad" in the paired formulas (6): caput_draconis.meaning, cauda_draconis.meaning, conjunctio.1, conjunctio.meaning, populus.meaning, rubeus.meaning.

