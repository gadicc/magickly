import { findParts } from "../keys/dictionaryKeys.ts";
import { deaccent, englishWords } from "./english.ts";
import { cleanGloss, dictionaryGlosses } from "./glosses.ts";
import { BEHIND, FRONT, joinSplits } from "./joins.ts";
import type { LeitchSpelling } from "./leitchSpellings.ts";
import {
  type AethyrName,
  enochianWords,
  fold,
  type Lookup,
  type Row,
} from "./lookupData.ts";
import type { KeyPlace, RuleId } from "./toEnochian.ts";

/**
 * Enochian into English by lookup (plan 081, decisions 13–16): Dee's
 * words from the Keys, then the dictionary; Crowley's Golden Dawn forms
 * (G38) and Leitch's spellings mapped to Dee's words; a joined word split
 * by rule; and a reading line in Dee's own English wherever the input
 * runs along his lines.
 */

/** How a word of the input was read. */
export type ReadVia = "keys" | "gd" | "leitch" | "dictionary" | "split";

/** One of Dee's words (or a dictionary headword) a reading takes. */
export interface ReadWord {
  /**
   * As shown, always as a source prints it: Casaubon's word, the
   * dictionary's headword, an Aethyr's name, or, where Casaubon's print
   * lost Dee's word (`notInCasaubon`), Crowley's form as he prints it.
   */
  word: string;
  /**
   * Casaubon's print lost Dee's word here (Keys 13–16), so `word` is
   * Crowley's form, labelled as his: Dee's own spelling is not known.
   */
  notInCasaubon?: true;
  /** Its English, cleaned (decision 14); "" where none is known. */
  gloss: string;
  /** The dictionary keys to open; empty if it has no entry. */
  entries: readonly string[];
  /** Dee's rows it stands for; empty for a dictionary-only word. */
  rows: readonly KeyPlace[];
  /**
   * The gloss is from a row where we split Dee's running English
   * (`englishSplit`), so shown on its tile, not as his (decision 14).
   */
  ours: boolean;
  /** For a dictionary-only word: the headword's cited work. */
  work?: string;
}

/** One reading of a word of the input. */
export interface Reading {
  via: ReadVia;
  /** One word, or two for a split or a Golden Dawn form spanning two. */
  words: readonly ReadWord[];
  /** For a split, the rules that made it (G26, G30, G22, then G27). */
  rules: readonly RuleId[];
  /** For one of Leitch's spellings, his entry's printed page. */
  leitchPage?: number;
}

/** A word (or a Golden Dawn form of several) of the input. */
export interface ReadToken {
  /** As typed. */
  input: string;
  /** Which of the input's words, `[from, to)`. */
  span: readonly [number, number];
  /** The first reading is the one the line uses; none if not found. */
  readings: readonly Reading[];
  /** Which run of Dee's lines it is in, from 0; none if not in one. */
  run?: number;
  /** For a word not found: the nearest spellings we have (decision 16). */
  nearest: readonly string[];
}

/** A stretch of the reading line. */
export interface LineSegment {
  /**
   * `dee`: a run of Dee's lines, his English; `word`: glosses word by
   * word; `tile-only`: a word whose gloss is our split of Dee's English
   * (`englishSplit`), shown on its tile, not on the line, so `text` is
   * empty (decision 14); `unglossed`: a word we have with no known
   * meaning; `missing`: a word not in our data, `text` as typed.
   */
  kind: "dee" | "word" | "tile-only" | "unglossed" | "missing";
  text: string;
  /** The tokens it covers, `[from, to)`, in `tokens`. */
  tokens: readonly [number, number];
  /**
   * For a word read two ways (a split that fits twice), which reading,
   * from 0; the page shows the readings as alternatives.
   */
  reading?: number;
  /**
   * For a reading of several words (a split, a Golden Dawn form spanning
   * two of Dee's, one of Leitch's joined forms), which of them, `[from,
   * to)`: each part whose gloss is only our split of Dee's English is a
   * `tile-only` segment of its own, and the rest stay on the line.
   */
  parts?: readonly [number, number];
}

/** Enochian into English. */
export interface ToEnglish {
  input: "enochian";
  tokens: readonly ReadToken[];
  line: readonly LineSegment[];
}

/** How many nearest spellings a word not found shows. */
const NEAREST_SPELLINGS = 5;

const place = (row: Row): KeyPlace => ({
  key: row.key,
  row: row.row,
  english: row.english,
});

/**
 * Crowley's form as a word to look up, as `Keys.ts` reads one: capitals,
 * letters only, accents off (never shown).
 */
const lookupOf = (form: string) =>
  deaccent(form)
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();

