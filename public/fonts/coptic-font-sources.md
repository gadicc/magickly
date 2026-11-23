The tablets page (`src/app/enochian/tablets`, plan 095) shows the Coptic
names of the Golden Dawn's gods (`gd/godForms.json5`, after Regardie's
table in *The Golden Dawn*, vol. 4, p.315) in Noto Sans Coptic, since no
other font the site ships covers Coptic. `scripts/coptic-font/build.py`
downloads the font and its licence from google/fonts commit
`8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` (the commit the hall fonts, the
Hebrew text font and Noto Emoji pin), checks their SHA-256, and subsets the
font to the 29 letters the fifteen names use and sou (U+2C8B), which stands
for the "st" sign the table adds to five names, keeping the copyright
and licence names and no hinting. It asks to keep `ccmp`, `kern`, `mark`
and `mkmk`, but none of the font's features has anything for these
letters, so the subset has none.
`NotoSansCoptic.css` declares it for those 30 code points only, and only
the tablets page imports the stylesheet, so a page fetches the font only
when it draws one of those letters. Like everything in `public/fonts`,
the font is also in the service worker's precache (`precacheEntries` in
`next.config.ts`), so an installed site has it for offline use.

| Source | SHA-256 |
| --- | --- |
| [`ofl/notosanscoptic/NotoSansCoptic-Regular.ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notosanscoptic/NotoSansCoptic-Regular.ttf) (Noto Sans Coptic 2.004) | 51990af1bb0df7be8bfe98fda97769cecfa36eee15381e5504df400276abd735 |
| [`ofl/notosanscoptic/OFL.txt`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notosanscoptic/OFL.txt) | 322570ceef6e9935b2422470682e42481903eb444fc416455c32c2c3c888c78c |

| File | Contents | Bytes | SHA-256 |
| --- | --- | --- | --- |
| NotoSansCoptic-gods.woff2 | weight 400; U+03E2–03E3, U+03EE, U+2C80–2C81, U+2C83, U+2C85, U+2C89, U+2C8B–2C91, U+2C93–2C95, U+2C99–2C9B, U+2C9D, U+2C9F, U+2CA1, U+2CA3, U+2CA5, U+2CA7, U+2CA9, U+2CAB, U+2CB1 | 2548 | 8cd86f936633722e0f79c76fa43f968b47328f5c9db128ec2adf9ef0de99e8de |
| NotoSansCoptic-OFL.txt | the upstream licence, byte for byte | 4382 | 322570ceef6e9935b2422470682e42481903eb444fc416455c32c2c3c888c78c |

Built with fontTools 4.68.0, Brotli 1.2.1 and uharfbuzz 0.57.0 (HarfBuzz
15.0.0); other versions may produce different bytes. The script reads the
letters from the data each time and checks that every one of them has a
glyph with ink and an advance in the subset, and that the subset maps
nothing else; `src/app/enochian/tablets/copticFont.test.ts` checks that the
stylesheet's `unicode-range` covers every letter of the names and sou. A
corrected spelling that needs another letter fails both until the font is
rebuilt and this table updated.

The font is SIL Open Font License 1.1, Copyright 2022 The Noto Project
Authors (https://github.com/notofonts/coptic), with no Reserved Font Name;
`NotoSansCoptic-OFL.txt` is the upstream notice.
