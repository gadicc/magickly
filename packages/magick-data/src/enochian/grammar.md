# Enochian grammar notes

These notes describe how the Enochian of Dee's nineteen Keys appears to
work, for anyone (or any model) translating to or from it. They are a
reconstruction. Nobody has a grammar Dee was given; what we have is about
1,100 words of Enochian in the Keys, each beside a free English
rendering, and what two careful readers have inferred from them. Every
rule below is stated in our own words, cites where Laycock or Leitch
discusses it, and is shown at work in the Keys. Where the evidence is
thin or the sources disagree, the rule says so.

Sources:

- Donald C. Laycock, *The Complete Enochian Dictionary* (Weiser, 2001
  edition; first published London: Askin, 1978). Pages are the printed
  page numbers. In our scan each PDF page holds two printed pages: PDF
  page N shows printed pages 2N−16 and 2N−15. His grammar is on
  pp. 41–44; his dictionary entries are cited by page.
- Aaron Leitch, *The Angelical Language*, vol. II: *An Encyclopedic
  Lexicon of the Tongue of Angels* (Llewellyn, 2010, first edition).
  His grammar is chapter 1, "Angelical Linguistics" (pp. 11–38); the
  page ranges given for its sections are from the book's contents list.
  Lexicon entries are cited by headword ("s.v."). His tips on
  translating into Enochian are on p. 533.
- The Keys: our `keys.json5`, from Casaubon's 1659 print of Dee's
  journals, with the Golden Dawn forms of *The Equinox* I(8), 1912.

Examples are written `Key K.R WORD = english`. K is the Key's number in
`keys.json5` (Keys 1–18 as usually numbered; Key 19 is the Call of the
Thirty Aethyrs, which Leitch numbers 30). R is the row's position in
that Key's `rows`, counting from 1; a row is one word as Casaubon prints
it. WORD is Casaubon's spelling, in capitals as printed (U/V and I/J are
interchangeable in that print). The English is Dee's for that row,
spelled as printed. Leitch numbers words by his own count, so his Key
references differ from our rows by a few places.

## Reading Dee's English

### G1. The English is a free rendering
Dee's English is not word for word. One Enochian word often stands for a
whole English phrase, and the English adds articles, pronouns,
possessives, prepositions and adjectives that no Enochian word carries.
Translate the sense of a word, then fill in the English it needs; going
the other way, drop the filler and look up the core idea.
- Sources: Laycock (Weiser, 2001), p. 42; Leitch vol. II, ch. 1, "English senses and fluid definitions", pp. 12–14, and "Tips on translating", p. 533
- Evidence: attested in all 19 Keys
- Expert: no
- Example: Key 1.18 MALPRG = a through thrusting fire
- Example: Key 1.48 FARZM = you lifted up your voices
- Example: Key 2.6 SALD = your voices of wonder
- Example: Key 19.106 MOOOAH = it repenteth me

### G2. One root, a range of senses and spellings
A word names a concept, and Dee's English for it varies with the
context, so choose the English that suits the passage rather than one
fixed gloss. The fire words show this: MALPRG, MALPURG and MALPIRGI are
"through-thrusting fire", "fiery darts" and "fires of life and
increase", and IALPURG, IALPOR, IALPON and IALPRG are "burning flames",
"flaming", "burn" and "burning flame". The vowel inside -PRG- comes and
goes (PRG, PURG, PIRG); Leitch reads it as a guide to sound, not a
different word.
- Sources: Leitch vol. II, ch. 1, "English senses and fluid definitions", pp. 12–14, and "Phonetic glosses", pp. 22–25; Leitch vol. II, s.v. Ialpirgah, Prg
- Evidence: attested in 8 Keys
- Expert: no
- Example: Key 6.16 MALPURG = fiery darts
- Example: Key 3.54 MALPIRGI = the fiers of life and increase
- Example: Key 9.5 IALPOR = flaming,
- Example: Key 10.21 IALPON = burn

