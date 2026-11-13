import { foldSpelling, searchDictionary } from "../dictionary/search.ts";
import { findParts } from "../keys/dictionaryKeys.ts";
import {
  ARTICLES,
  AUXILIARIES,
  BE,
  coreKeys,
  type EnglishToken,
  englishTokens,
  englishWords,
  IRREGULAR,
  isVerbForm,
  NEGATION,
  PREPOSITIONS,
  PRONOUNS,
  withoutLeadingOfTo,
  wordKey,
} from "./english.ts";
import { dictionaryGlosses } from "./glosses.ts";
import { joinSplits } from "./joins.ts";
import type { IndexHit, Lookup, Row, Tiers } from "./lookupData.ts";

/**
 * English into Enochian by lookup (plan 081, decisions 6–12). It never
 * coins a word: each English word becomes a form from the Keys or the
 * dictionary, a rule chip naming the grammar note that leaves it out, or
 * a gap, with the nearest forms where any exist.
 */

/** A grammar note's number in `grammar.md` ("G13"). */
export type RuleId = `G${number}`;

/** One of Dee's rows, as a source. */
export interface KeyPlace {
  key: number;
  row: number;
  /** Dee's English there. */
  english: string;
}

/** Where a form comes from. */
export type FormSource =
  | {
      kind: "keys";
      /** The rows where Dee writes it for this English. */
      rows: readonly KeyPlace[];
    }
  | {
      /**
       * A grammar note's table gave it (decision 9's "to be" and
       * negation, or TOX "his"): the note, and where Dee writes the word.
       */
      kind: "rule";
      rule: RuleId;
      /** The rows where Dee writes it alone. */
      rows: readonly KeyPlace[];
      /** The rows where he writes it joined to a word (LONSHITOX for TOX). */
      joined: readonly KeyPlace[];
    }
  | {
      kind: "dictionary";
      headword: string;
      /** The work cited: EMPM (Schueler) or WE (The Whole Enochian Dictionary). */
      work: string;
      /** The meaning as the dictionary has it. */
      meaning: string;
      /** The word is in the Keys too; this English is the dictionary's. */
      inKeys: boolean;
    };

/** A form offered: the chosen one's rivals, or a gap's nearest. */
export interface FormOption {
  /** As shown (Casaubon's commonest spelling, or the headword). */
  form: string;
  /** The dictionary keys to open for it; empty if it has no entry. */
  entries: readonly string[];
  source: FormSource;
}

/** A note on a tile: what a rule changed about it. */
export type TileChip =
  /** Tier 3: the gloss carries a preposition the English lacks. */
  | { kind: "carries"; preposition: string }
  /** Moved after its noun: a possessive (G5 for "'s", G22 for TOX, TILB). */
  | { kind: "reordered"; rule: RuleId }
  /**
   * A verb read in its one form (G16): "came" as Dee's "come", "killed"
   * as "kill"; `plain` is the gloss's word.
   */
  | { kind: "tense"; rule: RuleId; plain: string };

interface Base {
  /** The English it stands for, as typed. */
  english: string;
  /** Its words as compared. */
  words: readonly string[];
  /** Which of the input's words, `[from, to)`, before any reordering. */
  span: readonly [number, number];
  /** The contraction its words were expanded from ("it's"), if any. */
  contraction?: string;
}

/** A form: one of Dee's words, or a dictionary headword. */
export interface FormToken extends Base, FormOption {
  kind: "form";
  /** How exactly the gloss matched (decision 7); none for a rule's form. */
  tier?: 1 | 2 | 3;
  /** The note it follows (G13 for "is", G21 for "I", G22 for "her"). */
  rule?: RuleId;
  chips: readonly TileChip[];
  /** Other forms for the same English, each with its source (decision 8). */
  alternatives: readonly FormOption[];
}

/** A word a grammar note leaves out (G4 articles, G5 "of", G16 auxiliaries). */
export interface ChipToken extends Base {
  kind: "chip";
  rule: RuleId;
}

/** A word with no form (decision 12). */
export interface GapToken extends Base {
  kind: "gap";
  /** Up to three forms whose English shares the word's stem. */
  nearest: readonly FormOption[];
  chips: readonly TileChip[];
}