function readWord(lookup: Lookup, row: Row, english = row.english): ReadWord {
  // Where Casaubon's print lost the word, Crowley's form stands in, as he
  // prints it and labelled so; it is looked up by its letters.
  const lost = !row.word;
  const word = lost ? row.gd : row.word;
  const lookupWord = lost ? lookupOf(row.gd) : row.word;
  return {
    word,
    ...(lost ? { notInCasaubon: true as const } : {}),
    gloss: cleanGloss(english),
    entries: findParts(lookup.source, lookupWord, lookup.stripped) ?? [],
    rows: [place(row)],
    ours: row.split,
  };
}

/** A Crowley form's rows: its own, and any he joins to it or overlaps. */
function spanned(lookup: Lookup, row: Row): Row[] {
  const rows = lookup.keyRows.get(row.key) ?? [];
  const out = [row];
  for (let at = row.row; at < rows.length; at++) {
    const next = rows[at];
    if (next.marker !== "joined" && next.marker !== "overlap") break;
    out.push(next);
  }
  return out;
}

/**
 * Of a word's places, the one whose English to show: the commonest, the
 * closing formula counted once (G40), the earliest on a tie; Dee's own
 * glosses before ours where a word has both (decision 14).
 */
function commonest(places: readonly Row[][]): Row[] {
  const own = places.filter(([first]) => !first.split);
  const pool = own.length ? own : places;
  const counts = new Map<string, { count: number; first: Row[] }>();
  for (const rows of pool) {
    if (rows[0].formula === "repeat") continue;
    const key = rows.flatMap((one) => one.core).join(" ");
    if (!key) continue;
    const one = counts.get(key);
    if (one) one.count++;
    else counts.set(key, { count: 1, first: rows });
  }
  let best: { count: number; first: Row[] } | undefined;
  for (const one of counts.values())
    if (!best || one.count > best.count) best = one;
  return best?.first ?? pool[0];
}

/** A reading of one of Dee's words, by its commonest English. */
function keyReading(lookup: Lookup, folded: string): Reading {
  const rows = lookup.keyForms.get(folded) ?? [];
  const [chosen] = commonest(rows.map((row) => [row]));
  return {
    via: "keys",
    words: [
      {
        ...readWord(lookup, chosen),
        word: lookup.display.get(folded) ?? chosen.word,
        rows: rows.filter((row) => row.formula !== "repeat").map(place),
      },
    ],
    rules: [],
  };
}

/** A reading of a Crowley form: Dee's words it stands for (decision 13). */
function gdReading(lookup: Lookup, rows: readonly Row[]): Reading {
  const chosen = commonest(rows.map((row) => spanned(lookup, row)));
  return {
    via: "gd",
    words: chosen.map((row) => readWord(lookup, row)),
    rules: [],
  };
}

/**
 * A dictionary-only word's short gloss (decision 14): the first meaning's
 * shortest gloss without a comma, since a first meaning is often a raw
 * string ("I, my"; "govern, to; (see 'cab')").
 */
function shortGloss(lookup: Lookup, folded: string) {
  const word = lookup.dictionary.get(folded);
  if (!word) return undefined;
  let best:
    | { at: number; length: number; gloss: string; work: string }
    | undefined;
  word.meanings.forEach(({ meaning, source }, at) => {
    for (const gloss of dictionaryGlosses(meaning)) {
      if (gloss.includes(",")) continue;
      const length = englishWords(gloss).length;
      if (
        !best ||
        at < best.at ||
        (at === best.at &&
          (length < best.length ||
            (length === best.length && gloss < best.gloss)))
      )
        best = { at, length, gloss, work: source };
    }
  });
  return {
    headword: word.headwords[0],
    gloss: best ? cleanGloss(best.gloss).toLowerCase() : "",
    work: best?.work ?? word.meanings[0]?.source,
  };
}

function dictionaryWord(lookup: Lookup, folded: string): ReadWord | undefined {
  const found = shortGloss(lookup, folded);
  if (!found) return undefined;
  return {
    word: found.headword,
    gloss: found.gloss,
    entries: [found.headword],
    rows: [],
    ours: false,
    ...(found.work ? { work: found.work } : {}),
  };
}

/** One of Leitch's spellings, read as Dee's words at its rows. */
function leitchReading(lookup: Lookup, entry: LeitchSpelling): Reading {
  const rows = lookup.keyRows.get(entry.key) ?? [];
  return {
    via: "leitch",
    words: entry.rows
      .map((n) => rows[n - 1])
      .filter(Boolean)
      .map((row) => readWord(lookup, row)),
    rules: [],
    leitchPage: entry.page,
  };
}

