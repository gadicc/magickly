import { createHash } from "node:crypto";
import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import { z } from "zod";
import {
  type AnswerItem,
  type CheckContext,
  checkContextFrom,
  checkItem,
  parseRef,
} from "./answer.ts";
import {
  JUDGES,
  type JudgeCase,
  type JudgedRow,
  type JudgedRows,
  type JudgeName,
  type JudgeRow,
  parseVerdicts,
  sameAnswer,
  type Verdict,
} from "./judge.ts";
import {
  type RoundTripSpec,
  roundTripContext,
  type Task3Sentence,
} from "./newprompt.ts";
import { type Share, share } from "./newscore.ts";
import {
  letterChain,
  plantContext,
  plantRule,
  prng,
  shuffle,
} from "./newtext.ts";
import {
  englishWords,
  FUNCTION_WORDS,
  normEnochian,
  sharesContentWord,
  stemEnglish,
} from "./normalise.ts";
import { GRAMMAR_HEAD } from "./prompt.ts";
import { parseReply } from "./reply.ts";
import type { KeyRowRecord } from "./testset.ts";
import type { ModelRequest } from "./transport.ts";

/**
 * Task 3 of plan 077: new English into Enochian, with no answer key. Every
 * translation is a candidate; candidates come from the model runs, from A1
 * (word-by-word lookup) and from about 15 damaged controls made from A1's.
 * Both judges score every candidate blind against the plan's rubric, and
 * compare its round trip (the Enochian put back into English by a separate
 * call that sees only the dictionary) with the English. The judges never see
 * where a candidate came from: its id is a hash, and the candidates are
 * shuffled into cases by seed.
 */

/** How a damaged control was damaged (plan 077, "Scoring"). */
export type Damage = "wrong word" | "coinage" | "dropped clause";

export const DAMAGES: readonly Damage[] = [
  "wrong word",
  "coinage",
  "dropped clause",
];

/** One translation of one sentence, as the judges will see it. */
export interface Task3Candidate {
  /** The blind id the judges see (`blindId`). */
  id: string;
  /**
   * Where it came from, never shown: "A1", "control", or a run's group
   * ("<run>:A3 opus medium").
   */
  source: string;
  sentence: string;
  english: string;
  items: AnswerItem[];
  /** A damaged control: what was done to A1's translation. */
  damage?: Damage;
  /** A damaged control: the id of the A1 translation it was made from. */
  of?: string;
  /** Why there is nothing to judge (the call failed, or was blocked twice). */
  missing?: string;
}

/** What makes the blind ids; changing it changes every id. */
export const POOL_SALT = "plan-077-task3";

/** A candidate's blind id: "c" and ten hex digits of a hash. */
export function blindId(source: string, sentence: string): string {
  return `c${createHash("sha256")
    .update(`${POOL_SALT}\n${source}\n${sentence}`)
    .digest("hex")
    .slice(0, 10)}`;
}

/** A translation as running Enochian: its targets, "[?]" for "unknown". */
export function translationText(items: readonly AnswerItem[]): string {
  return items
    .map((one) =>
      one.basis === "unknown" || /^unknown$/i.test(one.target.trim())
        ? "[?]"
        : one.target.trim(),
    )
    .filter(Boolean)
    .join(" ");
}

export function candidate(
  source: string,
  sentence: Task3Sentence,
  items: readonly AnswerItem[],
  extra: Pick<Task3Candidate, "damage" | "missing" | "of"> = {},
): Task3Candidate {
  return {
    id: blindId(source, sentence.id),
    source,
    sentence: sentence.id,
    english: sentence.english,
    items: [...items],
    ...extra,
  };
}

/** A model's answer items, by the sentence each names in `row`. */
export function itemsBySentence(
  items: readonly AnswerItem[],
  sentences: readonly string[],
): Map<string, AnswerItem[]> {
  const out = new Map(sentences.map((id) => [id, [] as AnswerItem[]]));
  for (const item of items) out.get(item.row ?? "")?.push(item);
  return out;
}

// --- Damaged controls -------------------------------------------------------------