### G3. Word order is English word order
Enochian words come in the same order as the English they render:
subject, verb, object, with modifiers and clauses where English puts
them. Laycock's test case is the Key 19 phrase "cast down such as
fall", which follows English exactly. To translate into Enochian, put
each sense unit of the English in order and render it.
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Rarities", pp. 19–22
- Evidence: attested in all 19 Keys
- Expert: no
- Example: Key 1.1 OL = I
- Example: Key 1.2 SONF = Raign
- Example: Key 1.3 VORSG = over you
- Example: Key 19.128 ADRPAN = Cast down

## Articles, "of" and prepositions

### G4. There are no articles
Enochian has no word for "the", "a" or "an". Whenever Dee's English has
one, it comes with the noun's gloss. Leave articles out when translating
into Enochian.
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Rarities", pp. 19–22, and "Tips on translating", p. 533
- Evidence: attested in all 19 Keys
- Expert: no
- Example: Key 1.5 IAD = the God
- Example: Key 1.12 ROR = The Sun
- Example: Key 1.44 CAB = a Rod
- Example: Key 9.1 MICAOLI = A mighty

### G5. "Of" is usually unwritten
A noun followed by another noun is read "the first of the second": the
possessed thing comes first, the possessor after it, with no word
between. A separate word for "of", DE, occurs once in the Keys; use it
only where the sense cannot do without it.
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Affixes", pp. 18–19, and "Rarities", pp. 19–22; Leitch vol. II, s.v. De
- Evidence: attested in many Keys (DE itself in one)
- Expert: no
- Example: Key 1.5 IAD = the God
- Example: Key 1.6 BALT = of Justice
- Example: Key 2.3 ZONG = of the windes
- Example: Key 3.49 DE = of

### G6. An added O may mean "of"
Several words gain an O where Dee's English adds "of": CAOSG "earth"
beside CAOSGO "of the earth", VONPH "wrath" beside VONPHO "of wrath",
IAD "God" beside OIAD "of God". Leitch treats this as an affix but notes
it is not consistent: other words gain an O with no "of", and CAOSGI is
also once "of the earth". Laycock counts such endings as chance variants
(G7). Use the O-forms that the Keys attest; do not build new ones.
- Sources: Leitch vol. II, ch. 1, "Affixes", pp. 18–19, s.v. Caosgo, Vonpho, Oiad; Laycock (Weiser, 2001), p. 42
- Evidence: disputed
- Expert: yes, whether -O is a real "of" marker
- Example: Key 8.24 CAOSGO = of the earth
- Example: Key 9.9 VONPHO = of wrath
- Example: Key 18.9 OIAD = of God
- Example: Key 19.28 CAOSGI = of the earth,

### G7. Noun endings vary, but there are no cases
A noun turns up with different endings in different places (CAOSG,
CAOSGA, CAOSGI, CAOSGIN, CAOSGON, all "earth"), and the English around
them differs ("upon the earth", "than the earth", "to the earth"). Both
sources reject a case system: the endings do not recur from one noun to
the next, so they are either a great many declensions or none. Treat a
variant as the same word, and take the relation from context.
- Sources: Laycock (Weiser, 2001), p. 42; Leitch vol. II, ch. 1, "Conjugation", pp. 17–18, and "Rarities", pp. 19–22
- Evidence: attested in 8 Keys
- Expert: yes, what the endings do, if anything
- Example: Key 5.9 CAOSG = upon the earth,
- Example: Key 9.44 CAOSGIN = then the earth.
- Example: Key 10.73 CAOSGON = be to the earth,
- Example: Key 19.45 CAOSGA = The earth,

### G8. Prepositions are few
Most English prepositions in the Keys come from the gloss. A small set of
words do the work where it cannot be left to context: VORS(G) "over",
AAI/AAO "amongst", NOTHOA "in the midst", MIRC "upon", PUGO "as unto",
ASPT "before", OROCHA "underneath", PAMBT and TIA "unto", ZYLNA
"within". Several carry a pronoun in Dee's English ("over you",
"amongst us").
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Rarities", pp. 19–22
- Evidence: attested in 7 Keys
- Expert: no
- Example: Key 1.3 VORSG = over you
- Example: Key 1.69 AAI = amongst you
- Example: Key 3.74 AAIOM = Amongst us
- Example: Key 9.54 MIRC = upon