/** One item of the result, in the order to show. */
export type EnochianToken = FormToken | ChipToken | GapToken;

/** English into Enochian. */
export interface ToEnochian {
  input: "english";
  tokens: readonly EnochianToken[];
}

/** The longest phrase tried, in words (decision 6). */
const MAX_PHRASE = 6;

/** How many nearest forms a gap shows. */
const NEAREST = 3;

/**
 * Possessive pronouns, under G22; the rest are G21's. Each takes Dee's
 * exact form where a row of his English is that pronoun alone (OL "I",
 * NONCF "you", YLS "thou", TI "it", TILB "her"), else `PRONOUN_TABLE`'s,
 * else it is a gap (decision 10).
 */
const POSSESSIVES: ReadonlySet<string> = new Set([
  "her",
  "his",
  "its",
  "my",
  "our",
  "their",
  "thy",
  "your",
]);

/**
 * A pronoun Dee never glosses alone but our notes give a form for: TOX
 * "his", which he writes only joined (LONSHITOX, G22).
 */
const PRONOUN_TABLE: Readonly<Record<string, string>> = { his: "TOX" };

/** "To be" (G13, G14), and negation (G33, G34): decision 9's table. */
const RULE_FORMS: Readonly<Record<string, [string, RuleId]>> = {
  is: ["I", "G13"],
  are: ["CHIS", "G13"],
  art: ["GEH", "G13"],
  am: ["ZIR", "G13"],
  was: ["ZIROP", "G14"],
  were: ["ZIROM", "G14"],
  not: ["IP", "G33"],
  no: ["AG", "G34"],
  none: ["AG", "G34"],
};

/**
 * Words that are a gap unless a phrase takes them (decision 9): "to"
 * before a verb, "let" (G17's forms come through phrases), "never", and
 * the modals. A lone "be" or "been" is a gap by being a form of "be".
 */
const GAP_WORDS: ReadonlySet<string> = new Set([
  "can",
  "could",
  "let",
  "may",
  "might",
  "must",
  "never",
  "should",
  "to",
  "would",
]);

const CONJUNCTIONS: ReadonlySet<string> = new Set(["and", "or", "but", "nor"]);

/** "Have" as a verb of its own or an auxiliary: which, by what follows. */
const HAVE: ReadonlySet<string> = new Set([
  "had",
  "has",
  "hast",
  "hath",
  "have",
]);

/** Words that begin a noun phrase: "have" before one is "possess". */
const DETERMINERS: ReadonlySet<string> = new Set([
  ...ARTICLES,
  ...POSSESSIVES,
  "all",
  "any",
  "each",
  "every",
  "many",
  "much",
  "no",
  "some",
  "that",
  "these",
  "this",
  "those",
  "thine",
]);

/** What makes "have" an auxiliary after it: a participle, or "not". */
function participleNext(word: string) {
  return (
    word === "not" ||
    word === "never" ||
    word === "been" ||
    Object.hasOwn(IRREGULAR, word) ||
    (word.length > 3 && /(?:ed|en)$/.test(word))
  );
}

/** A word that carries meaning of its own: what "her" must come before. */
function isContent(word: string | undefined) {
  return (
    word !== undefined &&
    ![
      ARTICLES,
      PREPOSITIONS,
      BE,
      NEGATION,
      PRONOUNS,
      AUXILIARIES,
      GAP_WORDS,
      CONJUNCTIONS,
    ].some((set) => set.has(word))
  );
}

/** A match for an English run: the best form and its rivals. */
interface Match {
  form: string;
  tier: 1 | 2 | 3;
  source: FormToken["source"];
  /** The gloss it matched, for the tense chip. */
  gloss: string;
  preposition?: string;
  alternatives: FormOption[];
}

const place = (row: Row): KeyPlace => ({
  key: row.key,
  row: row.row,
  english: row.english,
});

