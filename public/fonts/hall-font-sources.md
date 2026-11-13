The temple-hall diagrams (`packages/magick-components/src/gd/hall`, plan 061) draw their
labels and caption in Noto Serif Italic, the compass labels in Noto Serif Bold
Italic and their Hebrew (the letter banners, the Tarot keys' letters and the
Pantacle's ring) in Frank Ruhl Libre Bold, which replaced Noto Serif Hebrew
Bold on 11 November 2026 (plan 061, decision 7, corrected). google/fonts
ships these families only as variable fonts, so
`scripts/gd-hall-fonts/build.py` downloads them from google/fonts commit
`8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5` (the commit
`assets/fonts/README.md` pins for Noto Emoji), checks their SHA-256, makes
static instances (Noto Serif at width 100; Frank Ruhl Libre has only a weight
axis) with the fontTools instancer and subsets them. The subsets keep only the
`kern` layout feature, so no renderer can form ligatures, and keep the
copyright and licence names.

| Source | SHA-256 |
| --- | --- |
| [`ofl/notoserif/NotoSerif-Italic[wdth,wght].ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoserif/NotoSerif-Italic%5Bwdth,wght%5D.ttf) | e87acbc6c0efd0d9a20d6a8cbbda2b266c14be3a3a6f5af8ec9d7b2460570ad1 |
| [`ofl/frankruhllibre/FrankRuhlLibre[wght].ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/frankruhllibre/FrankRuhlLibre%5Bwght%5D.ttf) | f9bf26966681037aae894b031bd0dcf2c1bfdfa128dd0640cf276fe62a338a43 |

| File | Instance and subset | Bytes | SHA-256 |
| --- | --- | --- | --- |
| NotoSerif-Italic-latin1.woff2 | weight 400; U+0020–007E, U+00A0–00FF, U+2013–2014, U+2018–2019, U+201C–201D, U+2026 | 11464 | 9f950c9e9439445d096145d53dcb951ec3baa9d71efbd206a87c70d876e538dd |
| NotoSerif-BoldItalic-compass.woff2 | weight 700; the letters of "East West North South" | 2072 | f39a880b7b95a001802b1cb02f3ae8ffea9e656065a54f8d3bbd43b833d6ded0 |
| FrankRuhlLibre-Bold-letters.woff2 | weight 700; U+05D0–05EA (the 22 letters and 5 final forms) | 3424 | a8d45534f1361f1375491d4fa24e24d486620a783dbf9741b4c36b7529932de2 |
| ../../assets/fonts/NotoSerif-Italic-latin1.ttf | the same subset as TrueType, for the server's image renderer (plan 062) | 26112 | b17042575847967023a24dba5b9b4b16aa9fe9a627005acfed7b18ca2c48c6b9 |
| ../../assets/fonts/NotoSerif-BoldItalic-compass.ttf | the same subset as TrueType | 3908 | d443ee9985cdaf7c3aa1120bfb3971b8f4f1b42896bf2c07cec5833b3336f475 |
| ../../assets/fonts/FrankRuhlLibre-Bold-letters.ttf | the same subset as TrueType | 7812 | 84304f1b7ce5fcce319b52946a714205d158f5a4ebc6050511090c50b41753ae |
| ../../packages/magick-components/src/gd/hall/fontMetrics.json | advances and GPOS kern pairs (by class) of the three subsets, in font units | 10250 | db90eb9f1be58f60effd724901321932570ad1d6e6df0b948602f579123a5d3f |

Built with fontTools 4.66.1, Brotli 1.2.0 and uharfbuzz 0.56.2 (HarfBuzz
14.5.0 in the 11 November 2026 rebuild, which left the Noto Serif files byte
for byte as they were); other versions may produce different bytes. The
script checks that the kern table reproduces HarfBuzz's shaping, with
ligatures off, for every character pair, for a list of label strings and for
the Hebrew names on the Pantacle's ring. The soft hyphen (U+00AD) is
default-ignorable: HarfBuzz draws it as nothing and kerns across it, so the
table gives it no advance and no kern pairs, and the labels' measurement
skips it when kerning.

`NotoSerif-OFL.txt` (Copyright 2022 The Noto Project Authors) and
`FrankRuhlLibre-OFL.txt` (Copyright 2015 The Frank Ruhl Libre Project
Authors, https://github.com/fontef/frankruhllibre) are the upstream SIL Open
Font License 1.1 notices from the same commit; neither declares a Reserved
Font Name. `FrankRuhlLibre-OFL.txt` ends with a few lines of a GitHub page
footer; they are in the upstream file, which is kept byte for byte.