## Nouns and adjectives

### G9. No reliable plural ending
Laycock finds no irregular plurals of the Hebrew or Arabic kind, and
neither source identifies a plural ending for nouns. In the Keys a word
Dee renders as plural is often the same shape as a singular (ZOL
"hands", LONDOH "kingdoms"); a few plural glosses have an extra -N or -S
(LONSHI "power" beside LONSHIN "their powers"), but singulars carry
those letters too. Take number from the English; when translating into
Enochian, use an attested form.
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Conjugation", pp. 17–18
- Evidence: attested in 4 Keys
- Expert: yes, whether -N or -S ever marks plural
- Example: Key 1.11 ZOL = hands
- Example: Key 3.9 LONDOH = Kingdoms;
- Example: Key 7.48 LONSHI = power,
- Example: Key 4.30 LONSHIN = their powers

### G10. The same noun shifts its ending from Key to Key
Leitch lists words that change their spelling where no grammar explains
it, and the Keys show many: "feet" is LUSD, LUSDA, LASDI and LUSDAN;
"mouth" is BUTMON, BUTMONA and BUTMONI. Dee's English attaches a
different possessive or preposition each time, but the pattern does not
hold across words. Read all such variants as one word.
- Sources: Leitch vol. II, ch. 1, "Conjugation", pp. 17–18, s.v. Butmon; Laycock (Weiser, 2001), p. 42
- Evidence: attested in 6 Keys
- Expert: yes, whether the endings carry person or case
- Example: Key 2.26 LUSD = your feet
- Example: Key 9.21 LUSDA = their feet
- Example: Key 4.2 LASDI = my feet
- Example: Key 9.46 BUTMONI = from their mouths

### G11. Adjectives are rare and go before the noun
Separate adjectives are uncommon. When one is written it stands before
its noun, as in English, and is not joined to it. Many adjectives in
Dee's English are part of the noun's own sense (a "barren stone", the
"mighty sounds") and have no word of their own; when translating into
Enochian, an adjective with no attested word can be dropped as implied.
- Sources: Leitch vol. II, ch. 1, "Rarities", pp. 19–22, and "Tips on translating", p. 533
- Evidence: attested in 3 Keys
- Expert: no
- Example: Key 19.31 ADPHAHT = unspeakable
- Example: Key 19.32 DAMPLOZ = variety,
- Example: Key 2.27 ORRI = than the barren stone
- Example: Key 5.1 SAPAH = The mighty sounds

### G12. A comparative form
MICALP "mightier" stands beside MICAOLZ "mighty", and Leitch glosses it
as the comparative adjective. It is the only comparative in the Keys,
so its -P cannot be generalised.
- Sources: Leitch vol. II, s.v. Micalp
- Evidence: single example
- Expert: yes, a single Key example; is -P a comparative ending?
- Example: Key 2.29 MICALP = mightier
- Example: Key 3.73 MICAOLZ = mighty

## Verbs

### G13. "To be": present forms
The present of "be" is the best attested verb: I "is", CHIS "are"
(once CHIIS), GEH "art", and ZIR or ZIRDO "I am". "Is" and "are" are
often joined to the next word (G26).
- Sources: Laycock (Weiser, 2001), p. 43, and p. 95 (chis); Leitch vol. II, ch. 1, "Conjugation", pp. 17–18, s.v. Chis, Geh, Zir
- Evidence: attested in 17 Keys
- Expert: no
- Example: Key 1.13 I = is
- Example: Key 2.25 CHIS = are
- Example: Key 16.22 GEH = art
- Example: Key 1.84 ZIRDO = I am

