import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import type { Task } from "./answer.ts";
import { serialiseContext, task1Input, task2Input } from "./context.ts";
import type { Effort } from "./models.ts";
import { shortName } from "./models.ts";
import { foldVariants } from "./normalise.ts";
import type { Book, Fold } from "./testset.ts";
import type { ModelRequest } from "./transport.ts";

/**
 * The translation requests of plan 077: one per fold, arm, task, book, model
 * and effort.
 *
 * Layout, for the prompt cache: the fixed instructions first (the same in
 * every request), then the context with the dictionary first (the same in
 * every open-book fold), the other Keys, and for A3 the grammar notes, each a
 * system message of its own; the user message holds the task and its input.
 *
 * Arms built here: A0 (no context), A2 (dictionary and the other 18 Keys),
 * A2c (A2 under the cipher; task 1, open book) and A3 (A2 and the grammar
 * notes). Not yet: A4 (A2 plus Laycock and Leitch vol. II, Opus only, five
 * Keys) and task 3 (new English, judged by rubric with a round trip); plan 077
 * lists both as still to build.
 */

export type Arm = "A0" | "A2" | "A2c" | "A3";

export const ARMS: readonly Arm[] = ["A0", "A2", "A2c", "A3"];

/**
 * What one request covers. A0 has no context, so it runs once per task; its
 * book is recorded as "open" (all rows scored) and its checker sees nothing.
 */
export interface TranslateSpec {
  key: number;
  arm: Arm;
  task: Task;
  book: Book;
  model: string;
  effort: Effort;
}

/** The instructions every translation request starts with. */
export const INSTRUCTIONS = `You translate between Enochian, the language of the nineteen Keys (Calls) that John Dee and Edward Kelley recorded, and English.

Reference material may follow these instructions: a dictionary (one entry a line: the word, a tab, then its meanings, each with its source in brackets), the Keys with Dee's English row by row (one row a line: the row id "K.R", the Enochian word, Dee's English, and sometimes the Golden Dawn's spelling), and sometimes notes on grammar. It is your evidence.

How to answer: work it through as you need to, then end your reply with one fenced code block marked json, holding an object with one field, "items": a list with one item per word you translate, in order. Write nothing after the block.

Each item has these fields:
- "source": the word you were given: the Enochian word when translating into English, or the English when translating into Enochian.
- "target": your translation of it, as one reading. A phrase is fine where the word needs one, but not a list of alternatives; where you are unsure between readings, choose one. One Enochian word when translating into Enochian.
- "basis": "attested", "derived", "coined" or "unknown" (below).
- "ref": where the reference material gives the word (below).
- "row": the row id the item answers, when the input gives row ids.
- "token": the number of the input word the item answers, when the input numbers its words.

The basis says how you know:
- "attested": the reference material gives this word with this meaning. "ref" is required and must point to it.
- "derived": you worked it out from words the material does give (a root, a related form, an ending), but the material does not give this word with this meaning. Put the entry or row you built on in "ref", if there is one.
- "coined": the material gives no basis for it; it is your own form or reading.
- "unknown": you can't tell. Put "unknown" as the target. This is a good answer when it is the truth.
Never mark a guess as attested. Cite only what is in the material given here; when there is no material, nothing is attested.

A "ref" is either a dictionary headword written exactly as the dictionary prints it, or a Key row written as its row id, the Key's number, a dot and the row's number (such as "4.12"). Put nothing else in "ref".`;

/** The line the context starts with, so a reply can be traced to it. */
export const CONTEXT_HEAD = "Reference material: our dictionary and the Keys.";

/** The grammar notes' heading in an A3 prompt. */
export const GRAMMAR_HEAD = "Reference material: notes on Enochian grammar.";

const TASK_TEXT: Record<Task, string> = {
  1: `Translate this Enochian text into English. Its words are numbered in square brackets. Give one item for each numbered word, in order, with the word as "source" and its number as "token".`,
  2: `Translate this English into Enochian. Each line is a row id, a tab, and the English for one Enochian word. Give one item for each row, in order, with the row id as "row", the English as "source" and one Enochian word as "target".`,
};

export const NO_MATERIAL =
  "There is no reference material for this request: answer from what you know.";

/** A request's id: what it covers, readable in file names. */
export function requestId(spec: TranslateSpec): string {
  const book = spec.arm === "A0" ? "nobook" : spec.book;
  return [
    spec.arm,
    `t${spec.task}`,
    book,
    `k${String(spec.key).padStart(2, "0")}`,
    shortName(spec.model),
    spec.effort,
  ].join("-");
}