/** How many damaged controls (plan 077: "about 15"). */
export const CONTROLS = 15;

/** The controls' seed: the plan's number, as the new text's. */
export const CONTROL_SEED = 77;

/** The items a dropped clause leaves: those before the last clause. */
function dropClause(english: string, items: readonly AnswerItem[]) {
  const words = englishWords(english);
  const comma = english.lastIndexOf(",");
  const head =
    comma > 0 && englishWords(english.slice(comma)).length >= 2
      ? englishWords(english.slice(0, comma)).length
      : Math.ceil(words.length * 0.6);
  let at = 0;
  return items.filter((item) => {
    while (at < words.length && words[at] !== item.source.toLowerCase()) at++;
    return at < head;
  });
}

/**
 * About 15 damaged translations, made by script from A1's (plan 077, "The
 * judges are checked"), each of another sentence, chosen by seed among the
 * A1 translations of three words or more with no unknown word: a "[?]" hole
 * would get a translation rejected whatever the damage, so the control
 * would test nothing. Up to a third of `count` of each kind, as the
 * sentences allow (each says which, in `damage`):
 * - "wrong word": an attested word swapped for another headword whose
 *   meanings share nothing with the English it stands for, still cited as
 *   attested;
 * - "coinage": an attested word swapped for a made-up one (by the planted
 *   words' rule), marked attested, as if it were in the dictionary;
 * - "dropped clause": the words of the last clause (after the last comma,
 *   else the last two fifths) left out.
 * A control counts only if both judges accept the translation it was made
 * from (`task3Report`).
 */
export function damagedControls(
  a1: readonly Task3Candidate[],
  data: { dictionary: EnochianDictionary; rows: readonly KeyRowRecord[] },
  seed = CONTROL_SEED,
  count = CONTROLS,
): Task3Candidate[] {
  const random = prng(seed);
  const headwords = Object.keys(data.dictionary).sort();
  const context = plantContext({
    dictionary: data.dictionary,
    rows: [...data.rows],
  });
  const chain = letterChain(data.rows);
  const coined: string[] = [];
  const coin = () => {
    for (;;) {
      const word = chain(random);
      if (!plantRule(word, context, coined)) {
        coined.push(word);
        return word;
      }
    }
  };
  const order = shuffle(
    [...a1]
      .filter(
        (one) =>
          !one.missing &&
          one.items.length >= 3 &&
          one.items.every((item) => item.basis === "attested"),
      )
      .sort((a, b) => (a.sentence < b.sentence ? -1 : 1)),
    random,
  );
  const each = Math.ceil(count / DAMAGES.length);
  const made = new Map<Damage, number>(DAMAGES.map((one) => [one, 0]));
  const out: Task3Candidate[] = [];
  for (const one of order) {
    if (out.length >= count) break;
    // The kind with fewest made so far that this sentence allows.
    const kinds = [...DAMAGES]
      .filter((kind) => (made.get(kind) ?? 0) < each)
      .sort((a, b) => (made.get(a) ?? 0) - (made.get(b) ?? 0));
    const kept = dropClause(one.english, one.items);
    const damage = kinds.find(
      (kind) =>
        kind !== "dropped clause" ||
        (one.items.length - kept.length >= 2 && kept.length >= 1),
    );
    if (!damage) continue;
    let items = one.items.map((item) => ({ ...item }));
    if (damage === "dropped clause") items = kept.map((item) => ({ ...item }));
    else {
      const target = items[Math.floor(random() * items.length)];
      if (damage === "coinage") {
        target.target = coin();
        target.ref = target.target;
      } else {
        const others = headwords.filter(
          (word) =>
            normEnochian(word) !== normEnochian(target.target) &&
            data.dictionary[word].meanings.length > 0 &&
            !data.dictionary[word].meanings.some(({ meaning }) =>
              sharesContentWord(meaning, target.source),
            ),
        );
        const word = others[Math.floor(random() * others.length)];
        target.target = word;
        target.ref = word;
      }
    }
    made.set(damage, (made.get(damage) ?? 0) + 1);
    out.push(
      candidate(
        `control-${out.length + 1}`,
        { id: one.sentence, kind: "", english: one.english },
        items,
        { damage, of: one.id },
      ),
    );
  }
  return out;
}