### G14. "To be": past, future, wishes, and "become"
Past and future are separate words, not endings on the present: ZIROP
"was", ZIROM "were", TRIAN and CHISO "shall be". NOALN is "may be",
BOLP "be thou", CHRISTEOS "let there be". A root NOA- "become" has
NOAN "you are become", NOAR "is become", NOAS "are become" and NOASMI
"let them become". Laycock calls this the fullest paradigm we have, and
it is still far from a full conjugation; no ending here carries over to
other verbs.
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Conjugation", pp. 17–18, s.v. Trian, Bolp, Noan
- Evidence: attested in 9 Keys
- Expert: yes, whether the NOA- endings mark person or mood
- Example: Key 10.77 ZIROP = was,
- Example: Key 6.40 TRIAN = shall be
- Example: Key 18.24 BOLP = Be thou
- Example: Key 3.72 NOAR = is become

### G15. "To say": the one other paradigm
The verb "say" shows several forms: GOHO "saith", GOHUS "I say", GOHIA
"we say", GOHOL "saying", GOHON "have spoken", GOHULIM "it is said".
These endings are not found on other verbs, so they do not give a
general conjugation.
- Sources: Laycock (Weiser, 2001), p. 43, and p. 115 (gohol, gohus); Leitch vol. II, ch. 1, "Conjugation", pp. 17–18
- Evidence: attested in 7 Keys
- Expert: yes, whether any ending generalises
- Example: Key 1.4 GOHO = saith
- Example: Key 3.65 GOHUS = I say
- Example: Key 3.76 GOHIA = we say
- Example: Key 8.38 GOHON = have spoken:

### G16. Most verbs do not mark person or tense
Apart from "be" and "say", a verb usually has one form, and the person,
number and tense come from Dee's English. Laycock notes that a word like
MOOOAH, "it repenteth me", could as well be "I regret". Commands use
the plain word: ZACAR "move", ZAMRAN "shew your selves", ODO "open".
Leitch doubts that conjugation as we know it exists at all.
- Sources: Laycock (Weiser, 2001), pp. 42–43; Leitch vol. II, ch. 1, "Conjugation", pp. 17–18
- Evidence: attested in all 19 Keys
- Expert: no
- Example: Key 1.2 SONF = Raign
- Example: Key 4.11 DSONF = which raign
- Example: Key 1.75 ZACAR = Move
- Example: Key 19.106 MOOOAH = it repenteth me

### G17. "Let ..." forms
A few words render English "let ...": CHRISTEOS "let there be",
NOASMI "let them become", IXOMAXIP "let her be known" and ABOAPRI "let
them serve you". All are in Key 19, and they share no ending, so there
is no productive "let" form.
- Sources: Laycock (Weiser, 2001), pp. 42–43; Leitch vol. II, s.v. Christeos, Ixomaxip
- Evidence: single Key
- Expert: yes, all examples are in Key 19
- Example: Key 19.49 CHRISTEOS = let there be
- Example: Key 19.99 NOASMI = let them become
- Example: Key 19.109 IXOMAXIP = let her be known,
- Example: Key 19.124 ABOAPRI = let them serve you,

### G18. -AX may mark action
Leitch suggests that a final -AX marks an action in progress, a little
like English -ing: OM "know" beside OMAX "knowest", and CAMLIAX
"spake", TASTAX "going". He adds that some -ing verbs lack it (PANPIR
"powring down") and that some -AX words are nouns of violent force
(GIZYAX "earthquakes"). Laycock does not discuss it.
- Sources: Leitch vol. II, ch. 1, "Affixes", pp. 18–19, s.v. Omax, Camliax, Tastax
- Evidence: attested in 4 Keys
- Expert: yes, a tentative affix from one author
- Example: Key 16.18 OM = understand
- Example: Key 11.12 CAMLIAX = spake,
- Example: Key 17.13 TASTAX = going
- Example: Key 10.43 GIZYAX = Earth-quakes.

### G19. Participles have no single ending
Laycock finds participle forms but no regular pattern. In the Keys "-ing"
words end variously: GOHOL "saying", IALPOR "flaming", PANPIR "powring
down", TASTAX "going". Use an attested form; do not coin an ending.
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Affixes", pp. 18–19
- Evidence: attested in 5 Keys
- Expert: yes, whether -OL or -OR is a participle ending
- Example: Key 4.6 GOHOL = saying,
- Example: Key 9.5 IALPOR = flaming,
- Example: Key 3.53 PANPIR = powring down
- Example: Key 17.13 TASTAX = going