/** A folded word as one word, for a split's part. */
function partWord(lookup: Lookup, folded: string): ReadWord {
  if (lookup.keyForms.has(folded)) return keyReading(lookup, folded).words[0];
  const gd = lookup.gdForms.get(folded);
  if (gd) {
    const words = gdReading(lookup, gd).words;
    return words.length === 1
      ? words[0]
      : {
          ...words[0],
          gloss: words.map((one) => one.gloss).join(" "),
          rows: words.flatMap((one) => one.rows),
        };
  }
  const fromDictionary = dictionaryWord(lookup, folded);
  if (fromDictionary) return fromDictionary;
  const small = [...FRONT, ...BEHIND].find(([word]) => word === folded);
  return {
    word: lookup.display.get(folded) ?? folded,
    gloss: small?.[1] ?? "",
    entries: [],
    rows: [],
    ours: false,
  };
}

/** Edit distance, for a word not found (decision 16). */
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length];
}

/** Counts kept for a test: how many edit distances a call worked out. */
export interface SpellingStats {
  distances: number;
}

/** Every known spelling, folded, by its length, built once per index. */
const byLengthCache = new WeakMap<Lookup, Map<number, string[]>>();

function spellingsByLength(lookup: Lookup): Map<number, string[]> {
  let byLength = byLengthCache.get(lookup);
  if (!byLength) {
    byLength = new Map();
    const all = new Set([
      ...lookup.keyForms.keys(),
      ...lookup.dictionary.keys(),
      ...lookup.gdForms.keys(),
    ]);
    for (const word of all) {
      const list = byLength.get(word.length) ?? [];
      list.push(word);
      byLength.set(word.length, list);
    }
    byLengthCache.set(lookup, byLength);
  }
  return byLength;
}

/**
 * The nearest spellings to a word not found: one letter off for a word
 * of four letters or fewer, two otherwise; nearest first, then Dee's
 * words, then the closer length, then the spelling. Only spellings of a
 * length within reach are compared, since the distance is at least the
 * difference in length.
 */
function nearestSpellings(
  lookup: Lookup,
  folded: string,
  stats?: SpellingStats,
): string[] {
  const most = folded.length <= 4 ? 1 : 2;
  const byLength = spellingsByLength(lookup);
  const found: { word: string; distance: number; key: boolean }[] = [];
  for (
    let length = folded.length - most;
    length <= folded.length + most;
    length++
  )
    for (const word of byLength.get(length) ?? []) {
      if (stats) stats.distances++;
      const distance = editDistance(folded, word);
      if (distance <= most)
        found.push({ word, distance, key: lookup.keyForms.has(word) });
    }
  found.sort(
    (a, b) =>
      a.distance - b.distance ||
      Number(b.key) - Number(a.key) ||
      Math.abs(a.word.length - folded.length) -
        Math.abs(b.word.length - folded.length) ||
      (a.word < b.word ? -1 : a.word > b.word ? 1 : 0),
  );
  return found
    .slice(0, NEAREST_SPELLINGS)
    .map(
      ({ word }) =>
        lookup.display.get(word) ?? lookup.gdForms.get(word)?.[0].gd ?? word,
    );
}

/** Every reading of a word not in a run, best first (decision 13). */
function readOne(lookup: Lookup, folded: string): Reading[] {
  const out: Reading[] = [];
  const gd = lookup.gdForms.get(folded) ?? [];
  if (lookup.keyForms.has(folded)) {
    out.push(keyReading(lookup, folded));
    // A Crowley form that is also one of Dee's words: his reading second,
    // where it stands for other words. A row whose own word is lost reads
    // as the same spelling, so adds nothing (OD).
    const others = gd.filter((row) => row.folded && row.folded !== folded);
    if (others.length) out.push(gdReading(lookup, others));
  } else if (gd.length) out.push(gdReading(lookup, gd));
  if (out.length) return out;
  const fromDictionary = dictionaryWord(lookup, folded);
  if (fromDictionary)
    return [{ via: "dictionary", words: [fromDictionary], rules: [] }];
  const leitch = lookup.leitch.get(folded);
  if (leitch) {
    const readings = leitch.map((entry) => leitchReading(lookup, entry));
    // ODZAMRAN is at two places with the same words: one reading.
    return readings.filter(
      (one, at) =>
        readings.findIndex(
          (other) =>
            other.words.map((w) => w.word).join(" ") ===
            one.words.map((w) => w.word).join(" "),
        ) === at,
    );
  }
  return joinSplits(lookup, folded).map((split) => ({
    via: "split",
    words: split.parts.map((part) => partWord(lookup, part)),
    rules: split.rules,
  }));
}

