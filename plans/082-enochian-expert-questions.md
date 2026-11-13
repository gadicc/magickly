# Questions for an Enochian expert — 13 November 2026

Status: a running list, kept from 13 November 2026. Read
[current status](000-current-status.md) first.

Gadi knows an Enochian expert who may review our work. The plan is to
finish as much as we can first, then show them what exists and ask
whether they would help. Until then, every question only an
expert can settle goes here, not into the plan that raised it, so
there is one list to send. Items name their source where it isn't
plain from the section. When a question is settled, move it to
"Answered" with the date and what changed.

The material an item needs (run outputs, samples) stays outside the
repository, as [plan 077](077-enochian-translator-experiment.md)
keeps it; the item names what to send.

## Before the translator is trusted

The translator ([plan 081](081-enochian-translator.md)) ships both
directions before this review, with its limitations shown (Gadi, 13
November 2026). These questions decide how far the notice can be
softened.

- **A sample of English-into-Enochian output** from plan 081's tool,
  the review Gadi deferred. Send it with the rules and chips each
  sentence used.
- **Plan 077's task 3:** whether the Enochian a model wrote for the 60
  new sentences in round 1 is Enochian at all. Send the sentences both
  judges accepted and those they split on.
- **Gaps:** whether Enochian with gaps in mid-sentence reads at all,
  and how a gap should be shown.
- **Golden Dawn or Dee by default:** where the Golden Dawn's reading of
  a word differs from Dee's, which the translator should offer first.

## The grammar notes

`packages/magick-data/src/enochian/grammar.md` marks each rule
`Expert: yes` or `no`. Are the rules marked yes right, and are the
others as safe as we think? Seventeen are marked yes: G6, G7, G9, G10,
G12, G14, G15, G17, G18, G19, G22, G23, G24, G28, G34, G38 and G39.
Of these, plan 081's tool applies G14, G17, G22, G34 and G38, so those
come first, then G12 and G24, which rest, as G34 does, on a single
example in the Keys. Plan 081's chips name G4, G5 and G16, and a form
that carries "in": are the chips right?

- **TILB before its noun:** G22 now allows it, from Key 19's OD TILB
  ADPHAHT DAMPLOZ. Is that right?
- **Possessives written apart:** plan 081 writes SALMAN TILB "her
  house" where Dee joins (ELZAPTILB "her course"). Acceptable, or must
  they be joined?
- **"God's house" as "house God"** by G5.

## Words and their senses

- **Fused forms:** when Dee's only form carries more than the English
  (GEIAD "our Lord and Master" for "master", ORRI "barren stone" for
  "stone", PLOSI "as many" for "many"), may it stand for the narrower
  word, or must it be a gap?
- **Forms with a preposition in them** used for the bare word (plan
  081's tier 3: ETHARZI "in peace" for "peace").
- **Wrong-sense glosses** a lookup finds (HOMIL "the true ages" for
  "true") and **dictionary-only glosses** (Schueler's, angels' names,
  "(?)" glosses): which should a translator ever offer?
- **Synonyms a model gave beyond lookup** (UNIGLAG "descend" for "come
  down", PAAOX "remain" for "stayed"): are they sound?
- **Derived and coined words:** are forms built by the grammar notes
  plausible, or do they only look like Enochian?
- **Glosses where Leitch and Dee's English disagree:** about 55 of the
  550 Key words we could compare (plan 077).

## Plan 077's new text

- Whether a swapped word's form suits its new place.
- Whether any planted word is in fact attested somewhere we don't have.
- Whether the new joins are joins Dee could have written.

## Dee's text

These may be answered by an expert who has read Dee's manuscripts,
before the British Library's images of Sloane MS 3191 return
([plan 073](073-enochian-keys.md)).

- **Long s read as f:** Casaubon's print has BUFD (Key 8) and CAFAFAM
  (Key 18) where Leitch has BUSD "glory" and CASASAM "abiding"; the
  dictionary has BUSD, and CAFAFAM as a variant of CASASAM.
  `keys.json5` keeps the print, and BUFD's note suspects a long s.
  What does Dee write?
- **The 17 Key rows marked `uncertain`** in `keys.json5`, such as the
  two words Nalvage hummed in Key 1 and left unprinted.
- **The words Casaubon's print lost** (Keys 13 to 16), for which
  Crowley's forms stand in, and Dee's accents and Aethyr spellings.

## Answered

None yet.