### G20. Words grow from short roots
Many words share a root of two to four letters that keeps its meaning
across nouns and verbs. OM "know, understand" gives OMA "understanding"
and OMAX "knowest", and appears inside OMPTILB, IXOMAXIP and GMICALZOMA.
The root may not stand alone, and its spelling can shift. When a word is
missing from the dictionary, look for its root among related words.
- Sources: Laycock (Weiser, 2001), p. 42, and p. 147 (om, oma, omax); Leitch vol. II, ch. 1, "Root words", pp. 14–15, and "Angelical root words", pp. 98–106
- Evidence: attested in 2 Keys
- Expert: no
- Example: Key 16.18 OM = understand
- Example: Key 19.103 OMPTILB = her understanding
- Example: Key 19.109 IXOMAXIP = let her be known,
- Example: Key 19.35 GMICALZOMA = with a power, understanding

## Pronouns

### G21. Personal pronouns are rare and usually supplied
Most "I", "you" and "they" in Dee's English belong to a verb's gloss
(GNONP "I garnished", ZONRENSG "delivered you"). Where a pronoun is
written: OL "I", ILS or YLS "thou", NONCI, NONCA or NONCF "you", and Z
in ZCHIS "they are". Leitch holds that ILS is "you" to one person and
NONCI to many. When translating into Enochian, write a pronoun only
where the sense would be lost.
- Sources: Laycock (Weiser, 2001), pp. 42–43, p. 123 (ils) and p. 146 (ol); Leitch vol. II, ch. 1, "Rarities", pp. 19–22, s.v. Yls, Nonci
- Evidence: attested in 10 Keys
- Expert: no
- Example: Key 1.31 GNONP = I garnished
- Example: Key 1.1 OL = I
- Example: Key 16.23 YLS = thou
- Example: Key 19.26 NONCF = you

### G22. Possessives are usually implied
"My", "your", "his" and "their" in the English seldom have a word of
their own: QAA "your garments", PIAD "your God", ZIEN "of my hands". Two
possessives are written: TOX "his" and TILB "her" (also TIOBL "in her").
TOX and TILB usually follow the noun, joined to it (LONSHITOX "his power",
ELZAPTILB "her course"), but TILB also stands alone before its noun: OD
TILB ADPHAHT DAMPLOZ "and her unspeakable variety".
- Sources: Laycock (Weiser, 2001), p. 43, p. 174 (tilb) and p. 176 (tox); Leitch vol. II, ch. 1, "Compounds", pp. 15–17, and "Rarities", pp. 19–22
- Evidence: attested in many Keys (TOX and TILB in 2)
- Expert: yes, TOX and TILB rest on Keys 13 and 19 only in Dee's text, and TILB comes both before and after its noun
- Example: Key 1.21 QAA = your garments
- Example: Key 3.3 PIAD = your God
- Example: Key 13.20 LONSHITOX = his power,
- Example: Key 19.30 TILB = her
- Example: Key 19.59 ELZAPTILB = Her course,

### G23. Relative words: DS, SOBA, CASARM
DS (once DST) is "which, that", standing alone or joined to its verb.
SOBA is "whose", SOBAM "whom". CASARM and its variants mean "whom" with
a preposition Dee's English supplies: CASARMG "in whom", CASARMI "under
whom", CASARMAN "of whom". The endings may hint at the preposition, but
the Keys are too few to say.
- Sources: Laycock (Weiser, 2001), p. 105 (ds); Leitch vol. II, ch. 1, "Rarities", pp. 19–22, s.v. Ds, Sobam, Casarm
- Evidence: attested in 17 Keys
- Expert: yes, whether CASARM's endings are meaningful
- Example: Key 1.19 DS = which
- Example: Key 1.29 SOBA = whose
- Example: Key 2.9 SOBAM = whom
- Example: Key 3.75 CASARMG = in whome