/** What a translation request needs besides its spec. */
export interface PromptData {
  dictionary: EnochianDictionary;
  /** `grammar.md` as written; A3 strips each fold's held-out Key from it. */
  grammar: string;
}

/** One translation request, ready for a transport. */
export function translateRequest(
  fold: Fold,
  spec: TranslateSpec,
  data: PromptData,
): ModelRequest {
  if (spec.key !== fold.key) throw new Error("spec and fold disagree");
  if (spec.arm === "A2c" && (spec.task !== 1 || spec.book !== "open"))
    throw new Error("A2c runs in task 1, open book only");
  const cipher = spec.arm === "A2c";
  const instructions = [INSTRUCTIONS];
  if (spec.arm !== "A0")
    instructions.push(
      `${CONTEXT_HEAD}\n\n${serialiseContext(fold, data.dictionary, {
        book: spec.book,
        cipher,
      })}`,
    );
  if (spec.arm === "A3")
    instructions.push(
      `${GRAMMAR_HEAD}\n\n${stripGrammar(data.grammar, fold, spec.book)}`,
    );
  const input =
    spec.task === 1 ? task1Input(fold, { cipher }) : task2Input(fold);
  const prompt = [
    ...(spec.arm === "A0" ? [NO_MATERIAL] : []),
    TASK_TEXT[spec.task],
    "",
    input,
  ].join("\n");
  return {
    id: requestId(spec),
    kind: "translate",
    model: spec.model,
    effort: spec.effort,
    instructions,
    prompt,
  };
}

/** The choices `run` takes, each a list. */
export interface RunChoice {
  keys: readonly number[];
  arms: readonly Arm[];
  tasks: readonly Task[];
  books: readonly Book[];
  model: string;
  efforts: readonly Effort[];
}

/**
 * Every request a run makes: each Key, arm, task, book and effort, less the
 * pairs plan 077 doesn't run. A0 runs once per task (it has no book); A2c only
 * in task 1, open book.
 */
export function planSpecs(choice: RunChoice): TranslateSpec[] {
  const out: TranslateSpec[] = [];
  for (const key of choice.keys)
    for (const arm of choice.arms)
      for (const task of choice.tasks)
        for (const book of arm === "A0" ? (["open"] as const) : choice.books) {
          if (arm === "A2c" && (task !== 1 || book !== "open")) continue;
          for (const effort of choice.efforts)
            out.push({ key, arm, task, book, model: choice.model, effort });
        }
  return out;
}

// --- Grammar notes for a fold ----------------------------------------------

/**
 * The held-out Key's words that no other Key says, folded as the closed book
 * folds them (`foldVariants`): Casaubon's words and their Golden Dawn forms.
 */
export function heldOutWords(fold: Fold): Set<string> {
  const out = new Set<string>();
  for (const row of fold.rows.filter((one) => one.singleKey))
    for (const form of [row.word, row.gd]) {
      const folded = form ? foldVariants(form) : "";
      if (folded) out.add(folded);
    }
  return out;
}

/** Single letters that are English in the notes ("O thou", "I", "a"). */
const ENGLISH_LETTERS = new Set(["A", "I", "O", "a", "o"]);

/**
 * Whether a token of the notes names one of the held-out words. The notes
 * write Enochian in capitals, Leitch's headwords capitalised ("s.v.
 * Christeos") and Golden Dawn forms in lower case ("vaoresaji"); a lower-case
 * token counts from four letters, so "p." and "of" never do.
 */
export function namesHeldOutWord(
  token: string,
  words: ReadonlySet<string>,
): boolean {
  if (ENGLISH_LETTERS.has(token)) return false;
  if (token === token.toLowerCase() && token.length < 4) return false;
  const folded = foldVariants(token);
  return Boolean(folded) && words.has(folded);
}

/**
 * The headwords a fold's closed book removes (the containment rule included,
 * by which Key 19's closed book loses OMAX), folded.
 */
export function closedRemovals(fold: Fold): Set<string> {
  return new Set(
    fold.removals.map((one) => foldVariants(one.headword)).filter(Boolean),
  );
}

/**
 * Whether a token of the notes names a removed headword. Only tokens with a
 * capital count: the notes write Enochian in capitals (and Leitch's
 * headwords capitalised), and a removed headword may be spelled like an
 * English word.
 */
export function namesRemoved(
  token: string,
  removed: ReadonlySet<string>,
): boolean {
  if (ENGLISH_LETTERS.has(token) || !/[A-Z]/.test(token)) return false;
  const folded = foldVariants(token);
  return Boolean(folded) && removed.has(folded);
}

