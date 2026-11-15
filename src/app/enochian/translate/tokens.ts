/**
 * The translator's tokenisers (plan 081): its English words and its
 * Enochian words, as the lookup reads them. A module of their own, small
 * and with no tables but Dee's spellings, so the dictionary can count a
 * query's words for its preview without loading the lookup.
 */

/** One English word of the input, as compared and as typed. */
export interface EnglishToken {
  /** Lower case, apostrophes gone, Dee's old spellings modernised. */
  word: string;
  /** As typed (for a contraction, its expanded word). */
  surface: string;
  /** Typed with a possessive "'s" or "s'" ("God's", "Gods'"). */
  possessive: boolean;
  /** Followed by `.`, `!`, `?`, `;` or `:`, which no phrase crosses. */
  endsClause: boolean;
  /** The contraction it was expanded from ("it's"), if any. */
  contraction?: string;
}

/**
 * Dee's and Casaubon's spellings, modernised on both sides, so a reader's
 * "shew" or "show" meets either. A final e of his ("brightnesse",
 * "aire") is here, not taken off every word, so "stare" is not "star".
 * A spelling of his that is another word today is in `SOURCE_SPELLINGS`.
 */
const ARCHAIC: Readonly<Record<string, string>> = {
  adde: "add",
  aire: "air",
  alwayes: "always",
  apparaild: "apparelled",
  apparailed: "apparelled",
  ballance: "balance",
  binde: "bind",
  bloud: "blood",
  brightnesse: "brightness",
  creatour: "creator",
  darknesse: "darkness",
  doth: "do",
  drinesse: "dryness",
  encrease: "increase",
  extream: "extreme",
  fiers: "fires",
  firmamets: "firmaments",
  flowres: "flowers",
  furie: "fury",
  gladnesse: "gladness",
  glorie: "glory",
  governour: "governor",
  harboured: "harbored",
  hast: "have",
  hath: "have",
  hiacinct: "hyacinth",
  hiacynth: "hyacinth",
  honour: "honor",
  labour: "labor",
  likenesse: "likeness",
  loynes: "loins",
  mee: "me",
  milstones: "millstones",
  minde: "mind",
  mosse: "moss",
  neasts: "nests",
  noyses: "noises",
  numbred: "numbered",
  openest: "open",
  parte: "part",
  powring: "pouring",
  poyson: "poison",
  raign: "reign",
  raigne: "reign",
  rejoyceth: "rejoiceth",
  righteousnes: "righteousness",
  righteousnesse: "righteousness",
  runne: "run",
  saith: "say",
  sayth: "say",
  selves: "self",
  setled: "settled",
  shew: "show",
  skyrts: "skirts",
  sware: "swore",
  terrour: "terror",
  untill: "until",
  vanne: "van",
  voyce: "voice",
  walkest: "walk",
  whome: "whom",
  windes: "winds",
  wo: "woe",
  yee: "ye",
};

/**
 * Spellings of Dee's and Casaubon's that are other words today, read as
 * his only in his English and the glosses: his "that range" (DSONF) is
 * "that reign", but a reader's "range" is a range, never SONF.
 */
const SOURCE_SPELLINGS: Readonly<Record<string, string>> = {
  ...ARCHAIC,
  range: "reign",
};

/**
 * Contractions, expanded before `words()` would strip "'s" (decision 6):
 * in order, since "can't" must not become "ca not". Only in what a reader
 * types. A "'d" is "would" ("I'd go"), though "had" or "did" is as
 * often meant ("where'd you go"), which nothing here can tell apart; only
 * an old verb's elision is "-ed" (`englishTokens`' `isVerb`).
 */