### G24. DS rendered "and"
Twice in Key 1, Dee's English renders DS as "and" where elsewhere it is
"which" or "that". Leitch and Laycock gloss DS only as the relative.
Prefer "which" or "that".
- Sources: Laycock (Weiser, 2001), p. 105 (ds); Leitch vol. II, s.v. Ds
- Evidence: disputed
- Expert: yes, a single-Key reading against the sources
- Example: Key 1.34 DS = and
- Example: Key 1.42 DS = and

### G25. Demonstratives
"This", "these", "that" and "those" have short words, often joined to
the following word: OI "this" (OISALMAN "this house"), UNAL or VNAL
"these" (UNALCHIS "these be"), AR "that" (ARTABAS "that govern"), PRIAZ
"those". Z before CHIS gives "they are" (ZCHIS).
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Compounds", pp. 15–17, s.v. Unal, Ar
- Evidence: attested in 7 Keys
- Expert: no
- Example: Key 8.30 OISALMAN = this house
- Example: Key 10.33 UNALCHIS = These be
- Example: Key 19.127 ARTABAS = that govern,
- Example: Key 5.25 ZCHIS = they are

## Joining words

### G26. Small words join the next word
The commonest way to build a phrase is to join a function word to the
word it governs: DS "which", I "is", CHIS "are", TA "as", L "one, first",
AR "that", OI "this" and AG "no" all appear joined. The joined form means
what the two words mean in turn. Leitch finds most compounds are of this
modifier-plus-word kind.
- Sources: Leitch vol. II, ch. 1, "Compounds", pp. 15–17, and "Tips on translating", p. 533
- Evidence: attested in 12 Keys
- Expert: no
- Example: Key 4.40 DSI = which is
- Example: Key 7.2 ISALMAN = is a house
- Example: Key 9.24 CHISHOLQ = are measured
- Example: Key 5.6 TAQANIS = as Olives

### G27. A shared letter is written once
When the end of one word and the start of the next have the same letter,
the compound writes it once: DS + SONF gives DSONF "which reign";
GMICALZO + OMA gives GMICALZOMA "power, understanding".
- Sources: Leitch vol. II, ch. 1, "Compounds", pp. 15–17, s.v. Dsonf, Gmicalzoma
- Evidence: attested in 3 Keys
- Expert: no
- Example: Key 4.11 DSONF = which raign
- Example: Key 12.2 DSONF = that range
- Example: Key 19.35 GMICALZOMA = with a power, understanding

### G28. Compounding can reshape a word
Beyond merging letters, a word may change shape inside a compound in
ways no rule predicts. SOBA "whose" appears as SOBHA-, SOBO- and SOLA-;
BASGIM "day" appears as BAZM- in BAZMELO "the midday the first". Do not
invent such changes; use attested compounds or join the plain forms.
- Sources: Leitch vol. II, ch. 1, "Compounds", pp. 15–17, s.v. Sobhaath, Sobolzar, Solamian, Bazemlo
- Evidence: attested in 3 Keys
- Expert: yes, whether any of the changes are regular
- Example: Key 6.39 SOBHAATH = whose works
- Example: Key 8.14 SOLAMIAN = whose long continuance
- Example: Key 10.24 BASGIM = day.
- Example: Key 8.1 BAZMELO = The midday the first,

### G29. Content words compound too
Less often, two content words join: a quality with a noun (MALPRG,
"through-thrusting fire"), a name with a quality (IADBALTOH, "God of
righteousness"), or a whole clause (ZIRENAIAD, "I am the Lord your God",
from ZIR + ENAY + IAD).
- Sources: Leitch vol. II, ch. 1, "Compounds", pp. 15–17, s.v. Zirenaiad, Iadbaltoh, Lasollor
- Evidence: attested in 3 Keys
- Expert: no
- Example: Key 4.39 ZIRENAIAD = I am the Lord your God
- Example: Key 9.63 IADBALTOH = the God of righteousnesse
- Example: Key 9.32 LASOLLOR = the rich man
- Example: Key 1.18 MALPRG = a through thrusting fire

