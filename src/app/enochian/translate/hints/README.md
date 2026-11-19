# Gap hints

`table.json` is the data behind the Enochian translator's gap hints
(plan 081, S11): for an English word the lookup has no form for, one of
our glosses close to it in meaning ("related: RNAH ‘sunrise’"), shown
beside the gap as a suggestion and never put into the translation. The
route `hints.json/route.ts` serves it, built once at build time; the
page fetches it once, with the first English-into-Enochian result it
shows, gap or none, so the request says nothing about the text
(`load.ts`). It is committed as generated data under the exception in
AGENTS.md, "Outside sources", and carries a short `notice` naming
SCOWL and pointing here.

## Source

The English words are from SCOWL (Spell Checking Oriented Word Lists)
by Kevin Atkinson, release 2020.12.07:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| [`scowl-2020.12.07.tar.gz`](https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz) | 2,569,810 | `5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc` |

The link is SCOWL's own versioned release on SourceForge; no archived
copy existed on 17 November 2026, and any copy with these bytes will do.
The script refuses any other bytes (`scripts/enochian-hints/scowl.ts`).

The glosses are our own: the dictionary's meanings and Dee's English in
the Keys, as the lookup indexes them.

## What we changed

- **The lists**: only `english-words`, `american-words`,
  `british-words` and `british_z-words`, each at sizes 10, 20 and 35
  (twelve files). No proper names, abbreviations, contractions,
  upper-case words or variant spellings. The same four at sizes 40 to
  70 serve only to check our glosses' words (below); none of their
  words is in the table.
- **The words**: lower-case letters a to z only, each once. Dropped:
  every word the lookup gives a form for, reads as an inflection of one
  ("kings", "came"), reads as grammar ("could", "her"), or reads as
  another word (Dee's "shew" as "show"). On 17 November 2026 that kept
  38,645 of the lists' 40,202 words.
- **Our glosses**: each exact gloss of the lookup in its commonest
  tokenised wording (what is embedded, "of justice"), as the meaning
  spike built them, glosses worded alike merged; each keeps the forms
  the lookup shows for it, best first, at most three. Left out: glosses
  of grammar words only; names (tablet and Aethyr names, ministers,
  letters); the hub words DE, CHIS, NONCF, Q, LAP, GEH and BRINTS as
  forms; notes rather than meanings, by their wording (a question mark
  or "unk", a numeral, any character but letters, spaces, hyphens and
  apostrophes, or "name of", "line of", "root of", "title of", "word
  for", "also", "noun", "shortened" and the like:
  `isEditorialGloss` in `scripts/enochian-hints/glosses.ts`); the
  reviewed `denylist.txt` there, for what rules can't catch ("air name",
  "tablet of union", "to vanne the earth"); and, at build time, any
  gloss with a word outside SCOWL's lists to size 70 ("squar",
  "sangef", "not-ing"). On 18 November 2026: 1,365 candidates, 1,285
  in English words.
- **Denied hints**: the reviewed `word-denylist.txt` beside it names
  English words never hinted by a particular gloss, each with its
  reason: another sense of a homonym ("liquor" by "spirits", "railway"
  by "train") or only a likeness of spelling ("pump" by "pomp", "hart"
  by "the heart"). Denying the gloss would lose its good hints too
  ("ghosts" by "spirits"). Such a word gets no hint, not its next best,
  which no one has judged. On 18 November 2026 it denies 58 words under
  36 glosses.
- **The wording shown**: the dictionary's own wording of the meaning
  ("appear", "a bitter sting"), or, where only the Keys have it, Dee's
  ("to the terrour"); not the tokenised core that was embedded.