// --- The judges' cases ----------------------------------------------------------

/** Candidates a rubric case holds. */
export const RUBRIC_CASE = 15;

/** Round trips a comparison case holds. */
export const ROUND_TRIP_CASE = 40;

/** A case's id: what it holds, hashed, so a later round's cases are new. */
function caseId(prefix: string, rows: readonly string[]): string {
  return `${prefix}-${createHash("sha256")
    .update([...rows].sort().join("\n"))
    .digest("hex")
    .slice(0, 10)}`;
}

/**
 * Shuffles candidates by seed and deals them into cases of about `size`,
 * never two of one sentence in a case, so neither an id nor a place says
 * where a candidate came from, and a control never sits beside the A1
 * translation it was made from.
 */
export function dealCases<T extends { id: string; sentence: string }>(
  candidates: readonly T[],
  size: number,
  seed = CONTROL_SEED,
): T[][] {
  const order = shuffle(
    [...candidates].sort((a, b) => (a.id < b.id ? -1 : 1)),
    prng(seed),
  );
  const cases: T[][] = Array.from(
    { length: Math.max(1, Math.ceil(order.length / size)) },
    () => [],
  );
  for (const one of order) {
    const open = cases
      .filter((list) => !list.some((other) => other.sentence === one.sentence))
      .sort((a, b) => a.length - b.length);
    (open[0] ?? cases.sort((a, b) => a.length - b.length)[0]).push(one);
  }
  return cases.filter((list) => list.length);
}

/** One word of a candidate as the judges see it, a cited Key row spelled out. */
function wordsOf(
  items: readonly AnswerItem[],
  keyRows: ReadonlyMap<string, KeyRowRecord>,
): NonNullable<JudgeRow["words"]> {
  return items.map((item) => {
    const ref = parseRef(item.ref);
    const row = ref.kind === "row" ? keyRows.get(ref.id) : undefined;
    return {
      enochian: item.target,
      english: item.source,
      basis: item.basis,
      ...(item.ref ? { ref: item.ref } : {}),
      ...(row
        ? {
            cited: `Key row ${row.id}: ${row.word ?? row.gd ?? ""} = ${row.english}`,
          }
        : {}),
    };
  });
}

/** The rubric's cases: every candidate with a translation, blind. */
export function rubricCases(
  candidates: readonly Task3Candidate[],
  keyRows: readonly KeyRowRecord[],
  seed = CONTROL_SEED,
): JudgeCase[] {
  const rows = new Map(keyRows.map((row) => [row.id, row]));
  return dealCases(
    candidates.filter((one) => !one.missing && one.items.length),
    RUBRIC_CASE,
    seed,
  ).map((list) => {
    const judged = list.map((one): JudgeRow => {
      const text = translationText(one.items);
      const words = wordsOf(one.items, rows);
      return {
        row: one.id,
        enochian: text,
        dee: one.english,
        answer: text,
        meanings: [],
        words,
        question: JSON.stringify(["task3-rubric", one.english, words]),
      };
    });
    return {
      answer: caseId(
        "T3J",
        judged.map((one) => one.row),
      ),
      key: 0,
      rows: judged,
    };
  });
}

/** The round-trip row id of a candidate. */
export const roundTripRow = (id: string) => `${id}-rt`;

/** The round-trip comparison's cases: candidates whose round trip is in. */
export function roundTripCases(
  candidates: readonly Task3Candidate[],
  roundTrips: ReadonlyMap<string, string>,
  seed = CONTROL_SEED,
): JudgeCase[] {
  const ready = candidates.filter(
    (one) => !one.missing && roundTrips.has(one.id),
  );
  return dealCases(ready, ROUND_TRIP_CASE, seed).map((list) => {
    const judged = list.map((one): JudgeRow => {
      const back = roundTrips.get(one.id) as string;
      return {
        row: roundTripRow(one.id),
        enochian: "",
        dee: one.english,
        answer: back,
        meanings: [],
        question: JSON.stringify(["task3-roundtrip", one.english, back]),
      };
    });
    return {
      answer: caseId(
        "T3R",
        judged.map((one) => one.row),
      ),
      key: 0,
      rows: judged,
    };
  });
}