### G30. Word boundaries differ between copies; OD stands alone
Our rows follow Casaubon's print. Dee's own manuscript of the Keys,
which Leitch follows, joins words that Casaubon prints apart: Leitch
lists many OD compounds (ODZAMRAN, ODCHIS, ODMIAM) and QMOSPLEH, where
Casaubon always prints OD "and" and Q "or" as words of their own. The
Golden Dawn text joins and splits words differently again. A compound
and its parts written apart mean the same; to match our text, write OD
separately. Dee's English also has "and" inside some glosses with no OD
(GRAA "and the Moon"), so not every English "and" needs an OD.
- Sources: Laycock (Weiser, 2001), p. 144 (od); Leitch vol. II, ch. 1, "Compounds", pp. 15–17, s.v. Od, Qmospleh
- Evidence: disputed
- Expert: no
- Example: Key 1.77 OD = and
- Example: Key 1.78 ZAMRAN = shew your selves,
- Example: Key 3.18 MOSPLEH = the horns
- Example: Key 1.16 GRAA = and the Moon

## Conjunctions and particles

### G31. TA "as", Q "or", and the clause links
TA "as" stands alone or joins its noun (TALOLCIS "as bucklers"); CORSTA
is "such as". Q is "or". Clause links are separate words placed where
English puts them: LAP and BAGLE "for" (BAGLE also "for why?"), CA
"therefore", OQ and CRIP "but" (CRP- in CRPL "but one"), PILAH
"moreover".
- Sources: Laycock (Weiser, 2001), p. 171 (ta); Leitch vol. II, ch. 1, "Compounds", pp. 15–17, and "Rarities", pp. 19–22, s.v. Q, Lap, Bagle
- Evidence: attested in 17 Keys
- Expert: no
- Example: Key 8.16 TALOLCIS = as Buckles
- Example: Key 3.17 Q = or
- Example: Key 1.83 LAP = for
- Example: Key 1.76 CA = therefore

## Negation

### G32. GE "not" follows the word it negates
GE after a form of "be" negates it, usually joined: ICHISGE and GCHISGE
"are not", TAGE "as is not". Laycock lists this as one of four ways of
saying "not".
- Sources: Laycock (Weiser, 2001), p. 43, and p. 113 (ge); Leitch vol. II, s.v. Ge, Gchisge, Tage
- Evidence: attested in 3 Keys
- Expert: no
- Example: Key 3.23 ICHISGE = to are not
- Example: Key 4.7 GCHISGE = Are not
- Example: Key 2.37 TAGE = as is not

### G33. IP "not", alone or joined
IP is "not". It stands alone, or begins the word it negates (IPURAN
"shall not see"), or ends it (PAGEIP "rest not"). Leitch takes IP as
built on I "is", which would make IPAM "is not" and IPAMIS "can not be"
forms of the same root.
- Sources: Laycock (Weiser, 2001), p. 43, and p. 125 (ip); Leitch vol. II, ch. 1, "Root words", pp. 14–15, s.v. Ip, Ipam, Ipamis
- Evidence: attested in 4 Keys
- Expert: no
- Example: Key 9.68 IP = not
- Example: Key 8.27 IPURAN = shall not see
- Example: Key 10.50 PAGEIP = rest not [or] labour still,
- Example: Key 1.58 IPAM = is not,

### G34. AG "no, none" and RIPIR "no place"
AG is "no, none" on its own and joins a noun to give "no ...":
AGTOLTORN "no creature". RIPIR is "no place", and Laycock divides it as
RI-PIR.
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, s.v. Ag, Agtoltorn, Ripir
- Evidence: attested in 2 Keys
- Expert: yes, RIPIR rests on one Key example
- Example: Key 4.17 AG = None
- Example: Key 19.71 AGTOLTORN = no Creature
- Example: Key 19.137 RIPIR = No place,

## Numbers

### G35. Number words follow no system
Numbers in the Keys are short letter groups (OS 12, CLA 456, QUAR 1636),
and Laycock finds no system that builds them from digits. Leitch sets
such words apart as uncertain. Use only attested numbers.
- Sources: Laycock (Weiser, 2001), pp. 43–44; Leitch vol. II, "How to use this lexicon", p. 87
- Evidence: attested in 15 Keys
- Expert: no
- Example: Key 3.8 OS = 12
- Example: Key 3.42 CLA = 456
- Example: Key 14.17 QUAR = 1636.
- Example: Key 17.11 TAXS = 7336

