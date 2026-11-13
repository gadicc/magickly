# Mirrored source pages

Pages of public-domain books that the site cites, so a reader can see the
cited page without leaving it: the source links on the planet pages, the
geomancy reference and the component explorer open them in a dialog
(`src/sources/SourceLink.tsx`), and without JavaScript the same links go to
the page on archive.org. `src/sources/mirroredPages.ts` is the manifest:
each page's item, leaf, download URL and SHA-256, the region outlined on it,
and the committed file's size and hash.

`scripts/sources/mirror.mts` (`pnpm sources:mirror`) makes the files. It
downloads each leaf's full-size JPEG from archive.org
(`https://archive.org/download/<item>/page/n<leaf>.jpg`) into a new, empty
directory, checks its SHA-256, and writes a WebP 1600 pixels wide at quality
75 with no metadata, with sharp 0.35.5 (libvips 8.18.7, libwebp 1.6.0);
other versions may produce different bytes. Nothing else is changed: no
crop, no retouching, no colour correction. The service worker does not
precache this directory (`next.config.ts`); a page viewed is cached at
runtime like any image.

| File | Source | Original (JPEG) | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| heydon-theomagia-1663-p13.webp | John Heydon, *Theomagia, or The Temple of Wisdome*, vol. 1 (London: Brome and Rooks, 1663/4), book I, ch. 5, p. 13; [archive.org `theomagiaortempl00heyd`, leaf n124](https://archive.org/details/theomagiaortempl00heyd/page/n124/mode/1up), the Getty Research Institute's copy | 1860 × 3172, SHA-256 8942795dca6abbbde55ff46bfa1974c4e1c5cd812e632f1457c97b3235aa7a09 | 228774 | 5c94f32a0d8c393168b5cb714f02eb48c9990158fff17ade5156b18ca7de9817 |
| heydon-theomagia-1663-p15.webp | The same, p. 15; [leaf n126](https://archive.org/details/theomagiaortempl00heyd/page/n126/mode/1up) | 1860 × 3172, SHA-256 05d36cd6d3240951e3a2731520ca793ac8bec5b1eeee0434ec7d7f176690f7e9 | 203016 | 995cc4f5d536b4f8cee09a6491e2ea911b4a74ae680d1f9168528d6eee2fa761 |
| agrippa-de-occulta-philosophia-1533-p149.webp | Heinrich Cornelius Agrippa, *De occulta philosophia libri tres* (Cologne: Soter, 1533), book II, ch. 22, p. CXLIX; [archive.org `DeOccultaPhilosophiaLoc1533`, leaf n164](https://archive.org/details/DeOccultaPhilosophiaLoc1533/page/n164/mode/1up), the Library of Congress's copy | 1800 × 2428, SHA-256 a765a1d827da2319d93ae421683ed3ee946272bd634510a537af440c9505ec39 | 212048 | 5c0e39e1c5f0ab8721abb9015de606d92c1dde682b7d59a30b4e62f5881159ae |

Total: 643838 bytes. Each WebP is 1600 pixels wide, Heydon's 2729 high and
Agrippa's 2158.

## Why they are public domain

- **The works.** Heydon's *Theomagia* was printed in London in 1663/4
  (archive.org dates the item 1663); Heydon was born in 1629, by the
  catalogue record, so on any account he died more than two centuries
  ago. Agrippa's *De occulta philosophia* was printed in Cologne in 1533,
  and Agrippa died in 1535; the woodcuts' cutters are anonymous. No
  copyright term anywhere, the longest being the author's life and 100
  years, still runs for either. archive.org marks the Agrippa item with the
  Public Domain Mark 1.0.
- **The scans.** A faithful photographic reproduction of a public-domain
  two-dimensional work carries no new copyright: in the United States,
  *Bridgeman Art Library v. Corel Corp.*, 36 F. Supp. 2d 191 (S.D.N.Y.
  1999); in the EU, Directive (EU) 2019/790, Article 14, which says that
  when the term of protection of a work of visual art has expired, material
  resulting from an act of reproduction of it is not subject to copyright
  or related rights unless it is original; in the United Kingdom, likewise
  in practice. Resizing and re-encoding add nothing original either.

Only works out of copyright everywhere belong here. *The Equinox* I(7)
(1912), Plate X, which the Enochian pages also cite, stays an outside
link: who drew the plate is not established, and if it was J. F. C. Fuller
(died 1966) it is in copyright in the UK and the EU until the end of 2036.
