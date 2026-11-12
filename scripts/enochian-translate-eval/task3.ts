import { createHash } from "node:crypto";
import type { EnochianDictionary } from "magick-data/enochian/dictionary";
import { z } from "zod";
import {
  JUDGES_CHECK,
  judgesPass,
} from "../../src/app/enochian/translate/bars.ts";
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
  type NewTextRow,
  type NewTextSentence,
  type NewTextSet,
  plantContext,
  plantRule,
  prng,
  shuffle,
} from "./newtext.ts";
import {
  contentStems,
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
 * (word-by-word lookup) and from the judges' check: 15 passages of Dee's
 * own Enochian from the new text, and a damaged copy of each. Both judges
 * score every candidate blind against the plan's rubric, and compare its
 * round trip (the Enochian put back into English by a separate call that
 * sees only the dictionary) with the English. The judges never see where a
 * candidate came from: its id is a hash, and the candidates are shuffled
 * into cases by seed.
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
   * Where it came from, never shown: "A1", "control-original",
   * "control-N", or a run's group ("<run>:A3 opus medium").
   */
  source: string;
  sentence: string;
  english: string;
  items: AnswerItem[];
  /** A damaged control: what was done to its original. */
  damage?: Damage;
  /** A damaged control: the id of the original it was made from. */
  of?: string;
  /**
   * The undamaged original of a damaged control: Dee's own Enochian, judged
   * like any translation, but no source's figure and never round-tripped.
   */
  original?: true;
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

/** Whether a candidate is part of the judges' check: a control or its original. */
export const isCheck = (one: Task3Candidate) =>
  Boolean(one.damage || one.original);

export function candidate(
  source: string,
  sentence: Task3Sentence,
  items: readonly AnswerItem[],
  extra: Pick<Task3Candidate, "damage" | "missing" | "of" | "original"> = {},
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

/** How many damaged controls: the settled check's (`JUDGES_CHECK`). */
export const CONTROLS = JUDGES_CHECK.controls;

/** The controls' seed: the plan's number, as the new text's. */
export const CONTROL_SEED = 77;

/** The source name of the controls' undamaged originals. */
export const ORIGINAL_SOURCE = "control-original";

/** A run of the new text's rows a control is made from. */
export interface ControlUnit {
  /**
   * Its passages, as "sentence/passage", joined by " + ":
   * "S26/19.107–19.111 + S22/10.38–10.43".
   */
  id: string;
  /** The rows' English, as the new text gives it, joined as it joins them. */
  english: string;
  rows: NewTextRow[];
}

/** Rows that are Dee's own words in Casaubon's spelling: no change but swaps. */
const deeOnly = (rows: readonly NewTextRow[]) =>
  rows.length > 0 &&
  rows.every(
    (row) =>
      (row.kind === "unchanged" || row.kind === "swapped") && !row.gdSpelling,
  );

/** A passage's rows: those whose place ("K.R") falls in its "K.R–K.R". */
function passageRows(sentence: NewTextSentence, passage: string) {
  const [from, to] = passage
    .split("–")
    .map((one) => one.split(".").map(Number));
  return sentence.rows.filter((row) => {
    const [key, at] = row.at.split(".").map(Number);
    return key === from[0] && at >= from[1] && at <= to[1];
  });
}

const unitOf = (id: string, rows: NewTextRow[]): ControlUnit => ({
  id,
  english: rows.map((row) => row.english).join(" "),
  rows,
});

/** The new text's passages whose rows are all Dee's own (`deeOnly`). */
export function controlPassages(
  set: Pick<NewTextSet, "sentences">,
): ControlUnit[] {
  return set.sentences.flatMap((one) =>
    one.passages.flatMap((passage) => {
      const rows = passageRows(one, passage);
      return deeOnly(rows) ? [unitOf(`${one.id}/${passage}`, rows)] : [];
    }),
  );
}

/** The Key a passage comes from. */
const keyOf = (unit: ControlUnit) => unit.rows[0]?.at.split(".")[0];

/**
 * What the controls are made from: the new text's passages whose rows are
 * all unchanged or swapped, none in the Golden Dawn's spelling, paired by
 * seed into units the way the new text makes its sentences: two passages
 * from different Keys, the first's rows then the second's, their English
 * joined with a space. No passage is used twice; one left without a
 * partner from another Key is left out. Each pair takes a passage of the
 * Key with most passages left, so as few as possible are left out.
 */
export function controlUnits(
  set: Pick<NewTextSet, "sentences">,
  random = prng(CONTROL_SEED),
): { passages: number; units: ControlUnit[] } {
  const passages = controlPassages(set);
  const left = shuffle(
    [...passages].sort((a, b) => (a.id < b.id ? -1 : 1)),
    random,
  );
  const units: ControlUnit[] = [];
  // Each time, the next passage of the Key with most passages left, with
  // the next one from another Key: so few as possible are left unpaired.
  const count = (key: string | undefined) =>
    left.filter((one) => keyOf(one) === key).length;
  for (;;) {
    const most = Math.max(0, ...left.map((one) => count(keyOf(one))));
    const first = left.find((one) => count(keyOf(one)) === most);
    const second = first && left.find((one) => keyOf(one) !== keyOf(first));
    if (!first || !second) break;
    left.splice(left.indexOf(first), 1);
    left.splice(left.indexOf(second), 1);
    units.push(
      unitOf(`${first.id} + ${second.id}`, [...first.rows, ...second.rows]),
    );
  }
  return { passages: passages.length, units };
}

/**
 * A unit's Enochian as a translator would give it: each row's word, its
 * English, attested, citing the Key row the word comes from.
 */
export function originalItems(unit: ControlUnit): AnswerItem[] {
  return unit.rows.map((row) => ({
    source: row.english,
    target: row.enochian,
    basis: "attested",
    ref: row.source ?? row.at,
  }));
}

/** Clause-ending punctuation at the end of a row's English. */
const CLAUSE_END = /[,;:.?]\s*$/;

/** The fewest rows a dropped clause leaves out, and the fewest it keeps. */
export const DROP_AT_LEAST = 2;
export const KEEP_AT_LEAST = 3;

/**
 * The items a dropped clause leaves: those up to the last row that ends a
 * clause, keeping at least three and leaving out at least two; failing
 * that, the first three fifths, leaving out at least two. None if that
 * would keep fewer than three.
 */
export function dropClause(
  items: readonly AnswerItem[],
): AnswerItem[] | undefined {
  let keep = -1;
  for (let i = items.length - DROP_AT_LEAST - 1; i >= KEEP_AT_LEAST - 1; i--)
    if (CLAUSE_END.test(items[i].source)) {
      keep = i + 1;
      break;
    }
  if (keep < 0)
    keep = Math.min(
      Math.ceil(items.length * 0.6),
      items.length - DROP_AT_LEAST,
    );
  return keep >= KEEP_AT_LEAST ? items.slice(0, keep) : undefined;
}

/** Whether an item's English has a word that carries meaning. */
const hasContent = (item: AnswerItem) => contentStems(item.source).length > 0;

/**
 * The judges' check (plan 077, "The judges are checked"): `count` units of
 * Dee's own Enochian from the new text, each two passages from different
 * Keys (`controlUnits`), chosen by seed, each as an undamaged original and
 * a damaged copy, a third of each kind as the units allow (each says
 * which, in `damage`):
 * - "wrong word": a word with some meaning swapped for another headword
 *   whose meanings share nothing with its English;
 * - "coinage": a word with some meaning swapped for a made-up one (by the
 *   planted words' rule);
 * - "dropped clause": the rows after the last clause end that keeps three
 *   rows and leaves two out; failing such an end, all but the first three
 *   fifths, two at least (`dropClause`).
 * A swapped word keeps its row's English, its "attested" and its Key-row
 * ref, so the judges see it beside the row it misquotes, as a model's slip
 * would look; nothing in its form sets it apart from the other words.
 * The originals are right by construction, but the judges rule on them
 * too: a control counts only if both accept its original (`task3Report`).
 */
export function damagedControls(
  set: Pick<NewTextSet, "sentences">,
  data: { dictionary: EnochianDictionary; rows: readonly KeyRowRecord[] },
  seed = CONTROL_SEED,
  count = CONTROLS,
): {
  /** How many passages qualified. */
  passages: number;
  /** How many units (pairs of passages) they made. */
  units: number;
  originals: Task3Candidate[];
  controls: Task3Candidate[];
} {
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
  // Paired in an order the seed shuffles: the units come out shuffled.
  const { passages, units: order } = controlUnits(set, random);
  const each = Math.ceil(count / DAMAGES.length);
  const made = new Map<Damage, number>(DAMAGES.map((one) => [one, 0]));
  const originals: Task3Candidate[] = [];
  const controls: Task3Candidate[] = [];
  for (const one of order) {
    if (controls.length >= count) break;
    const items = originalItems(one);
    const kept = dropClause(items);
    const meaningful = items.filter(hasContent);
    // The kind with fewest made so far that this unit allows.
    const damage = [...DAMAGES]
      .filter((kind) => (made.get(kind) ?? 0) < each)
      .sort((a, b) => (made.get(a) ?? 0) - (made.get(b) ?? 0))
      .find((kind) =>
        kind === "dropped clause" ? Boolean(kept) : meaningful.length > 0,
      );
    if (!damage) continue;
    let damaged = items.map((item) => ({ ...item }));
    if (damage === "dropped clause")
      damaged = (kept ?? []).map((item) => ({ ...item }));
    else {
      const at = items.indexOf(
        meaningful[Math.floor(random() * meaningful.length)],
      );
      const target = damaged[at];
      if (damage === "coinage") target.target = coin();
      else {
        const others = headwords.filter(
          (word) =>
            normEnochian(word) !== normEnochian(target.target) &&
            data.dictionary[word].meanings.length > 0 &&
            !data.dictionary[word].meanings.some(({ meaning }) =>
              sharesContentWord(meaning, target.source),
            ),
        );
        target.target = others[Math.floor(random() * others.length)];
      }
    }
    made.set(damage, (made.get(damage) ?? 0) + 1);
    const sentence = { id: one.id, kind: "control", english: one.english };
    const original = candidate(ORIGINAL_SOURCE, sentence, items, {
      original: true,
    });
    originals.push(original);
    controls.push(
      candidate(`control-${controls.length + 1}`, sentence, damaged, {
        damage,
        of: original.id,
      }),
    );
  }
  return { passages, units: order.length, originals, controls };
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
 * where a candidate came from, and a control never sits beside the
 * original it was made from. A candidate whose sentence is in every case
 * so far starts a case of its own (a small round: a retry, say).
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
    if (open[0]) open[0].push(one);
    else cases.push([one]);
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

/** A candidate as the rubric's judges see it. */
export function rubricRow(
  one: Task3Candidate,
  keyRows: ReadonlyMap<string, KeyRowRecord>,
): JudgeRow {
  const text = translationText(one.items);
  const words = wordsOf(one.items, keyRows);
  return {
    row: one.id,
    enochian: text,
    dee: one.english,
    answer: text,
    meanings: [],
    words,
    question: JSON.stringify(["task3-rubric", one.english, words]),
  };
}

/**
 * The rubric's cases: every candidate with a translation, blind; less those
 * `done` says both judges have ruled on (in the verdict store), so a new
 * round deals only what is new into its cases.
 */
export function rubricCases(
  candidates: readonly Task3Candidate[],
  keyRows: readonly KeyRowRecord[],
  seed = CONTROL_SEED,
  done: (row: JudgeRow) => boolean = () => false,
): JudgeCase[] {
  const rows = new Map(keyRows.map((row) => [row.id, row]));
  const rowOf = new Map(
    candidates
      .filter((one) => !one.missing && one.items.length)
      .map((one) => [one.id, rubricRow(one, rows)] as const)
      .filter(([, row]) => !done(row)),
  );
  const ready = candidates.filter((one) => rowOf.has(one.id));
  return dealCases(ready, RUBRIC_CASE, seed).map((list) => {
    const judged = list.map((one) => rowOf.get(one.id) as JudgeRow);
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
export type RoundTripStore = Record<
  string,
  {
    english: string;
    run: string;
    /**
     * Blocked by the provider's filter twice (the call and its one
     * retry): no English, never asked again, and it counts as not keeping
     * the meaning (plan 077, "Blocked replies").
     */
    blocked?: true;
  }
>;

/** A candidate's round-trip key: its id and its translation, hashed. */
export function roundTripKey(one: Task3Candidate): string {
  return `${one.id}:${createHash("sha256")
    .update(translationText(one.items))
    .digest("hex")
    .slice(0, 12)}`;
}

/**
 * The round-trip requests for candidates not yet round-tripped, in parts of
 * `size`, each part of one source only, in blind-id order within it (the
 * sources in name order, the parts numbered on across them). A part
 * blocked twice counts every candidate in it as not keeping the meaning,
 * so one source's text must never cost another's. The judges' check
 * (controls and their originals) has none: no figure uses them, and the
 * rubric's judges never see round trips.
 */
export function roundTripSpecs(
  candidates: readonly Task3Candidate[],
  store: RoundTripStore,
  model: string,
  effort: RoundTripSpec["effort"],
  size = 20,
): RoundTripSpec[] {
  const bySource = new Map<string, Task3Candidate[]>();
  for (const one of candidates)
    if (
      !isCheck(one) &&
      !one.missing &&
      one.items.length &&
      !store[roundTripKey(one)]
    )
      bySource.set(one.source, [...(bySource.get(one.source) ?? []), one]);
  const out: RoundTripSpec[] = [];
  for (const source of [...bySource.keys()].sort()) {
    const need = (bySource.get(source) ?? []).sort((a, b) =>
      a.id < b.id ? -1 : 1,
    );
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
  }
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
    if (done && !done.blocked) out.set(one.id, done.english);
  }
  return out;
}

/** The candidates whose round trip was blocked twice, by id. */
export function blockedRoundTrips(
  candidates: readonly Task3Candidate[],
  store: RoundTripStore,
): Set<string> {
  return new Set(
    candidates
      .filter((one) => store[roundTripKey(one)]?.blocked)
      .map((one) => one.id),
  );
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

/** One source's figures on one kind of task-3 sentence. */
export interface Task3GroupFigures {
  sentences: number;
  /** Both judges accept it by the rubric. */
  accepted: Share;
  /** Both judges find the round trip keeps the meaning. */
  roundTrip: Share;
  /** Candidates still waiting for a rubric verdict from both judges. */
  waiting: number;
  roundTripWaiting: number;
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
  /**
   * The same by kind of sentence ("practitioner", "everyday", "attested"),
   * in the order the sentences give them.
   */
  byKind: Record<string, Task3GroupFigures>;
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

/** One kind of sentence's counts, as `task3Figures` adds them up. */
interface KindTally {
  sentences: number;
  accepted: number;
  kept: number;
  waiting: number;
  roundTripWaiting: number;
}

export function task3Figures(
  candidates: readonly Task3Candidate[],
  sentences: readonly Task3Sentence[],
  judged: {
    rubric: ReadonlyMap<string, JudgedRow>;
    roundTrip: ReadonlyMap<string, JudgedRow>;
    /** Each candidate's round trip, by id, to match its verdict. */
    roundTrips: ReadonlyMap<string, string>;
    /** Candidates whose round trip was blocked twice: not kept. */
    blockedTrips?: ReadonlySet<string>;
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
  const kinds = new Map<string, KindTally>();
  for (const sentence of sentences)
    if (!kinds.has(sentence.kind))
      kinds.set(sentence.kind, {
        sentences: 0,
        accepted: 0,
        kept: 0,
        waiting: 0,
        roundTripWaiting: 0,
      });
  const formsTotal = sentences.reduce(
    (sum, one) => sum + (withForms.get(one.id)?.size ?? 0),
    0,
  );
  for (const sentence of sentences) {
    const group = kinds.get(sentence.kind) as KindTally;
    group.sentences++;
    const one = bySentence.get(sentence.id);
    if (!one || one.missing || !one.items.length) {
      missing++;
      continue;
    }
    const text = translationText(one.items);
    const rubric = judged.rubric.get(one.id);
    if (rubric && sameAnswer(rubric, text) && rubric.outcome) {
      if (rubric.outcome === "correct") {
        accepted++;
        group.accepted++;
      }
      if (rubric.outcome === "split") split++;
      else agreed++;
    } else {
      waiting++;
      group.waiting++;
    }
    const back = judged.roundTrips.get(one.id);
    const trip = judged.roundTrip.get(roundTripRow(one.id));
    // Blocked twice, it is ruled: a round trip that didn't keep the meaning.
    const blocked = judged.blockedTrips?.has(one.id) ?? false;
    const ruled =
      blocked ||
      (back !== undefined && trip && sameAnswer(trip, back) && trip.outcome);
    if (!ruled) {
      roundTripWaiting++;
      group.roundTripWaiting++;
    } else if (!blocked && trip?.outcome === "correct") {
      kept++;
      group.kept++;
    }
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
    byKind: Object.fromEntries(
      [...kinds].map(([kind, one]) => [
        kind,
        {
          sentences: one.sentences,
          accepted: share(one.accepted, one.sentences),
          roundTrip: share(one.kept, one.sentences),
          waiting: one.waiting,
          roundTripWaiting: one.roundTripWaiting,
        },
      ]),
    ),
  };
}

/** Task 3's report: each source's figures, and the controls. */
export interface Task3Report {
  sources: Record<string, Task3Figures>;
  controls: {
    count: number;
    /** Undamaged originals, judged like the rest. */
    originals: number;
    /**
     * Controls that count: both judges accepted the original each was made
     * from, and both have ruled on the control.
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
  blockedTrips?: ReadonlySet<string>;
  a1: ReadonlyMap<string, readonly AnswerItem[]>;
  dictionary: EnochianDictionary;
  keyRows: readonly KeyRowRecord[];
}): Task3Report {
  const context = checkContextFrom(input.dictionary, input.keyRows);
  const withForms = wordsWithForms(input.a1);
  const sources = new Map<string, Task3Candidate[]>();
  const controls = input.candidates.filter((one) => one.damage);
  for (const one of input.candidates)
    if (!isCheck(one))
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
  const unmeasurable =
    waiting || judgesPass(counted, accepted)
      ? undefined
      : counted < JUDGES_CHECK.minCounted
        ? `only ${counted} damaged controls count (their originals accepted); ${JUDGES_CHECK.minCounted} are needed`
        : `the judges accepted ${accepted} of ${counted} damaged controls, more than a fifth`;
  return {
    sources: Object.fromEntries(
      [...sources].map(([source, list]) => [
        source,
        task3Figures(list, input.sentences, input, withForms, context),
      ]),
    ),
    controls: {
      count: controls.length,
      originals: input.candidates.filter((one) => one.original).length,
      counted,
      accepted,
      originalNotAccepted,
      waiting,
      byDamage,
      ...(unmeasurable ? { unmeasurable } : {}),
    },
  };
}