/** The Keys a piece of text cites: "Key 3", "Key 3.14", "Keys 4–6 and 15". */
export function citedKeys(text: string): { keys: Set<number>; rows: boolean } {
  const keys = new Set<number>();
  let rows = false;
  const number = String.raw`\d+(?:\.\d+)?`;
  const item = String.raw`${number}(?:\s*(?:–|-|to)\s*\d+)?`;
  const list = new RegExp(
    String.raw`\bKeys?\s+(${item}(?:\s*(?:,|and|or|&)\s*${item})*)`,
    "g",
  );
  for (const match of text.matchAll(list))
    for (const one of match[1].split(/\s*(?:,|and|or|&)\s*/)) {
      const range = one.match(/^(\d+)(\.\d+)?(?:\s*(?:–|-|to)\s*(\d+))?$/);
      if (!range) continue;
      if (range[2]) rows = true;
      const from = Number(range[1]);
      const to = range[3] ? Number(range[3]) : from;
      for (let k = from; k <= to; k++) keys.add(k);
    }
  return { keys, rows };
}

/** Abbreviations a sentence doesn't end at. */
const ABBREVIATION = /\b(?:p|pp|vol|ch|s\.v|cf|e\.g|i\.e|no|ed)\.$/i;

/** A paragraph's sentences, split after ". ", "? " and "! ". */
function sentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const match of text.matchAll(/[.?!]["”')]?\s+(?=["“(]?[A-Z])/g)) {
    const end = match.index + match[0].length;
    if (ABBREVIATION.test(text.slice(start, match.index + 1))) continue;
    out.push(text.slice(start, end).trim());
    start = end;
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

/**
 * The grammar notes as a fold may see them (plan 077, arm A3: "each fold
 * drops the notes' examples taken from the held-out Key"). After the
 * introduction, anything that cites the held-out Key, or names a word only
 * the held-out Key says, goes; in closed book, so does anything naming a
 * headword the closed book removes:
 *
 * - a rule whose heading does, whole, and a rule none of whose prose is
 *   left;
 * - an Example, Evidence or Expert line that does;
 * - a sentence of a rule's prose that does (the rest of the paragraph stays);
 * - on a Sources line, only the word itself, as "…" (the page stays).
 *
 * In the introduction, which explains how the notes cite the Keys, only row
 * citations and held-out words count. Lines are joined per paragraph, which
 * the model doesn't mind.
 */
export function stripGrammar(
  grammar: string,
  fold: Fold,
  book: Book = "open",
): string {
  const words = heldOutWords(fold);
  const removed = book === "closed" ? closedRemovals(fold) : new Set<string>();
  const banned = (token: string) =>
    namesHeldOutWord(token, words) || namesRemoved(token, removed);
  const names = (text: string) =>
    [...text.matchAll(/[A-Za-z]+/g)].some((one) => banned(one[0]));
  let intro = true;
  const cites = (text: string) => {
    const found = citedKeys(text);
    return found.keys.has(fold.key) && (!intro || found.rows);
  };
  const offends = (text: string) => cites(text) || names(text);
  const out: string[] = [];
  // The rule being read: kept only if some of its prose survives, since the
  // prose is what states it; examples and sources alone would be a husk.
  let rule: { lines: string[]; prose: boolean } | undefined;
  const flush = () => {
    if (rule?.prose) out.push(...rule.lines);
    rule = undefined;
  };
  const emit = (text: string, prose = false) => {
    if (!rule) return out.push(text);
    rule.lines.push(text);
    if (prose) rule.prose = true;
  };
  const lines = grammar.split("\n");
  let skipping = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("#")) {
      flush();
      if (line.startsWith("## ")) intro = false;
      skipping = line.startsWith("### ") && offends(line);
      if (line.startsWith("### ")) {
        if (!skipping) rule = { lines: [line], prose: false };
      } else out.push(line);
      continue;
    }
    if (skipping) continue;
    if (!line.trim()) {
      emit(line);
      continue;
    }
    // A block: a list item with its indented continuation, or a paragraph.
    const block = [line];
    const item = line.startsWith("- ");
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() &&
      !/^(?:#|- )/.test(lines[i + 1]) &&
      (!item || lines[i + 1].startsWith("  "))
    )
      block.push(lines[++i]);
    const text = block.map((one) => one.trim()).join(" ");
    if (item && text.startsWith("- Sources:")) {
      if (!cites(text))
        emit(
          text.replace(/[A-Za-z]+/g, (token) => (banned(token) ? "…" : token)),
        );
    } else if (item) {
      if (!offends(text)) emit(text);
    } else {
      const kept = sentences(text).filter((one) => !offends(one));
      if (kept.length) emit(kept.join(" "), true);
    }
  }
  flush();
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