/** The dictionary keys a folded form opens. */
function entriesOf(lookup: Lookup, form: string): string[] {
  const own = lookup.dictionary.get(form)?.headwords;
  if (own?.length) return [own[0]];
  const word = lookup.display.get(form) ?? form;
  return findParts(lookup.source, word, lookup.stripped) ?? [];
}

function option(lookup: Lookup, form: string, source: FormSource): FormOption {
  return {
    form: lookup.display.get(form) ?? form,
    entries: entriesOf(lookup, form),
    source,
  };
}

/** A dictionary hit's source. */
function dictionarySource(lookup: Lookup, hit: IndexHit): FormSource {
  if (hit.origin.kind !== "dictionary") throw new Error("not a dictionary hit");
  return {
    kind: "dictionary",
    headword: hit.origin.headword,
    work: hit.origin.source,
    meaning: hit.origin.meaning,
    inKeys: lookup.keyForms.has(hit.form),
  };
}

const glossLength = (hit: IndexHit) =>
  hit.origin.kind === "dictionary"
    ? englishWords(hit.origin.gloss).length
    : hit.origin.row.core.length;

/**
 * The best form for a run of English words, or `undefined` (decisions 7
 * and 8): the best tier first; at a tier, a form on Dee's lines before
 * any from the dictionary; among Dee's, the one he writes most for this
 * English, the closing formula counted once (G40), then the earlier Key;
 * among the dictionary's, the shortest gloss, then the most matching
 * meanings, then the spelling.
 */
function match(lookup: Lookup, span: readonly string[]): Match | undefined {
  // The words as written first, then with irregular verbs read plain, so
  // "rose" the flower is tried before "rise".
  return (
    matchIn(lookup, lookup.tiers.literal, coreKeys(span, true)) ??
    matchIn(lookup, lookup.tiers.plain, coreKeys(span))
  );
}

function matchIn(
  lookup: Lookup,
  [tier1, tier2, tier3]: Tiers,
  core: readonly string[],
): Match | undefined {
  if (!core.length) return undefined;
  const bare = withoutLeadingOfTo(core).join(" ");
  const whole = core.join(" ");
  const tries: [1 | 2 | 3, readonly IndexHit[]][] = [
    [1, tier1.get(whole) ?? []],
    // English "of light" against a gloss "light", or "light" against "of light".
    [2, [...(tier2.get(bare) ?? []), ...(tier1.get(bare) ?? [])]],
    [3, tier3.get(whole) ?? []],
  ];
  for (const [tier, hits] of tries) {
    if (!hits.length) continue;
    const fromKeys = hits.filter((hit) => hit.origin.kind === "key");
    if (fromKeys.length) return fromDee(lookup, tier, fromKeys, hits);
    return fromDictionary(lookup, tier, hits);
  }
  return undefined;
}

/**
 * Dee's form for a word where a row of his English is that word alone
 * (articles aside), or `undefined`: a pronoun's exact form.
 */
function deeExact(lookup: Lookup, word: string): Match | undefined {
  const hits = (
    lookup.tiers.literal[0].get(coreKeys([word], true).join(" ")) ?? []
  ).filter((hit) => hit.origin.kind === "key");
  return hits.length ? fromDee(lookup, 1, hits, hits) : undefined;
}

function fromDee(
  lookup: Lookup,
  tier: 1 | 2 | 3,
  fromKeys: readonly IndexHit[],
  hits: readonly IndexHit[],
): Match {
  const byForm = new Map<
    string,
    { rows: Row[]; count: number; first: number; preposition?: string }
  >();
  for (const hit of fromKeys) {
    if (hit.origin.kind !== "key") continue;
    const { row } = hit.origin;
    let one = byForm.get(hit.form);
    if (!one) {
      one = { rows: [], count: 0, first: Number.POSITIVE_INFINITY };
      byForm.set(hit.form, one);
    }
    one.rows.push(row);
    if (row.formula !== "repeat") one.count++;
    one.first = Math.min(one.first, row.key * 1000 + row.row);
    if (hit.preposition) one.preposition = hit.preposition;
  }
  // Most uses first, then the earlier place (no two forms share one).
  const [[best, chosen], ...others] = [...byForm].sort(
    ([, a], [, b]) => b.count - a.count || a.first - b.first,
  );
  const alternatives = others.map(([form, one]) =>
    option(lookup, form, { kind: "keys", rows: one.rows.map(place) }),
  );
  const seen = new Set(byForm.keys());
  for (const hit of hits) {
    if (hit.origin.kind !== "dictionary" || seen.has(hit.form)) continue;
    seen.add(hit.form);
    alternatives.push(option(lookup, hit.form, dictionarySource(lookup, hit)));
  }
  return {
    form: best,
    tier,
    source: { kind: "keys", rows: chosen.rows.map(place) },
    gloss: chosen.rows[0].english,
    ...(chosen.preposition ? { preposition: chosen.preposition } : {}),
    alternatives,
  };
}

