# Data

Magickal correspondences and reference data as JSON5, with TypeScript types
beside each file.

Copyright (c) 2020-2026 Gadi Cohen, under [CC BY 4.0](./LICENSE.txt): use it
anywhere, including commercially, as long as you credit
[magick.ly](https://magick.ly). The app that reads it is
[AGPL-3.0-or-later](../LICENSE.txt); this data is deliberately freer, so that
it can travel.

Facts themselves belong to nobody. What is licensed here is the collecting,
wording and arrangement.

## Romanised Hebrew

A romanised Hebrew name writes its prefixes as Israel's official
romanisation does, the Academy of the Hebrew Language's system that BGN/PCGN
adopted in 2018: the article, the conjunction and the prepositions written
as prefixes in Hebrew are capitalised and joined to their word, "Roshit
HaGilgulim", "Chayot HaKodesh", "YHVH Eloah VeDa'at". Where that word begins
with an aleph, its vowel is capitalised in the same way, "Adonai HaAretz".
The library standard, ALA-LC, writes prefixes in lower case with a hyphen
instead; the data keeps to one of the two.

## Sources

Most of this is correspondences, which belong to nobody. Two sets are derived
from identified works and are worth naming:

**`seventyTwoAngels.json5`, `seventyTwoAngelsText/` and `lenain/`** come from
Lazare Lenain, *La Science Cabalistique* (Amiens, 1823), read page by page from
the Google Books scan in [`public/docs/`](../public/docs). That scan is of a
later reissue: it reproduces the 1823 title page and adds a preface by Papus
for the Ordre Kabbalistique de la Rose-Croix. The volume does not date itself;
the first reprint is recorded as Dujols and Thomas, 1909. Lenain died in 1877
and Papus in 1916, so **no rights are asserted over either text**.

What is offered under CC BY 4.0 is the work done on top: the English translated
from that French, the choice and arrangement of fields, the editorial apparatus,
and the corrections. No rights are claimed where none subsist. Nothing in it
draws on any modern published translation of the work — the point of the
exercise was a copyright-free rendering of the same public-domain material.

The Hebrew names are given both as Lenain points them and as bare letters.
Forty-seven are there because two independent readings of the scan agree;
twenty-five were read by a person who reads Hebrew, and each of those carries a
note saying so. See [plan 031](../plans/031-seventy-two-angels.md).

**`keyOfSolomon` in `astrology/planets.json5`**, on the seven classical
planets, is what *The Key of Solomon the King* says each planet's days and
hours serve for, after S. L. MacGregor Mathers' translation (London, 1888),
Book I, chapter II. Mathers died in 1918, so the translation is in the public
domain and **no rights are asserted over the text**. The text is held as the
planetary hours page has always shown it, which may abridge Mathers lightly
(Luna's "voyages envoys", Sol's list with no "and") and has not yet been
checked against a scan; until it is, it is cited as "after" Mathers. See
[plan 039](../plans/039-correspondence-tables.md).