/** The rubric (plan 077, "Task 3 has no answer key"). */
export const RUBRIC_INSTRUCTIONS = `You check translations of English sentences into Enochian, the language of the nineteen Keys (Calls) that John Dee and Edward Kelley recorded. Our dictionary and our notes on Enochian grammar follow these instructions.

Each translation comes with its English, the Enochian, and its basis word by word: each Enochian word, the English it renders, how the translator says it knows the word ("attested": the reference material gives it with this meaning, at "ref"; "derived": worked out from words the material gives; "coined": the translator's own; "unknown"), the ref it cites, and for a cited Key row, that row.

Accept a translation only if all of these hold:
1. Words exist with the meaning used: every word marked attested is in the dictionary, or the cited Key row, with the meaning it is used for.
2. Inventions are marked: no word the material doesn't give is passed off as attested; such words are marked derived or coined.
3. The forms follow the grammar notes.
4. The meaning is preserved: the Enochian says what the English says, with nothing important left out, added or changed.
Otherwise reject it. Judge each translation on its own.

Work through them as you need to, then end your reply with one fenced code block marked json, holding an object with one field, "verdicts": a list with one entry per translation, each {"row": its id, "verdict": "accept" or "reject", "reason": a short phrase}. Write nothing after the block.`;

/** The round-trip comparison (plan 077, "Scoring"). */
export const ROUND_TRIP_JUDGE_INSTRUCTIONS = `You compare pairs of English sentences. In each pair, "original" was translated into Enochian, and "round trip" is that Enochian translated back into English by someone who never saw the original and had only a dictionary.

Decide whether the round trip keeps the original's meaning: "same" if a reader would take the same meaning from both, allowing for other wording, other word order, missing articles and stilted phrasing; "different" if something that matters is lost, added or changed. Words left in capitals are Enochian the dictionary didn't give.

Judge each pair on its own. Work through them as you need to, then end your reply with one fenced code block marked json, holding an object with one field, "verdicts": a list with one entry per pair, each {"row": its id, "verdict": "same" or "different", "reason": a short phrase}. Write nothing after the block.`;

/** What a rubric judge's request carries besides its case. */
export interface RubricContext {
  /** The dictionary without the planted knowns. */
  dictionary: EnochianDictionary;
  grammar: string;
}

/**
 * A judge's rubric request: the rubric, our dictionary and the grammar notes
 * (rule 3 needs them), each a system message, the same in every request, so
 * they cache; the case's candidates as JSON, by blind id only.
 */
export function rubricRequest(
  context: RubricContext,
): (item: JudgeCase, judge: JudgeName, id?: string) => ModelRequest {
  const dictionary = roundTripContext(context.dictionary);
  const grammar = `${GRAMMAR_HEAD}\n\n${context.grammar.trim()}`;
  return (item, judge, id = `${item.answer}_judge-${judge}`) => ({
    id,
    kind: "judge",
    model: JUDGES[judge].model,
    effort: JUDGES[judge].effort,
    instructions: [RUBRIC_INSTRUCTIONS, dictionary, grammar],
    prompt: `The translations, as JSON:\n\n${JSON.stringify(
      item.rows.map((one) => ({
        row: one.row,
        english: one.dee,
        enochian: one.answer,
        words: one.words ?? [],
      })),
      null,
      1,
    )}`,
  });
}

export function roundTripJudgeRequest(
  item: JudgeCase,
  judge: JudgeName,
  id = `${item.answer}_judge-${judge}`,
): ModelRequest {
  return {
    id,
    kind: "judge",
    model: JUDGES[judge].model,
    effort: JUDGES[judge].effort,
    instructions: [ROUND_TRIP_JUDGE_INSTRUCTIONS],
    prompt: `The pairs, as JSON:\n\n${JSON.stringify(
      item.rows.map((one) => ({
        row: one.row,
        original: one.dee,
        "round trip": one.answer,
      })),
      null,
      1,
    )}`,
  };
}