function fromDictionary(
  lookup: Lookup,
  tier: 1 | 2 | 3,
  hits: readonly IndexHit[],
): Match {
  const byForm = new Map<
    string,
    { hit: IndexHit; length: number; n: number }
  >();
  for (const hit of hits) {
    const length = glossLength(hit);
    const one = byForm.get(hit.form);
    if (!one) byForm.set(hit.form, { hit, length, n: 1 });
    else {
      one.n++;
      if (length < one.length) Object.assign(one, { hit, length });
    }
  }
  const ranked = [...byForm.entries()].sort(
    ([a, x], [b, y]) =>
      x.length - y.length || y.n - x.n || (a < b ? -1 : a > b ? 1 : 0),
  );
  const [[form, { hit }], ...rest] = ranked;
  return {
    form,
    tier,
    source: dictionarySource(lookup, hit),
    gloss: hit.origin.kind === "dictionary" ? hit.origin.gloss : "",
    ...(hit.preposition ? { preposition: hit.preposition } : {}),
    alternatives: rest.map(([other, { hit: theirs }]) =>
      option(lookup, other, dictionarySource(lookup, theirs)),
    ),
  };
}

/**
 * A gap's nearest forms (decision 12): Dee's lines whose English shares
 * the word's stem, shortest first, then the dictionary's "means" group.
 * None for grammar words, or a stem under three letters.
 */
function nearest(lookup: Lookup, word: string): FormOption[] {
  const key = wordKey(word);
  if (
    ARTICLES.has(word) ||
    PRONOUNS.has(word) ||
    BE.has(word) ||
    key.length < 3
  )
    return [];
  const out = new Map<string, FormOption>();
  const rows = lookup.rows
    .filter(
      (row) => row.folded && row.formula !== "repeat" && row.core.includes(key),
    )
    .sort((a, b) => a.core.length - b.core.length);
  for (const row of rows) {
    if (out.size >= NEAREST) break;
    if (out.has(row.folded)) continue;
    out.set(
      row.folded,
      option(lookup, row.folded, { kind: "keys", rows: [place(row)] }),
    );
  }
  for (const hit of searchDictionary(lookup.search, word).means) {
    if (out.size >= NEAREST) break;
    const folded = foldSpelling(hit.word);
    if (!folded || out.has(folded) || hit.meaning === null) continue;
    // Search reads "(see 'cab')" as English; lookup does not (decision 22).
    const glossKeys = dictionaryGlosses(hit.meaning).flatMap((gloss) =>
      englishWords(gloss).map(wordKey),
    );
    if (!glossKeys.includes(key)) continue;
    out.set(
      folded,
      option(lookup, folded, {
        kind: "dictionary",
        headword: hit.word,
        work: lookup.source[hit.word].meanings[hit.meaningIndex].source,
        meaning: hit.meaning,
        inKeys: lookup.keyForms.has(folded),
      }),
    );
  }
  return [...out.values()];
}

/** Where Dee writes each small word joined, by the join rule (G26, G22). */
const joinedCache = new WeakMap<Lookup, Map<string, Row[]>>();