const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bcan't\b/, "can not"],
  [/\bwon't\b/, "will not"],
  [/\bshan't\b/, "shall not"],
  [/\blet's\b/, "let us"],
  [/n't\b/, " not"],
  [/'m\b/, " am"],
  [/'re\b/, " are"],
  [/'ve\b/, " have"],
  [/'ll\b/, " will"],
  [/'d\b/, " would"],
  [/\b(it|that|he|she|what|there|here|who|where|how|this)'s\b/, "$1 is"],
];

/**
 * Old elisions at a word's end: "know'st" is "knowest", "giv'n" "given",
 * in Dee's English and the reader's alike. Without them the apostrophe
 * would just go ("knowst").
 */
const ELISIONS: readonly [RegExp, string][] = [
  [/(?<=\p{L})'st$/u, "est"],
  [/(?<=\p{L})'n$/u, "en"],
];

/**
 * A verb's "-ed" elided: Dee's "apparail'd" is "apparailed". Always so in
 * his English and the glosses, which have no "'d" for "would"; in a
 * reader's text only for a verb (`englishTokens`).
 */
const ELIDED_ED = /^(\p{L}+)'d$/u;

/**
 * Words a reader's "'d" follows as "would", whatever the data says:
 * pronouns, question words and the like ("they'd", "why'd", "there'd").
 */
const WOULD_AFTER: ReadonlySet<string> = new Set([
  "he",
  "here",
  "how",
  "i",
  "it",
  "she",
  "that",
  "there",
  "they",
  "this",
  "thou",
  "we",
  "what",
  "when",
  "where",
  "who",
  "why",
  "ye",
  "you",
]);

/** Accents off ("naïve" is "naive"), as for Crowley's forms. */
export function deaccent(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Bracketed and parenthesised text in Dee's English or a gloss is a note,
 * not English to translate (never in what a reader types). No bracket
 * inside, so each match stops at the next opening one and the scan stays
 * linear.
 */
const NOTES = /\[[^[\]]*\]|\([^()]*\)/g;

/**
 * A word as typed: letters in any script, digits and apostrophes. A word
 * not in Latin letters ("שלום") is still a word, which no gloss matches,
 * so it becomes a gap rather than vanishing.
 */
const WORD = /[\p{L}\p{N}']+/gu;

/** Punctuation that ends a clause: no phrase is matched across it. */
const CLAUSE_END = /[.!?;:]/;

/** An opening single quote: a curly one, or a straight one before a word. */
const OPENING_QUOTE = "‘";

/**
 * Old elisions written with a leading apostrophe ("'Tis", "'twas"): the
 * apostrophe is part of the word, not a quote opening.
 */
const ELISION =
  /^'(?:tis|twas|twere|twill|twould|em|gainst|neath|tween|twixt|mid|midst|round|til|cause)$/i;

/**
 * The English words of a text a reader typed, contractions expanded, each
 * with how it was typed. Every word is kept, brackets and all, so each
 * becomes a form, a chip or a gap. Shared with `words()` from `search.ts`,
 * which takes off a possessive "'s"; here that is kept as a flag, since G5
 * moves the word. A closing quote after an "s" ("I said 'yes'") is a
 * quote, not a possessive "s'", while a quote is open. A "'d" is "would"
 * unless `isVerb` says its "-ed" form is a verb ("lov'd" is "loved"); a
 * pronoun's or question word's never is ("I'd", "why'd").
 */
export function englishTokens(
  text: string,
  isVerb?: (word: string) => boolean,
): EnglishToken[] {
  return tokenize(text, false, isVerb);
}

/**
 * The compared words of Dee's English or a gloss: as `englishTokens`, but
 * bracketed notes left out (WE's "Mals (P)" is "Mals"), no contraction
 * expanded (his "apparail'd" is an elision, not "apparail would"), and his
 * spellings that are other words today read as his (`SOURCE_SPELLINGS`).
 */
export function englishWords(text: string): string[] {
  return tokenize(text, true).map((one) => one.word);
}

/** Dee's English or a gloss with its bracketed notes out (see `NOTES`). */
export function withoutNotes(text: string): string {
  return text.replace(NOTES, " ");
}

/**
 * `source` is Dee's English or a gloss, as `englishWords` reads it;
 * otherwise the text is a reader's, as `englishTokens` reads it.
 */
function tokenize(
  text: string,
  source: boolean,
  isVerb?: (word: string) => boolean,
): EnglishToken[] {
  const out: EnglishToken[] = [];
  const spellings = source ? SOURCE_SPELLINGS : ARCHAIC;
  let cleaned = deaccent(text).replaceAll("’", "'");
  if (source) cleaned = withoutNotes(cleaned);
  const found = [...cleaned.matchAll(WORD)];
  let quoted = false;
  found.forEach((match, at) => {
    const [typed] = match;
    const previous = found[at - 1];
    const gap = cleaned.slice(
      previous ? previous.index + previous[0].length : 0,
      match.index,
    );
    if (gap.includes(OPENING_QUOTE)) quoted = true;
    if (/^'+$/.test(typed)) {
      quoted = !quoted;
      return;
    }
    if (typed.startsWith("'") && !ELISION.test(typed.replace(/'+$/, "")))
      quoted = true;
    const end = match.index + typed.length;
    const between = cleaned.slice(end, found[at + 1]?.index ?? cleaned.length);
    const endsClause = CLAUSE_END.test(between);
    // "s'" closes an open quote; only outside one is it a plural possessive.
    const possessive = /'s$/i.test(typed) || (/s'$/i.test(typed) && !quoted);
    if (typed.endsWith("'")) quoted = false;
    let expanded = typed.toLowerCase();
    const stem = ELIDED_ED.exec(expanded)?.[1];
    const ed = stem && `${stem}ed`;
    if (
      ed &&
      (source ||
        (!WOULD_AFTER.has(stem) &&
          !!isVerb?.(Object.hasOwn(spellings, ed) ? spellings[ed] : ed)))
    )
      expanded = ed;
    else if (!source)
      for (const [pattern, replacement] of CONTRACTIONS)
        expanded = expanded.replace(pattern, replacement);
    for (const [pattern, replacement] of ELISIONS)
      expanded = expanded.replace(pattern, replacement);
    const pieces = expanded.split(" ").filter(Boolean);
    const contraction = pieces.length > 1 ? typed : undefined;
    pieces.forEach((piece, index) => {
      // As `words()` reads it, for any script: no possessive "'s", no
      // apostrophes.
      const word = piece.replace(/'s$/, "").replaceAll("'", "");
      if (!word) return;
      out.push({
        word: Object.hasOwn(spellings, word) ? spellings[word] : word,
        surface: contraction ? piece : typed,
        possessive: !contraction && possessive,
        endsClause: endsClause && index === pieces.length - 1,
        ...(contraction ? { contraction } : {}),
      });
    });
  });
  return out;
}

/**
 * An Enochian text's words, as typed, with Crowley's hyphens kept in.
 * Letters in any script make a word, as in `englishTokens`, so a word not
 * in Latin letters is shown as not found rather than dropped.
 */
export function enochianWords(text: string): string[] {
  return deaccent(text).match(/\p{L}+(?:['-]\p{L}+)*/gu) ?? [];
}

/**
 * How many words a text has, as typed: its runs between spaces that hold
 * a letter, so "I'm fire" is two and "1 2 3" or "? ! ." none. The
 * direction guess reads one or two such words both ways (decision 4),
 * and the dictionary's preview shows from three (decision 3), so the two
 * always agree.
 */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length;
}

/**
 * The most words the lookup reads of a text, on the page and in the
 * dictionary's preview: a long paste would otherwise hold the browser
 * for seconds. The URL's fragment still keeps the whole text.
 */
export const MAX_WORDS = 500;

/**
 * A text cut after its first `max` words, and whether anything was cut.
 * Words are counted as the tokenisers find them, runs of letters (with
 * digits and apostrophes), so words joined by commas or dashes count
 * one by one.
 */
export function firstWords(
  text: string,
  max = MAX_WORDS,
): { text: string; cut: boolean } {
  let seen = 0;
  for (const match of text.matchAll(/[\p{L}\p{M}\p{N}']+/gu)) {
    if (!/\p{L}/u.test(match[0])) continue;
    if (++seen > max)
      return { text: text.slice(0, match.index).trimEnd(), cut: true };
  }
  return { text, cut: false };
}