const rubricSchema = z.object({
  verdicts: z.array(
    z.object({
      row: z.string(),
      verdict: z.enum(["accept", "reject"]),
      reason: z
        .string()
        .nullish()
        .transform((one) => one ?? ""),
    }),
  ),
});

/** A rubric judge's verdicts, "accept" as "same" and "reject" as "different". */
export function parseRubricVerdicts(text: string): {
  verdicts: Map<string, Verdict>;
  error?: string;
} {
  const parsed = parseReply(text, rubricSchema);
  if (!parsed.ok) return { verdicts: new Map(), error: parsed.error };
  return {
    verdicts: new Map(
      parsed.value.verdicts.map((one) => [
        one.row,
        {
          verdict: one.verdict === "accept" ? "same" : "different",
          reason: one.reason,
        },
      ]),
    ),
  };
}

/** The round-trip judges answer "same" or "different", as task 1's. */
export const parseRoundTripVerdicts = parseVerdicts;

// --- Round trips ------------------------------------------------------------------

/** Round trips done, by `roundTripKey` (`<out>/task3/roundtrips.json`). */
export type RoundTripStore = Record<string, { english: string; run: string }>;

/** A candidate's round-trip key: its id and its translation, hashed. */
export function roundTripKey(one: Task3Candidate): string {
  return `${one.id}:${createHash("sha256")
    .update(translationText(one.items))
    .digest("hex")
    .slice(0, 12)}`;
}

/**
 * The round-trip requests for candidates not yet round-tripped, in parts of
 * `size`, in blind-id order. Damaged controls have none: no figure uses
 * them, and the rubric's judges never see round trips.
 */
export function roundTripSpecs(
  candidates: readonly Task3Candidate[],
  store: RoundTripStore,
  model: string,
  effort: RoundTripSpec["effort"],
  size = 20,
): RoundTripSpec[] {
  const need = candidates
    .filter(
      (one) =>
        !one.damage &&
        !one.missing &&
        one.items.length &&
        !store[roundTripKey(one)],
    )
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const out: RoundTripSpec[] = [];
  for (let i = 0; i < need.length; i += size)
    out.push({
      part: out.length + 1,
      input: need.slice(i, i + size).map((one) => ({
        id: one.id,
        enochian: translationText(one.items),
      })),
      model,
      effort,
    });
  return out;
}

const roundTripSchema = z.object({
  sentences: z.array(z.object({ id: z.string(), english: z.string() })),
});

/** A round trip's English by candidate id; an unreadable reply gives none. */
export function parseRoundTrip(text: string): {
  english: Map<string, string>;
  error?: string;
} {
  const parsed = parseReply(text, roundTripSchema);
  if (!parsed.ok) return { english: new Map(), error: parsed.error };
  return {
    english: new Map(
      parsed.value.sentences.map((one) => [one.id, one.english]),
    ),
  };
}

/** The round trips in a store for some candidates, by candidate id. */
export function roundTripsFor(
  candidates: readonly Task3Candidate[],
  store: RoundTripStore,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const one of candidates) {
    const done = store[roundTripKey(one)];
    if (done) out.set(one.id, done.english);
  }
  return out;
}

// --- Figures ----------------------------------------------------------------------

/** Every judged row of some cases, by row id, for the translation judged. */
export function flatJudged(
  judged: Record<string, JudgedRows>,
): Map<string, JudgedRow> {
  const out = new Map<string, JudgedRow>();
  for (const rows of Object.values(judged))
    for (const [row, one] of Object.entries(rows))
      if (one.outcome || !out.has(row)) out.set(row, one);
  return out;
}