function joinedRows(lookup: Lookup, form: string): Row[] {
  let joined = joinedCache.get(lookup);
  if (!joined) {
    const built = new Map<string, Row[]>();
    for (const [word, rows] of lookup.keyForms)
      for (const { parts } of joinSplits(lookup, word, new Set([word])))
        for (const part of parts) {
          const list = built.get(part) ?? [];
          list.push(...rows.filter((row) => row.formula !== "repeat"));
          built.set(part, list);
        }
    joined = built;
    joinedCache.set(lookup, joined);
  }
  return joined.get(form) ?? [];
}

/**
 * A rule table's form, sourced to its note and to where Dee writes it,
 * alone or joined (TOX "his" only in LONSHITOX), never to an empty list
 * of rows.
 */
function ruleForm(
  lookup: Lookup,
  base: Base,
  form: string,
  rule: RuleId,
): FormToken {
  const own = (lookup.keyForms.get(form) ?? []).filter(
    (row) => row.formula !== "repeat",
  );
  return {
    kind: "form",
    ...base,
    ...option(lookup, form, {
      kind: "rule",
      rule,
      rows: own.map(place),
      joined: joinedRows(lookup, form).map(place),
    }),
    rule,
    chips: [],
    alternatives: [],
  };
}

function matchedForm(
  lookup: Lookup,
  base: Base,
  found: Match,
  rule?: RuleId,
): FormToken {
  const chips: TileChip[] = [];
  if (found.tier === 3 && found.preposition)
    chips.push({ kind: "carries", preposition: found.preposition });
  const glossWords = englishWords(found.gloss);
  for (const word of base.words) {
    if (!isVerbForm(word)) continue;
    // The gloss's word this one met by its key: "come" for "came".
    const plain = glossWords.find((one) => wordKey(one) === wordKey(word));
    if (plain && plain !== word)
      chips.push({ kind: "tense", rule: "G16", plain });
  }
  return {
    kind: "form",
    ...base,
    form: lookup.display.get(found.form) ?? found.form,
    entries: entriesOf(lookup, found.form),
    source: found.source,
    tier: found.tier,
    ...(rule ? { rule } : {}),
    chips,
    alternatives: found.alternatives,
  };
}

/** What `toEnochian` keeps per item while it works. */
interface Working {
  token: EnochianToken;
  /** A content word or phrase: what a possessive moves past. */
  content: boolean;
  /** Moves after the following content: a possessive (rule). */
  moves?: RuleId;
  /** Its last word ends a clause, so nothing moves past it. */
  endsClause: boolean;
}

function baseOf(
  tokens: readonly EnglishToken[],
  from: number,
  to: number,
): Base {
  const run = tokens.slice(from, to);
  const contraction = run.find((one) => one.contraction)?.contraction;
  return {
    english: run.map((one) => one.surface).join(" "),
    words: run.map((one) => one.word),
    span: [from, to],
    ...(contraction ? { contraction } : {}),
  };
}

/** One word no phrase took (decision 9's table, then lookup). */
function single(
  lookup: Lookup,
  tokens: readonly EnglishToken[],
  at: number,
): Working {
  const { word, possessive, endsClause } = tokens[at];
  const next = endsClause ? undefined : tokens[at + 1]?.word;
  const base = baseOf(tokens, at, at + 1);
  const content = isContent(word);
  const moves = possessive ? { moves: "G5" as RuleId } : {};
  const chip = (rule: RuleId): Working => ({
    token: { kind: "chip", ...base, rule },
    content: false,
    endsClause,
  });
  const gap = (near: FormOption[]): Working => ({
    token: { kind: "gap", ...base, nearest: near, chips: [] },
    content,
    endsClause,
    ...moves,
  });
  if (ARTICLES.has(word)) return chip("G4");
  if (word === "of") return chip("G5");
  if (PRONOUNS.has(word)) {
    // "Her" is TILB only before its noun (or asked for alone); elsewhere
    // it is an object, which Enochian has no word for (decision 10).
    if (word === "her" && !isContent(next) && tokens.length > 1) return gap([]);
    const rule: RuleId = POSSESSIVES.has(word) ? "G22" : "G21";
    // Possessives follow their noun, written apart (decision 11).
    const follows = rule === "G22" ? { moves: "G22" as RuleId } : {};
    const exact = deeExact(lookup, word);
    if (exact)
      return {
        token: matchedForm(lookup, base, exact, rule),
        content: false,
        endsClause,
        ...follows,
      };
    const form = PRONOUN_TABLE[word];
    if (form)
      return {
        token: ruleForm(lookup, base, form, rule),
        content: false,
        endsClause,
        ...follows,
      };
    return gap([]);
  }
  const ruled = RULE_FORMS[word];
  if (ruled)
    return {
      token: ruleForm(lookup, base, ruled[0], ruled[1]),
      content: false,
      endsClause,
    };
  if (GAP_WORDS.has(word)) return gap(nearest(lookup, word));
  if (AUXILIARIES.has(word) && next !== undefined) {
    // An auxiliary before its verb, or before its subject in a question
    // ("do you", "shall I"); "have" before a noun is "possess" (G16).
    const subject = PRONOUNS.has(next) && !DETERMINERS.has(next);
    const auxiliary = HAVE.has(word)
      ? subject || participleNext(next)
      : subject || !DETERMINERS.has(next);
    if (auxiliary) return chip("G16");
  }
  const found = BE.has(word) ? undefined : match(lookup, [word]);
  if (found)
    return {
      token: matchedForm(lookup, base, found),
      content,
      endsClause,
      ...moves,
    };
  return gap(nearest(lookup, word));
}

