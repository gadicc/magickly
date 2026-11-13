# The hall fonts

`GdHall`, the temple-hall diagram, sets its labels in Noto Serif Italic,
its compass in Noto Serif Bold Italic and its Hebrew letters in Frank Ruhl
Libre Bold, under family names of its own, from these three subsets. Its
text is measured with exactly these files (`src/gd/hall/fontMetrics.json`),
so another build of either font may set it differently.

They are licensed under the SIL Open Font License 1.1, not MIT:
[NotoSerif-OFL.txt](./NotoSerif-OFL.txt) (Copyright 2022 The Noto Project
Authors) and [FrankRuhlLibre-OFL.txt](./FrankRuhlLibre-OFL.txt) (Copyright
2015 The Frank Ruhl Libre Project Authors), the upstream notices; neither
declares a Reserved Font Name. `FrankRuhlLibre-OFL.txt` ends with a few
lines of a GitHub page footer; they are in the upstream file, which is kept
byte for byte.

`scripts/gd-hall-fonts/build.py` in the
[magick.ly repository](https://github.com/gadicc/magickly) makes them:
static instances of the variable fonts in google/fonts commit
`8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`, subset, with only the `kern`
layout feature kept.

| Source | SHA-256 |
| --- | --- |
| [`ofl/notoserif/NotoSerif-Italic[wdth,wght].ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notoserif/NotoSerif-Italic%5Bwdth,wght%5D.ttf) | e87acbc6c0efd0d9a20d6a8cbbda2b266c14be3a3a6f5af8ec9d7b2460570ad1 |
| [`ofl/frankruhllibre/FrankRuhlLibre[wght].ttf`](https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/frankruhllibre/FrankRuhlLibre%5Bwght%5D.ttf) | f9bf26966681037aae894b031bd0dcf2c1bfdfa128dd0640cf276fe62a338a43 |

| File | Instance and subset | Bytes | SHA-256 |
| --- | --- | --- | --- |
| NotoSerif-Italic-latin1.woff2 | weight 400; U+0020–007E, U+00A0–00FF, U+2013–2014, U+2018–2019, U+201C–201D, U+2026 | 11464 | 9f950c9e9439445d096145d53dcb951ec3baa9d71efbd206a87c70d876e538dd |
| NotoSerif-BoldItalic-compass.woff2 | weight 700; the letters of "East West North South" | 2072 | f39a880b7b95a001802b1cb02f3ae8ffea9e656065a54f8d3bbd43b833d6ded0 |
| FrankRuhlLibre-Bold-letters.woff2 | weight 700; U+05D0–05EA (the 22 letters and 5 final forms) | 3424 | a8d45534f1361f1375491d4fa24e24d486620a783dbf9741b4c36b7529932de2 |

[gd-hall.css](./gd-hall.css) declares them with URLs relative to itself;
`scripts/gdHallCss.mjs` writes it from `GD_HALL_FONT_FILES`.