/** One source's figures on task 3. */
export interface Task3Figures {
  /** Every task-3 sentence: a missing translation counts as wrong. */
  sentences: number;
  /** Both judges accept it by the rubric. */
  accepted: Share;
  /** Both judges find the round trip keeps the meaning. */
  roundTrip: Share;
  /**
   * Content words given an attested form (checked, not an invention), of
   * those our data has a form for (A1 finds one).
   */
  attestedForms: Share;
  /** Candidates still waiting for a rubric verdict from both judges. */
  waiting: number;
  roundTripWaiting: number;
  /** Sentences with no translation (failed or blocked call). */
  missing: number;
  /** Attested items the checker finds invented, and all items. */
  silentInventions: number;
  items: number;
  /** Rubric verdicts the two judges agreed on. */
  agreed: number;
  /** Rubric verdicts they split on. */
  split: number;
}

/**
 * The content words of each sentence our data has a form for: those A1's
 * lookup gives as attested, by sentence, stemmed.
 */
export function wordsWithForms(
  a1: ReadonlyMap<string, readonly AnswerItem[]>,
): Map<string, Set<string>> {
  return new Map(
    [...a1].map(([sentence, items]) => [
      sentence,
      new Set(
        items
          .filter(
            (one) =>
              one.basis === "attested" &&
              !FUNCTION_WORDS.has(one.source.toLowerCase()),
          )
          .map((one) => stemEnglish(one.source.toLowerCase())),
      ),
    ]),
  );
}

/**
 * The share of content words given an attested form where our data has
 * one: a word counts when an item whose English includes it is marked
 * attested and passes the checker's first two checks (not an invention).
 */
export function attestedFormCount(
  one: Task3Candidate,
  withForms: ReadonlySet<string>,
  context: CheckContext,
): number {
  const covered = new Set<string>();
  for (const item of one.items) {
    if (item.basis !== "attested") continue;
    const check = checkItem(item, 2, context);
    if (check === "invention" || check === "malformed ref") continue;
    for (const word of englishWords(item.source))
      if (withForms.has(stemEnglish(word))) covered.add(stemEnglish(word));
  }
  return covered.size;
}

export function task3Figures(
  candidates: readonly Task3Candidate[],
  sentences: readonly Task3Sentence[],
  judged: {
    rubric: ReadonlyMap<string, JudgedRow>;
    roundTrip: ReadonlyMap<string, JudgedRow>;
    /** Each candidate's round trip, by id, to match its verdict. */
    roundTrips: ReadonlyMap<string, string>;
  },
  withForms: ReadonlyMap<string, ReadonlySet<string>>,
  context: CheckContext,
): Task3Figures {
  let accepted = 0;
  let kept = 0;
  let waiting = 0;
  let roundTripWaiting = 0;
  let missing = 0;
  let covered = 0;
  let inventions = 0;
  let items = 0;
  let agreed = 0;
  let split = 0;
  const bySentence = new Map(candidates.map((one) => [one.sentence, one]));
  const formsTotal = sentences.reduce(
    (sum, one) => sum + (withForms.get(one.id)?.size ?? 0),
    0,
  );
  for (const sentence of sentences) {
    const one = bySentence.get(sentence.id);
    if (!one || one.missing || !one.items.length) {
      missing++;
      continue;
    }
    const text = translationText(one.items);
    const rubric = judged.rubric.get(one.id);
    if (rubric && sameAnswer(rubric, text) && rubric.outcome) {
      if (rubric.outcome === "correct") accepted++;
      if (rubric.outcome === "split") split++;
      else agreed++;
    } else waiting++;
    const back = judged.roundTrips.get(one.id);
    const trip = judged.roundTrip.get(roundTripRow(one.id));
    if (back !== undefined && trip && sameAnswer(trip, back) && trip.outcome) {
      if (trip.outcome === "correct") kept++;
    } else roundTripWaiting++;
    covered += attestedFormCount(
      one,
      withForms.get(sentence.id) ?? new Set(),
      context,
    );
    for (const item of one.items) {
      items++;
      if (
        item.basis === "attested" &&
        checkItem(item, 2, context) === "invention"
      )
        inventions++;
    }
  }
  return {
    sentences: sentences.length,
    accepted: share(accepted, sentences.length),
    roundTrip: share(kept, sentences.length),
    attestedForms: share(covered, formsTotal),
    waiting,
    roundTripWaiting,
    missing,
    silentInventions: inventions,
    items,
    agreed,
    split,
  };
}