/**
 * Moves each possessive after the word it qualifies (decision 11): "God's
 * house" is SALMAN IAD by G5, "her house" SALMAN TILB by G22, each with
 * its chip. A possessive moves past the next item only, a content word
 * or phrase, so "his son came" is NOR TOX NIIS. A possessor that is
 * itself possessed goes after its own possessor's noun first: "his God's
 * house" is SALMAN IAD TOX, "house of God of his".
 */
function reorder(items: readonly Working[]): EnochianToken[] {
  const out: EnochianToken[] = [];
  for (let at = 0; at < items.length; ) {
    // The chain of possessors from here ("his God's"), each qualifying
    // the next, up to the word they all qualify; a loop, since a chain
    // can be as long as the input.
    let noun = at;
    while (
      items[noun].moves &&
      !items[noun].endsClause &&
      items[noun + 1]?.content
    )
      noun++;
    out.push(items[noun].token);
    for (let one = noun - 1; one >= at; one--) {
      const { token, moves } = items[one];
      const chip: TileChip = { kind: "reordered", rule: moves as RuleId };
      out.push(
        token.kind === "chip"
          ? token
          : { ...token, chips: [...token.chips, chip] },
      );
    }
    at = noun + 1;
  }
  return out;
}

/** English into Enochian (see the module's comment). */
export function toEnochian(lookup: Lookup, text: string): ToEnochian {
  const tokens = englishTokens(text);
  const items: Working[] = [];
  let at = 0;
  while (at < tokens.length) {
    let taken = false;
    // Longest phrase first, within one gloss (decision 6). A possessive
    // ends a phrase, since its word moves, and no phrase crosses the end
    // of a clause ("I am. The Lord your God" is not ZIRENAIAD).
    let longest = Math.min(MAX_PHRASE, tokens.length - at);
    for (let n = 1; n < longest; n++)
      if (tokens[at + n - 1].possessive || tokens[at + n - 1].endsClause)
        longest = n;
    for (let n = longest; n >= 2; n--) {
      const span = tokens.slice(at, at + n).map((one) => one.word);
      const core = coreKeys(span);
      // A lone grammar word, with only articles beside it, is the tables'
      // (decisions 7 and 9): "of a" must not find DE.
      if (!core.length || (core.length === 1 && !isContent(core[0]))) continue;
      const found = match(lookup, span);
      if (!found) continue;
      const last = tokens[at + n - 1];
      items.push({
        token: matchedForm(lookup, baseOf(tokens, at, at + n), found),
        content: true,
        endsClause: last.endsClause,
        ...(last.possessive ? { moves: "G5" as RuleId } : {}),
      });
      at += n;
      taken = true;
      break;
    }
    if (taken) continue;
    items.push(single(lookup, tokens, at));
    at++;
  }
  return { input: "english", tokens: reorder(items) };
}