### G36. Ordinals join their noun
"First", "second", "third" and "fourth" are L (LA, EL), VIV, D and S
(ES), and in Keys 4–6 and 15–17 they join the noun: VIVDIV "second
angle", DIALPRT "third flame", SDIU "fourth angle". L also means "one"
(LPATRALX "one rock"). Leitch reads the E of EL and ES as a sounding
aid, not a letter of the word.
- Sources: Laycock (Weiser, 2001), p. 43; Leitch vol. II, ch. 1, "Phonetic glosses", pp. 22–25, s.v. L, Viv, D, Es
- Evidence: attested in 9 Keys
- Expert: no
- Example: Key 4.12 VIVDIV = in the second angle?
- Example: Key 17.2 DIALPRT = third flame,
- Example: Key 6.2 SDIU = of the fourth Angle
- Example: Key 10.57 LPATRALX = One rock

## Spelling

### G37. One word, several spellings
The same word is often spelled differently from Key to Key: ABRAMG and
ABRAMIG "prepared", CRIP and CRP- "but", MICAOLZ and MICALZO "mighty".
Leitch reads most extra vowels as hints for pronunciation, so the
shortest spelling is the core word. Laycock leaves open how much of the
variation is grammar at all. Casaubon's print also uses U and V, and I,
J and Y, for the same letters (VNAL and UNAL, ILS and YLS), so compare
words with these letters equated.
- Sources: Laycock (Weiser, 2001), p. 42; Leitch vol. II, ch. 1, "Phonetic glosses", pp. 22–25, s.v. Zylna
- Evidence: attested in many Keys
- Expert: no
- Example: Key 2.14 ABRAMG = I have prepared
- Example: Key 8.56 ABRAMIG = are prepared
- Example: Key 9.27 VNAL = These
- Example: Key 10.33 UNALCHIS = These be

### G38. Golden Dawn forms add vowels; Dee's spelling is the word
The Golden Dawn forms in *The Equinox* insert vowels so the words can be
spoken: SONF becomes sonuf, VORSG vaoresaji, GIZYAX jizodyazoda.
Laycock shows this system is the Order's, not Dee's. Treat these
spellings as pronunciations of Dee's words, not as different words, and
write Dee's spelling.
- Sources: Laycock (Weiser, 2001), pp. 59–61
- Evidence: disputed
- Expert: yes, which reading a translator should prefer by default
- Example: Key 1.2 SONF = Raign
- Example: Key 1.3 VORSG = over you
- Example: Key 10.43 GIZYAX = Earth-quakes.

## Set phrases

### G39. Address is not marked in the Keys
Dee's English often opens with "O thou" or "O you", but the Enochian
word is the plain pronoun or noun. Leitch finds a vocative change of
spelling, but only in names outside the Keys; in the Keys nothing
marks the person addressed.
- Sources: Leitch vol. II, ch. 1, "Rarities", pp. 19–22
- Evidence: disputed
- Expert: yes, whether Enochian has a vocative
- Example: Key 15.1 ILS = O thou
- Example: Key 12.1 NONCI = O you
- Example: Key 2.7 VIIV = O you the second
- Example: Key 19.1 MADRIIAX = O you heavens

### G40. The closing formula of Keys 1 and 11–18
Keys 11 to 18 close by repeating Key 1's final fourteen words, from ZACAR
"move" to IAIDA "of the Highest", with small differences. Leitch, after
Patricia Shaffer, calls this the repetitive formula. Render it the same
way each time.
- Sources: Leitch vol. II, "How to use this lexicon", p. 92 (note on RFP)
- Evidence: attested in 9 Keys
- Expert: no
- Example: Key 1.75 ZACAR = Move
- Example: Key 11.36 ODO = open
- Example: Key 12.30 QAA = of your Creation,
- Example: Key 18.41 IAIDA = of the Highest.
