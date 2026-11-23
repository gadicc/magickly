# Mirrored source pages

Pages of public-domain books that the site cites, so a reader can see the
cited page without leaving it: the source links on the planet pages, the
geomancy reference, the component explorer, Lenain's *La Science
cabalistique*, the 72 angels page and the kameas' pages open them in a dialog
(`src/sources/SourceLink.tsx`), and without JavaScript the same links go to
the page on archive.org or Google Books. `src/sources/mirroredPages.ts` is
the manifest: each page's scan, the original's size and SHA-256, the region
outlined on it (and, where pages cite parts of it apart, such as one
planet's names on Agrippa's leaves, a region for each), and the committed
file's size and hash.

`scripts/sources/mirror.mts` (`pnpm sources:mirror --originals <dir>`) makes
the files. It downloads each archive.org leaf's full-size JPEG
(`https://archive.org/download/<item>/page/n<leaf>.jpg`), and Kircher's
plate from Wikimedia Commons (`upload.wikimedia.org`), into a new, empty
directory, naming itself `magickli-sources-mirror/1.0 (+https://magick.ly)`.
On 19 November 2026 Wikimedia answered the script's request with HTTP 429
while serving the same file to curl, so where a download is refused (HTTP
403 or 429, or a request that fails outright) the script reads a copy
fetched by hand instead, and says so: the original, saved with curl into
the `--originals` directory as
`commons-Kircher-Diagram_of_the_names_of_God_(22593924).jpg`, its hash
checked like any other. Any other failed status stops the run. Google Books page images cannot be downloaded by a script (their
URLs carry a short-lived signature), so the two Lenain originals were
fetched by hand on 18 November 2026: each page opened in the Google Books
viewer at books.google.co.uk with `hl=fr` (hence the watermark "Numérisé par
Google") and `zoom=3`, the largest size it served, 2500 pixels tall, and the
page image saved as PNG. A fresh fetch may not reproduce these bytes or
their hashes: Google may serve the page at another size or encoding. The
owner keeps the originals outside the repository; the script reads them from
the directory `--originals` names, as `googlebooks-<id>-PA<page>.png`. The
script checks each original's SHA-256, and writes a WebP 1600 pixels wide
(an original narrower than that keeps its width) at quality 75 with no
metadata, with sharp 0.35.5 (libvips 8.18.7, libwebp 1.6.0); other versions
may produce different bytes. Nothing else is changed: no crop, no
retouching, no colour correction. The service worker does not precache this
directory (`next.config.ts`); a page viewed is cached at runtime like any
image.

| File | Source | Original | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| heydon-theomagia-1663-p13.webp | John Heydon, *Theomagia, or The Temple of Wisdome*, vol. 1 (London: Brome and Rooks, 1663/4), book I, ch. 5, p. 13; [archive.org `theomagiaortempl00heyd`, leaf n124](https://archive.org/details/theomagiaortempl00heyd/page/n124/mode/1up), the Getty Research Institute's copy | JPEG, 1860 × 3172, SHA-256 8942795dca6abbbde55ff46bfa1974c4e1c5cd812e632f1457c97b3235aa7a09 | 228774 | 5c94f32a0d8c393168b5cb714f02eb48c9990158fff17ade5156b18ca7de9817 |
| heydon-theomagia-1663-p15.webp | The same, p. 15; [leaf n126](https://archive.org/details/theomagiaortempl00heyd/page/n126/mode/1up) | JPEG, 1860 × 3172, SHA-256 05d36cd6d3240951e3a2731520ca793ac8bec5b1eeee0434ec7d7f176690f7e9 | 203016 | 995cc4f5d536b4f8cee09a6491e2ea911b4a74ae680d1f9168528d6eee2fa761 |
| agrippa-de-occulta-philosophia-1533-p148.webp | Heinrich Cornelius Agrippa, *De occulta philosophia libri tres* (Cologne: Soter, 1533), book II, ch. 22, p. CXLVIII, the names of the squares of Saturn to Mercury with their numbers, which the kameas' pages cite planet by planet; [archive.org `DeOccultaPhilosophiaLoc1533`, leaf n163](https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n163/mode/1up), the Library of Congress's copy | JPEG, 1800 × 2395, SHA-256 32f7f8289bed9242bcb4b4c16c3717f253bc96897a13902b332388f893288460 | 293488 | 852534b7c0ad3dad40b575638129d475aabecb0e15037a69a712325375112c9c |
| agrippa-de-occulta-philosophia-1533-p149.webp | Heinrich Cornelius Agrippa, *De occulta philosophia libri tres* (Cologne: Soter, 1533), book II, ch. 22, p. CXLIX, the Moon's names, and the squares of Saturn and Jupiter with their seals and characters, which the kameas' pages cite too; [archive.org `DeOccultaPhilosophiaLoc1533`, leaf n164](https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up), the Library of Congress's copy | JPEG, 1800 × 2428, SHA-256 a765a1d827da2319d93ae421683ed3ee946272bd634510a537af440c9505ec39 | 212048 | 5c0e39e1c5f0ab8721abb9015de606d92c1dde682b7d59a30b4e62f5881159ae |
| lenain-science-cabalistique-1823-p25.webp | Lazare Lenain, *La Science cabalistique* (Amiens: the author, 1823), ch. IV, p. 25, the first cabalistic table, folded so that rows 57 to 72 show; [Google Books `qt9SAAAAcAAJ`, p. 25](https://books.google.com/books?id=qt9SAAAAcAAJ&pg=PA25), the Koninklijke Bibliotheek's copy, digitised by Google Books | PNG, 1574 × 2500, SHA-256 2519a63a554e331ee1f1d33b54f4c07851a309a1854c2b274bc57065e7d7077a | 223294 | 313b468478b548b4497ab50eb100386d27251e8bef7d4fbadfeeab870b616360 |
| lenain-science-cabalistique-reissue-p25.webp | The same, the undated reissue with Papus's preface (first recorded as Dujols and Thomas, 1909), p. 25, the same table, folded so that rows 62 to 72 show; [Google Books `ZqgpxTZ43HkC`, p. 25](https://books.google.com/books?id=ZqgpxTZ43HkC&pg=PA25), the Bibliothèque municipale de Lyon's copy (Bibliothèque jésuite des Fontaines), digitised by Google Books | PNG, 1633 × 2500, SHA-256 4b70bceaf9421a8ddfd1d618ded326de1d7ca473808ea2c601db86dd31ef41b6 | 174376 | 791476c6d4aee7f784641481cade0e1f8c53b6f071a340fc24933010260438cc |
| kircher-oedipus-aegyptiacus-1653-p271.webp | Athanasius Kircher, *Oedipus Aegyptiacus*, vol. II part 1 (Rome: Mascardi, 1653), class IV, ch. 6, p. 271, the seventy-two names of God from Exodus 14, rows 1 to 24; [archive.org `A027083`, leaf n278](https://archive.org/details/A027083/page/n278/mode/1up), the Universidad de Sevilla's copy (A 027/083) | JPEG, 3456 × 5184, SHA-256 7801818bfe0619c7a5deaf740f4979d32376262662710f878e67b5dbb358b9d0 | 302400 | c810b18f98ca7dc50f5bef4b04af20e602b00599b6df006e3a7fba2cbcb19018 |
| kircher-oedipus-aegyptiacus-1653-p272.webp | The same, p. 272, rows 25 to 67; [leaf n279](https://archive.org/details/A027083/page/n279/mode/1up) | JPEG, 3456 × 5184, SHA-256 367d28cf9bd61257e60faeb80836c81e5c5507a347e05252ad1d68462801b1f6 | 271166 | ec4082a6afe2a94b007b4aa1c51d984868363ce6185da7cfcd2219c4ffb8fb4a |
| kircher-oedipus-aegyptiacus-1653-p273.webp | The same, p. 273, rows 68 to 72, the page Lenain cites; [leaf n280](https://archive.org/details/A027083/page/n280/mode/1up) | JPEG, 3456 × 5184, SHA-256 bda31660c2599f5e32c8c4f7952decbe1133ac81fbf9f67a61455c3672229897 | 453438 | f9033bc7a6df286cf60ec6c60b0a09555fa4312214684b4850178efd4982a5b2 |
| kircher-oedipus-aegyptiacus-1653-p287.webp | The same, class IV, ch. 7, p. 287, where Kircher says every nation's name of God has four letters and introduces the plate of them that follows (not in this copy; it is in `bub_gb_XjfzMnomDQoC`, leaf n294, which is not mirrored), and the section "Explicatio Nominis Dei Tetragrammati": the other page Lenain cites; [leaf n294](https://archive.org/details/A027083/page/n294/mode/1up) | JPEG, 3456 × 5184, SHA-256 179eac0dbcc687d0c9f2b5dbf1427285d69207dbf6cbe28e3e809cc7449d34a4 | 438122 | 0f3b3f25511cf8500b4c6ee8a608915ea1084fd27a6dfeacb51712a8585ec088 |
| kircher-oedipus-aegyptiacus-1653-plate-p287.webp | Kircher, *Oedipus Aegyptiacus*, vol. II part 1 (Rome: Mascardi, 1653), the fold-out plate after p. 287, "Iconismus inserendus tom. II Fol. 287": the wheel of seventy-two four-letter names of God, each with its nation, the source of Lenain's first table's last two columns; the National Library of Poland's copy, [Wikimedia Commons, "Kircher-Diagram of the names of God (22593924).jpg"](https://commons.wikimedia.org/wiki/File:Kircher-Diagram_of_the_names_of_God_(22593924).jpg), from [Polona](https://polona.pl/item/athanasii-kircheri-soc-iesu-oedipi-aegyptiaci-tomus-t-2-ps-1-gymnasium-siue,OTAyNjM5Ng/289/) | JPEG, 2926 × 4000, SHA-256 02d659c4e1326866bae618389de6baeef5ff9b121f4e57121faa116bc1ccbea6 | 779994 | 5c6a24a7756e9d219283f396de5e0ad9ee1f14a1c79fa53ecf657d38fff40125 |
| agrippa-philosophie-occulte-1727-p109.webp | Agrippa, *La Philosophie occulte*, translated anonymously (The Hague, 1727), vol. II, book III, p. 109, the line introducing the seventy-two angels' table; [archive.org `per_witchcraft-in-europe-and-america_agrippa-von-nettesh_1727_12_22`, leaf n588](https://archive.org/details/per_witchcraft-in-europe-and-america_agrippa-von-nettesh_1727_12_22/page/n588/mode/1up), from a microfilm in the series *Witchcraft in Europe and America* | JPEG, 5560 × 9289, SHA-256 384e4aa44f17f10bd6621c040929673bd3f2486df774c91ea26f800f2cf89564 | 240202 | 5a69930290d512b0debc9c9cdc5a65bc581aca180b2dd4e02eef039971de030f |
| agrippa-philosophie-occulte-1727-p110.webp | The same, p. 110, the table of the seventy-two angels' names in French spelling; [leaf n589](https://archive.org/details/per_witchcraft-in-europe-and-america_agrippa-von-nettesh_1727_12_22/page/n589/mode/1up) | JPEG, 5459 × 9247, SHA-256 9adfba99c5da26301bf4894d1d5efcb1da9de1f78cffac409588c57aa9dd2687 | 253674 | 616ed4befc67676ab210696fa470f7713e22fd687bf0f0d99f6a5fa8e913fc2b |
| mathers-key-of-solomon-1889-plate-4.webp | S. Liddell MacGregor Mathers (translator and editor), *The Key of Solomon the King (Clavicula Salomonis)* (London: George Redway, 1889), Plate IV, the pentacles of Jupiter, Figs. 18 to 21: the angels' names round Fig. 18's band, and the verses round Figs. 20 and 21, which the 72 angels' band and talisman sigils follow (plan 096); [archive.org `b24884431`, leaf n79](https://archive.org/details/b24884431/page/n79/mode/1up), the Wellcome Library's copy | JPEG, 2419 × 3355, SHA-256 eaab1316f053933e36da72e77333f1a5be79ae10882e83b06560a53f9b246168 | 129214 | a2d6c119964b509a2adcb2b222a71c4ebf750da2fe5165874a0ce2aa5fb86aa7 |

Total: 4203206 bytes (643838 for the sigils' three pages, 293488 for
Agrippa's names leaf, which the kameas' pages added on 21 November 2026
(plan 093, decision 7), 3136666 for Lenain's nine, and 129214 for
Mathers's Plate IV, added for the angels' sigil styles on 23 November 2026
(plan 096, decision 15)). Each WebP is 1600 pixels wide except the 1823 Lenain page,
which keeps its original's 1574. Kircher's plate is the heaviest at 779994:
a whole fold-out engraving, fine lines throughout, at the same width as a
page.

## Why they are public domain

- **The works.** Heydon's *Theomagia* was printed in London in 1663/4
  (archive.org dates the item 1663); Heydon was born in 1629, by the
  catalogue record, so on any account he died more than two centuries ago.
  Agrippa's *De occulta philosophia* was printed in Cologne in 1533, and
  Agrippa died in 1535; the woodcuts' cutters are anonymous. Kircher's
  *Oedipus Aegyptiacus* was printed in Rome in 1653, and Kircher died in
  1680. The French *Philosophie occulte* was printed at The Hague in 1727;
  its translator is not named, and whoever it was worked before 1727.
  Lenain printed *La Science cabalistique* in 1823 and died in 1877.
  Mathers's *Key of Solomon the King* was published in London in 1889; its
  title page names him alone, as its translator and editor, "with plates",
  and the plates are unsigned. Mathers died in 1918. archive.org marks the
  Wellcome Library's copy (`b24884431`) with the Public Domain Mark 1.0
  (checked 23 November 2026). The
  reissue adds Papus's preface (Papus died in 1916) and is a resetting of
  Lenain's text, first recorded in 1909; the page mirrored is Lenain's
  table, reset, with no new authorship in it (the reissue's corrections
  and modernised spelling are not original authorship), and a
  typographical arrangement is protected (in the United Kingdom) for 25
  years from publication only. No copyright term anywhere, the longest
  being the author's life and 100 years, still runs for any of them.
  archive.org marks the 1533 Agrippa and the Kircher (`A027083`) with the
  Public Domain Mark 1.0; the 1727 Agrippa's item carries no licence mark.
  Kircher's plate after p. 287 was printed in the same 1653 volume, and
  whoever engraved it did so by then; Wikimedia Commons marks the file,
  which it credits to the National Library of Poland, "Public domain"
  (checked 19 November 2026).
- **The scans.** A faithful photographic reproduction of a public-domain
  two-dimensional work carries no new copyright: in the United States,
  *Bridgeman Art Library v. Corel Corp.*, 36 F. Supp. 2d 191 (S.D.N.Y.
  1999); in the EU, Directive (EU) 2019/790, Article 14, which says that
  when the term of protection of a work of visual art has expired, material
  resulting from an act of reproduction of it is not subject to copyright
  or related rights unless it is original; in the United Kingdom, likewise
  in practice. Resizing and re-encoding add nothing original either.
- **Google's request.** Google digitised the two Lenain copies, and its
  notes on such scans ask two things: that they be used for non-commercial
  purposes, and that Google's attribution be kept. These are requests, not
  copyright. We keep the attribution: the mirrored WebPs keep Google's
  watermark, and the dialog's caption and the table above say "digitised by
  Google Books".

Only works out of copyright everywhere belong here. *The Equinox* I(7)
(1912), Plate X, which the Enochian pages also cite, stays an outside
link: who drew the plate is not established, and if it was J. F. C. Fuller
(died 1966) it is in copyright in the UK and the EU until the end of 2036.