/**
 * The share of counted controls the judges may accept: plan 077's "more
 * than 3" of 15, scaled to the number counted.
 */
export const MAX_CONTROLS_ACCEPTED_SHARE = 3 / 15;

/** The fewest counted controls (original accepted) the check needs. */
export const MIN_CONTROLS_COUNTED = 8;

/** Task 3's report: each source's figures, and the controls. */
export interface Task3Report {
  sources: Record<string, Task3Figures>;
  controls: {
    count: number;
    /**
     * Controls that count: both judges accepted the A1 translation each was
     * made from, and both have ruled on the control.
     */
    counted: number;
    /** Counted controls both judges accepted. */
    accepted: number;
    /** Controls whose original the judges didn't both accept. */
    originalNotAccepted: number;
    /** Controls, or their originals, still waiting for a ruling. */
    waiting: number;
    byDamage: Record<
      string,
      { count: number; counted: number; accepted: number }
    >;
    /**
     * Why the task-3 bars can't be measured, if they can't: fewer than 8
     * controls counted, or more than a fifth of those accepted.
     */
    unmeasurable?: string;
  };
}

/** Every source's figures, and how the judges did on the controls. */
export function task3Report(input: {
  candidates: readonly Task3Candidate[];
  sentences: readonly Task3Sentence[];
  rubric: ReadonlyMap<string, JudgedRow>;
  roundTrip: ReadonlyMap<string, JudgedRow>;
  roundTrips: ReadonlyMap<string, string>;
  a1: ReadonlyMap<string, readonly AnswerItem[]>;
  dictionary: EnochianDictionary;
  keyRows: readonly KeyRowRecord[];
}): Task3Report {
  const context = checkContextFrom(input.dictionary, input.keyRows);
  const withForms = wordsWithForms(input.a1);
  const sources = new Map<string, Task3Candidate[]>();
  const controls = input.candidates.filter((one) => one.damage);
  for (const one of input.candidates)
    if (!one.damage)
      sources.set(one.source, [...(sources.get(one.source) ?? []), one]);
  const byDamage: Record<
    string,
    { count: number; counted: number; accepted: number }
  > = {};
  const byId = new Map(input.candidates.map((one) => [one.id, one]));
  const outcome = (one: Task3Candidate | undefined) => {
    const verdict = one && input.rubric.get(one.id);
    return verdict && sameAnswer(verdict, translationText(one.items))
      ? verdict.outcome
      : undefined;
  };
  let accepted = 0;
  let counted = 0;
  let waiting = 0;
  let originalNotAccepted = 0;
  for (const one of controls) {
    const row = (byDamage[one.damage as Damage] ??= {
      count: 0,
      counted: 0,
      accepted: 0,
    });
    row.count++;
    const mine = outcome(one);
    const original = outcome(one.of ? byId.get(one.of) : undefined);
    if (!mine || !original) waiting++;
    else if (original !== "correct") originalNotAccepted++;
    else {
      counted++;
      row.counted++;
      if (mine === "correct") {
        accepted++;
        row.accepted++;
      }
    }
  }
  const unmeasurable = waiting
    ? undefined
    : counted < MIN_CONTROLS_COUNTED
      ? `only ${counted} damaged controls count (their originals accepted); ${MIN_CONTROLS_COUNTED} are needed`
      : accepted > counted * MAX_CONTROLS_ACCEPTED_SHARE + 1e-9
        ? `the judges accepted ${accepted} of ${counted} damaged controls, more than a fifth`
        : undefined;
  return {
    sources: Object.fromEntries(
      [...sources].map(([source, list]) => [
        source,
        task3Figures(list, input.sentences, input, withForms, context),
      ]),
    ),
    controls: {
      count: controls.length,
      counted,
      accepted,
      originalNotAccepted,
      waiting,
      byDamage,
      ...(unmeasurable ? { unmeasurable } : {}),
    },
  };
}