/** One step along Dee's lines: the rows a typed word covers. */
interface Step {
  rows: Row[];
  /** How many typed words it takes. */
  words: number;
  via: Exclude<ReadVia, "dictionary" | "split">;
  aethyr?: AethyrName;
  leitch?: LeitchSpelling;
}

/** Whether the typed words at `at` read row `index` of a Key, and how. */
function stepAt(
  lookup: Lookup,
  keyRows: readonly Row[],
  index: number,
  typed: readonly string[],
  at: number,
): Step | undefined {
  const row = keyRows[index];
  const word = typed[at];
  if (!row || word === undefined) return undefined;
  if (row.folded && word === row.folded)
    return { rows: [row], words: 1, via: "keys" };
  if (row.aethyrSlot)
    for (const aethyr of lookup.aethyrs)
      if (aethyr.folded.includes(word))
        return {
          rows: [row],
          words: 1,
          via: word === fold(aethyr.dee) ? "keys" : "gd",
          aethyr,
        };
  const parts = row.gdParts;
  if (
    parts.length > 1 &&
    parts.every((part, offset) => typed[at + offset] === part)
  )
    return { rows: spanned(lookup, row), words: parts.length, via: "gd" };
  if (row.gdFolded && word === row.gdFolded)
    return { rows: spanned(lookup, row), words: 1, via: "gd" };
  for (const entry of lookup.leitch.get(word) ?? [])
    if (entry.key === row.key && entry.rows[0] === row.row)
      return {
        rows: entry.rows.map((n) => keyRows[n - 1]).filter(Boolean),
        words: 1,
        via: "leitch",
        leitch: entry,
      };
  return undefined;
}

/** The rows a run may pass over unsaid: a word given but not spoken. */
const silent = (row: Row, after?: Step) =>
  (!row.word && !row.gd && row.marker !== "joined") ||
  (after?.via === "gd" && row.marker === "absent");

/** The steps of a run of Dee's lines from a row, as far as it goes. */
function runFrom(
  lookup: Lookup,
  start: Row,
  typed: readonly string[],
  at: number,
): Step[] {
  const keyRows = lookup.keyRows.get(start.key) ?? [];
  const steps: Step[] = [];
  let index = start.row - 1;
  let word = at;
  let skipped = 0;
  while (word < typed.length && index < keyRows.length) {
    const step = stepAt(lookup, keyRows, index, typed, word);
    if (step) {
      steps.push(step);
      word += step.words;
      index += step.rows.length;
      skipped = 0;
      continue;
    }
    if (steps.length && skipped < 2 && silent(keyRows[index], steps.at(-1))) {
      index++;
      skipped++;
      continue;
    }
    break;
  }
  return steps;
}

/** Rows a typed word could begin a run at, by the word. */
function runStarts(lookup: Lookup): Map<string, Row[]> {
  const starts = new Map<string, Set<Row>>();
  const add = (word: string, row: Row) => {
    if (!word) return;
    let set = starts.get(word);
    if (!set) {
      set = new Set();
      starts.set(word, set);
    }
    set.add(row);
  };
  for (const row of lookup.rows) {
    add(row.folded, row);
    add(row.gdFolded, row);
    add(row.gdParts[0] ?? "", row);
    if (row.aethyrSlot)
      for (const aethyr of lookup.aethyrs)
        for (const one of aethyr.folded) add(one, row);
  }
  for (const [word, entries] of lookup.leitch)
    for (const entry of entries) {
      const row = lookup.keyRows.get(entry.key)?.[entry.rows[0] - 1];
      if (row) add(word, row);
    }
  const out = new Map<string, Row[]>();
  for (const [word, set] of starts)
    out.set(
      word,
      [...set].sort((a, b) => a.key - b.key || a.row - b.row),
    );
  return out;
}

const startsCache = new WeakMap<Lookup, Map<string, Row[]>>();

/** A step's English: a slot row takes its Aethyr's ordinal. */
function stepWords(lookup: Lookup, step: Step): ReadWord[] {
  return step.rows.map((row) => {
    if (!step.aethyr) return readWord(lookup, row);
    const english = row.english.replace("first", step.aethyr.ordinal);
    return {
      ...readWord(lookup, row, english),
      word: step.aethyr.dee || row.word,
    };
  });
}