- **The recipe** (the spike's "similarity/bare"): the bare word and
  each gloss embedded alike, with the prompt
  `task: sentence similarity | query: ` before the text, by
  `google/gemini-embedding-2` at 768 dimensions through the Vercel AI
  Gateway (the site's search model, plan 070). A word's hint is the
  gloss with the highest cosine, kept when that cosine's z-score
  against the word's cosines to every gloss reaches the cut-off.
- **The cut-off**: z ≥ 7.0, chosen by judging (below); it would rise a
  tenth at a time if the table the route serves (compact JSON) were
  over 150 KB gzipped. The table records both (`asked`, `cutoff`).
- **What is kept**: per word, only its best gloss; per gloss, its
  wording, its forms and its words. No scores, vectors or other words.

## The run and the judging (17 November 2026)

- **The embedding** (Gadi's run): 40,147 inputs in 628 requests,
  343,253 tokens as the Gateway reported them, about $0.069 at $0.20 a
  million (5.0 bytes a token; the run's conservative estimate was
  $0.175, under its $0.25 cap).

Three judgings, in order, each by a separate fresh model judge with the
spike's rubric (good, loose or wrong, for the English word alone):

1. **Seed 81, z ≥ 5.5** (the spike's cut-off), the first build, before
   the glosses were cleaned (1,502 glosses, 7,174 words): 68 good, 112
   loose, 20 wrong (10% wrong), failing. `score`: z ≥ 6.24 would pass on
   it. Two of its wrong ones were the garbled "mean unk contemptuous
   tone", which led to the cleanup. Carried over the cleanup (195
   hints unchanged), its verdicts passed from z ≥ 6.25.
2. **Seed 82, z ≥ 6.25**, after the cleanup (3,650 words under 601
   glosses): 53 good, 126 loose, 21 wrong (10.5% wrong), failing.
   `score`: z ≥ 6.669 would pass on it.
3. **Seed 90, z ≥ 7.0**, held out: 111 good, 79 loose, 10 wrong (95.0%
   good or loose, 5.0% wrong), passing.
4. **Seed 91, z ≥ 7.0**, after the final review (18 November 2026):
   "tablet of union" denied as a gloss and the word denylist added,
   which took 58 hints out; the slightly different z-scores without the
   one gloss took out "aphorisms" and brought in "loudly", "ghost" and
   "antidotes". The table changed, so seed 90's sample no longer
   matched it; a fresh one was drawn, held out, from the rebuilt table,
   and judged by a fresh model judge shown no z-scores: 84 good, 112
   loose, 4 wrong (98.0% good or loose, 2.0% wrong), passing. Its wrong
   rows: "breathers" by "breath", "eightieths" by "eight", "fifth" by
   "not the fifth" and "ghost" by "the holy ghost". It is committed beside this file as `judged-z7-seed91.tsv`, and
   `scripts/enochian-hints/table.test.ts` checks the table is the one it
   was drawn from (it redraws the same 200 with seed 91).

**The 19 November 2026 rebuild** (plan 081's stage-2 follow-ups). The
vector cache was lost with a removed worktree and re-embedded in full
(`enochian:hints:run`), so this table is the first from the new cache;
an offline `build` reproduces it byte for byte. Main's exact inputs
weren't rebuilt from it (five of their glosses are gone now), so
whether the fresh vectors match the old ones is unchecked. The gloss
changes: LUIAHE's "a son of" corrected to "a song of", and the name
rule now takes "first, second and third aethyr", "the first aire" and
"king/prince of heptarchy" for names. The word denylist took out the
borderline hints of numbers and of words read inside longer ones:
"eighty" by "eight", "ninety" by "nineteen", "fourteenth" by "fourth",
"fifth" by "not the fifth", "sirloin(s)", "manifesto(s)",
"breather(s)", "ghost", and "phoned", "phoning", "telephoned",
"telephoning" and "dialled" by "call" (the telephone sense; the seed-91
judge had "phoned" good). With the scores moved slightly, "halving", "monologue"
and "workforce" fell under the cut-off and 14 words gained a hint. A
fresh judge shown no z-scores judged all 14: 8 good, 5 loose, and
"nigh" by "night" wrong (7% of the additions, over the 5% bar for
them alone), which is now denied, as is "bastards" by "you sons",
judged loose but poor on review. They are in
`judged-added-2026-11-19.tsv`. The seed-91 sample's rows other than
the removed words score 82 good, 111 loose, 0 wrong of 193; since its
four wrong rows were denied because this sample showed them, that zero
is not a fresh measurement, only a check that the removals took out
nothing the bar relied on. The test redraws the seed-91 sample from
today's table with the 22 removed words put back and the judged
additions taken out.

**Why 7.0**: the first two samples were each used to pick a cut-off
(6.24, then 6.67), so neither is a fair test of the cut-off it picked.
7.0 was chosen from both together, and the third sample, drawn only
after choosing, is the held-out check. It passed exactly at the 5% bar,
so the margin is thin: a later re-judging, or a dictionary change that
alters the glosses, should run that check again. The z-scores differ
from the spike's (its population kept grammar and hub glosses; SCOWL
brings inflections), which is why the cut-off was judged here rather
than taken from the spike.

**The shipped table**, at z ≥ 7.0: 1,660 words under 425 glosses,
27,596 bytes served, 11,316 gzipped (1,670 under 424 at 2H; before the
2H changes, 1,726 under 439). The cost of the margin is coverage: 3,650 words had a hint
at 6.25, 1,670 have one at 7.0.

## Format

One JSON object (`format` 2): `notice` (SCOWL's credit), `source` (the
release and lists), `recipe` (model, dimensions, revision and prompt
version), `asked`, `cutoff`, `glossHash` (SHA-256 of the recipe, every
candidate gloss's text, wording and forms, and the word denylist's
pairs), `rows` (words with a
hint) and `hints`, one gloss to a line: `[wording, [forms], "word word
…"]`, words sorted. `format.ts` documents it; the file is outside
Biome's formatter so each gloss stays on its own line. The same cache
and lists give the same bytes.

## Rebuilding

```sh
pnpm enochian:hints estimate                   # no network: counts and cost
pnpm enochian:hints:run                        # paid: embeds what the cache lacks, then builds
pnpm enochian:hints build --seed <n>           # no network: rebuilds from the cache
pnpm enochian:hints score <judged sample>      # does the judged sample ship?
pnpm enochian:hints rescore <judged sample>    # after a gloss change: the unchanged judged hints' cut-off
```

Each takes `--archive <scowl-2020.12.07.tar.gz>`, which may be left out
when the archive is at `.private/enochian-hints/scowl-2020.12.07.tar.gz`;
it is verified against its pinned SHA-256 either way. `run` checks the
Gateway's public price for the model first, refuses when a
conservative estimate (one token per two bytes) is over $0.25, and
stops before any batch that could take the tokens counted so far past
it; a reply without a usable token count (none, not a number, or 0,
since text never costs nothing) is counted at its conservative
estimate (`scripts/enochian-hints/spend.ts`). It caches
each vector in `.private/enochian-hints/vectors.jsonl`, keyed by its
exact input and the model, so a rerun embeds only new glosses or words,
and `build` (a new cut-off, say) costs nothing. SCOWL's lists are
extracted, by name, into `.private/enochian-hints/scowl/`.

`build` prints the rows, the bytes (raw and gzipped) and 200 random
hints (seeded) and writes them, with the rubric, to
`.private/enochian-hints/sample-seed<seed>-z<cut-off>.tsv`. It never
writes over a sample: if that file exists it stops before writing
anything (pass another `--seed`, `--sample <file>` or `--no-sample`).
Judges write good, loose or wrong against each; `score` says whether
the table ships (at least 90% good or loose, at most 5% wrong) and, if
not, the lowest cut-off at which the judged hints pass, its shares
counted exactly as the table built there would keep them. A build keeps
the committed table's `asked` unless `--cutoff` is given.

`scripts/enochian-hints/table.test.ts` fails when a dictionary or Keys
change alters the candidate glosses, their wording or their forms, or
when either denylist changes:
rebuild with `build`, after `run` when there are new glosses to embed,
then judge a fresh sample if many hints changed.

## SCOWL's notice

SCOWL's `Copyright` file, in full, as the release has it:

```text
The collective work is Copyright 2000-2018 by Kevin Atkinson as well
as any of the copyrights mentioned below:

  Copyright 2000-2018 by Kevin Atkinson

  Permission to use, copy, modify, distribute and sell these word
  lists, the associated scripts, the output created from the scripts,
  and its documentation for any purpose is hereby granted without fee,
  provided that the above copyright notice appears in all copies and
  that both that copyright notice and this permission notice appear in
  supporting documentation. Kevin Atkinson makes no representations
  about the suitability of this array for any purpose. It is provided
  "as is" without express or implied warranty.

Alan Beale <biljir@pobox.com> also deserves special credit as he has,
in addition to providing the 12Dicts package and being a major
contributor to the ENABLE word list, given me an incredible amount of
feedback and created a number of special lists (those found in the
Supplement) in order to help improve the overall quality of SCOWL.

The 10 level includes the 1000 most common English words (according to
the Moby (TM) Words II [MWords] package), a subset of the 1000 most
common words on the Internet (again, according to Moby Words II), and
frequently class 16 from Brian Kelk's "UK English Wordlist
with Frequency Classification".

The MWords package was explicitly placed in the public domain:

    The Moby lexicon project is complete and has
    been place into the public domain. Use, sell,
    rework, excerpt and use in any way on any platform.

    Placing this material on internal or public servers is
    also encouraged. The compiler is not aware of any
    export restrictions so freely distribute world-wide.

    You can verify the public domain status by contacting

    Grady Ward
    3449 Martha Ct.
    Arcata, CA  95521-4884

    grady@netcom.com
    grady@northcoast.com

The "UK English Wordlist With Frequency Classification" is also in the
Public Domain:

  Date: Sat, 08 Jul 2000 20:27:21 +0100
  From: Brian Kelk <Brian.Kelk@cl.cam.ac.uk>

  > I was wondering what the copyright status of your "UK English
  > Wordlist With Frequency Classification" word list as it seems to
  > be lacking any copyright notice.

  There were many many sources in total, but any text marked
  "copyright" was avoided. Locally-written documentation was one
  source. An earlier version of the list resided in a filespace called
  PUBLIC on the University mainframe, because it was considered public
  domain.

  Date: Tue, 11 Jul 2000 19:31:34 +0100

  > So are you saying your word list is also in the public domain?

  That is the intention.

The 20 level includes frequency classes 7-15 from Brian's word list.

The 35 level includes frequency classes 2-6 and words appearing in at
least 11 of 12 dictionaries as indicated in the 12Dicts package.  All
words from the 12Dicts package have had likely inflections added via
my inflection database.

The 12Dicts package and Supplement is in the Public Domain.

The WordNet database, which was used in the creation of the
Inflections database, is under the following copyright:

  This software and database is being provided to you, the LICENSEE,
  by Princeton University under the following license.  By obtaining,
  using and/or copying this software and database, you agree that you
  have read, understood, and will comply with these terms and
  conditions.:

  Permission to use, copy, modify and distribute this software and
  database and its documentation for any purpose and without fee or
  royalty is hereby granted, provided that you agree to comply with
  the following copyright notice and statements, including the
  disclaimer, and that the same appear on ALL copies of the software,
  database and documentation, including modifications that you make
  for internal use or for distribution.

  WordNet 1.6 Copyright 1997 by Princeton University.  All rights
  reserved.

  THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON
  UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES, EXPRESS OR
  IMPLIED.  BY WAY OF EXAMPLE, BUT NOT LIMITATION, PRINCETON
  UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF MERCHANT-
  ABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
  LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT INFRINGE ANY
  THIRD PARTY PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER RIGHTS.

  The name of Princeton University or Princeton may not be used in
  advertising or publicity pertaining to distribution of the software
  and/or database.  Title to copyright in this software, database and
  any associated documentation shall at all times remain with
  Princeton University and LICENSEE agrees to preserve same.

The 40 level includes words from Alan's 3esl list found in version 4.0
of his 12dicts package.  Like his other stuff the 3esl list is also in the
public domain.

The 50 level includes Brian's frequency class 1, words appearing
in at least 5 of 12 of the dictionaries as indicated in the 12Dicts
package, and uppercase words in at least 4 of the previous 12
dictionaries.  A decent number of proper names is also included: The
top 1000 male, female, and Last names from the 1990 Census report; a
list of names sent to me by Alan Beale; and a few names that I added
myself.  Finally a small list of abbreviations not commonly found in
other word lists is included.

The name files form the Census report is a government document which I
don't think can be copyrighted.

The file special-jargon.50 uses common.lst and word.lst from the
"Unofficial Jargon File Word Lists" which is derived from "The Jargon
File".  All of which is in the Public Domain.  This file also contain
a few extra UNIX terms which are found in the file "unix-terms" in the
special/ directory.

The 55 level includes words from Alan's 2of4brif list found in version
4.0 of his 12dicts package.  Like his other stuff the 2of4brif is also
in the public domain.

The 60 level includes all words appearing in at least 2 of the 12
dictionaries as indicated by the 12Dicts package.

The 70 level includes Brian's frequency class 0 and the 74,550 common
dictionary words from the MWords package.  The common dictionary words,
like those from the 12Dicts package, have had all likely inflections
added.  The 70 level also included the 5desk list from version 4.0 of
the 12Dics package which is in the public domain.

The 80 level includes the ENABLE word list, all the lists in the
ENABLE supplement package (except for ABLE), the "UK Advanced Cryptics
Dictionary" (UKACD), the list of signature words from the YAWL package,
and the 10,196 places list from the MWords package.

The ENABLE package, mainted by M\Cooper <thegrendel@theriver.com>,
is in the Public Domain:

  The ENABLE master word list, WORD.LST, is herewith formally released
  into the Public Domain. Anyone is free to use it or distribute it in
  any manner they see fit. No fee or registration is required for its
  use nor are "contributions" solicited (if you feel you absolutely
  must contribute something for your own peace of mind, the authors of
  the ENABLE list ask that you make a donation on their behalf to your
  favorite charity). This word list is our gift to the Scrabble
  community, as an alternate to "official" word lists. Game designers
  may feel free to incorporate the WORD.LST into their games. Please
  mention the source and credit us as originators of the list. Note
  that if you, as a game designer, use the WORD.LST in your product,
  you may still copyright and protect your product, but you may *not*
  legally copyright or in any way restrict redistribution of the
  WORD.LST portion of your product. This *may* under law restrict your
  rights to restrict your users' rights, but that is only fair.

UKACD, by J Ross Beresford <ross@bryson.demon.co.uk>, is under the
following copyright:

  Copyright (c) J Ross Beresford 1993-1999. All Rights Reserved.

  The following restriction is placed on the use of this publication:
  if The UK Advanced Cryptics Dictionary is used in a software package
  or redistributed in any form, the copyright notice must be
  prominently displayed and the text of this document must be included
  verbatim.

  There are no other restrictions: I would like to see the list
  distributed as widely as possible.

The 95 level includes the 354,984 single words, 256,772 compound
words, 4,946 female names and the 3,897 male names, and 21,986 names
from the MWords package, ABLE.LST from the ENABLE Supplement, and some
additional words found in my part-of-speech database that were not
found anywhere else.

Accent information was taken from UKACD.

The VarCon package was used to create the American, British, Canadian,
and Australian word list.  It is under the following copyright:

  Copyright 2000-2016 by Kevin Atkinson

  Permission to use, copy, modify, distribute and sell this array, the
  associated software, and its documentation for any purpose is hereby
  granted without fee, provided that the above copyright notice appears
  in all copies and that both that copyright notice and this permission
  notice appear in supporting documentation. Kevin Atkinson makes no
  representations about the suitability of this array for any
  purpose. It is provided "as is" without express or implied warranty.

  Copyright 2016 by Benjamin Titze

  Permission to use, copy, modify, distribute and sell this array, the
  associated software, and its documentation for any purpose is hereby
  granted without fee, provided that the above copyright notice appears
  in all copies and that both that copyright notice and this permission
  notice appear in supporting documentation. Benjamin Titze makes no
  representations about the suitability of this array for any
  purpose. It is provided "as is" without express or implied warranty.

  Since the original words lists come from the Ispell distribution:

  Copyright 1993, Geoff Kuenning, Granada Hills, CA
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions
  are met:

  1. Redistributions of source code must retain the above copyright
     notice, this list of conditions and the following disclaimer.
  2. Redistributions in binary form must reproduce the above copyright
     notice, this list of conditions and the following disclaimer in the
     documentation and/or other materials provided with the distribution.
  3. All modifications to the source code must be clearly marked as
     such.  Binary redistributions based on modified source code
     must be clearly marked as modified versions in the documentation
     and/or other materials provided with the distribution.
  (clause 4 removed with permission from Geoff Kuenning)
  5. The name of Geoff Kuenning may not be used to endorse or promote
     products derived from this software without specific prior
     written permission.

  THIS SOFTWARE IS PROVIDED BY GEOFF KUENNING AND CONTRIBUTORS ``AS IS'' AND
  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED.  IN NO EVENT SHALL GEOFF KUENNING OR CONTRIBUTORS BE LIABLE
  FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
  DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
  OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
  HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
  LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
  OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
  SUCH DAMAGE.
```