/** Enochian into English (see the module's comment). */
export function toEnglish(
  lookup: Lookup,
  text: string,
  stats?: SpellingStats,
): ToEnglish {
  const typed = enochianWords(text);
  const folded = typed.map(fold);
  let starts = startsCache.get(lookup);
  if (!starts) {
    starts = runStarts(lookup);
    startsCache.set(lookup, starts);
  }
  const tokens: ReadToken[] = [];
  // A word typed many times is looked up once.
  const near = new Map<string, string[]>();
  const nearestOf = (word: string) => {
    let found = near.get(word);
    if (!found) {
      found = nearestSpellings(lookup, word, stats);
      near.set(word, found);
    }
    return found;
  };
  let runs = 0;
  let at = 0;
  while (at < folded.length) {
    // The longest run of Dee's lines from here, of two words or more
    // (decision 14); the earliest Key on a tie. One of Crowley's spaced
    // forms ("das iod") is such a run on its own.
    let best: Step[] = [];
    let bestWords = 1;
    for (const row of starts.get(folded[at]) ?? []) {
      const steps = runFrom(lookup, row, folded, at);
      const words = steps.reduce((sum, step) => sum + step.words, 0);
      if (words > bestWords) {
        best = steps;
        bestWords = words;
      }
    }
    if (best.length) {
      const run = runs++;
      for (const step of best) {
        tokens.push({
          input: typed.slice(at, at + step.words).join(" "),
          span: [at, at + step.words],
          readings: [
            {
              via: step.via,
              words: stepWords(lookup, step),
              rules: [],
              ...(step.leitch ? { leitchPage: step.leitch.page } : {}),
            },
          ],
          run,
          nearest: [],
        });
        at += step.words;
      }
      continue;
    }
    const readings = readOne(lookup, folded[at]);
    tokens.push({
      input: typed[at],
      span: [at, at + 1],
      readings,
      nearest: readings.length ? [] : nearestOf(folded[at]),
    });
    at++;
  }
  return { input: "enochian", tokens, line: readingLine(tokens) };
}

/** A reading's English, its words' glosses in turn. */
export const readingGloss = (reading: Reading) =>
  reading.words
    .map((one) => one.gloss)
    .filter(Boolean)
    .join(" ");

/**
 * The reading line (decision 14): each run of Dee's lines as his English,
 * the rest word by word; a split that fits twice gives both readings,
 * each part whose gloss is only our split marked `tile-only`.
 */
function readingLine(tokens: readonly ReadToken[]): LineSegment[] {
  const out: LineSegment[] = [];
  for (let at = 0; at < tokens.length; at++) {
    const token = tokens[at];
    if (token.run !== undefined) {
      let end = at + 1;
      while (end < tokens.length && tokens[end].run === token.run) end++;
      out.push({
        kind: "dee",
        text: tokens
          .slice(at, end)
          .map((one) => readingGloss(one.readings[0]))
          .filter(Boolean)
          .join(" "),
        tokens: [at, end],
      });
      at = end - 1;
      continue;
    }
    if (!token.readings.length) {
      out.push({ kind: "missing", text: token.input, tokens: [at, at + 1] });
      continue;
    }
    const readings =
      token.readings[0].via === "split" ? token.readings : [token.readings[0]];
    readings.forEach((reading, index) => {
      const which = readings.length > 1 ? { reading: index } : {};
      const several = reading.words.length > 1;
      let from = 0;
      // Dee's own parts on the line, run together; each of ours alone.
      const flush = (to: number) => {
        if (to <= from) return;
        const text = reading.words
          .slice(from, to)
          .map((one) => one.gloss)
          .filter(Boolean)
          .join(" ");
        out.push({
          kind: text ? "word" : "unglossed",
          text,
          tokens: [at, at + 1],
          ...which,
          ...(several ? { parts: [from, to] as const } : {}),
        });
      };
      reading.words.forEach((one, part) => {
        if (!one.ours) return;
        flush(part);
        out.push({
          kind: "tile-only",
          text: "",
          tokens: [at, at + 1],
          ...which,
          ...(several ? { parts: [part, part + 1] as const } : {}),
        });
        from = part + 1;
      });
      flush(reading.words.length);
    });
  }
  return out;
}

/**
 * The line as plain text, for tests and logs: a word not found shown
 * `[AS TYPED?]`, a tile-only word or part `…`, a word's second reading
 * after ` / `.
 */
export function lineText(line: readonly LineSegment[]): string {
  const out: string[] = [];
  line.forEach((one, at) => {
    const before = line[at - 1];
    if (
      one.reading &&
      before?.tokens[0] === one.tokens[0] &&
      before.reading !== one.reading
    )
      out.push("/");
    out.push(
      one.kind === "missing"
        ? `[${one.text}?]`
        : one.kind === "tile-only"
          ? "…"
          : one.text,
    );
  });
  return out.filter(Boolean).join(" ");
}
