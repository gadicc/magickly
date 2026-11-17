import { join } from "node:path";
import { buildKeysTable } from "../../src/app/enochian/translate/keysTable.ts";
import {
  createTranslator,
  type Translator,
} from "../../src/app/enochian/translate/lookup.ts";
import {
  parseAnswer,
  parseSentence,
} from "../../src/app/enochian/translate/reading/reply.ts";
import {
  englishLength,
  lookupGlosses,
  type SentenceVerdict,
  sentenceEvidence,
  sentenceRule,
} from "../../src/app/enochian/translate/reading/sentence.ts";
import { type NewSpec, partRows, tasks12Dictionary } from "./newprompt.ts";
import type { NewTextRow } from "./newtext.ts";
import {
  type EvalData,
  failedRaw,
  type Manifest,
  type ReplyRouting,
  readRaw,
  writeJson,
} from "./runner.ts";

/**
 * Plan 081's step 2B: what the reading's prompt (arm A3s) costs and gives,
 * measured offline from a run's saved replies, beside the bars. Per call:
 * the share of its input read from the cache, its output tokens (reasoning
 * and the sentence included) per input word, its sentence's length against
 * the input's, what S7's rule decides for the sentence, and the routing the
 * gateway reported. Written to `runs/<run>/reading-measures.json`.
 */

/** One A3s call, measured. */
export interface CallMeasure {
  id: string;
  part: number;
  /** When its reply was saved. */
  at: string;
  /** The passage's words (task 1's rows). */
  words: number;
  /** A reply that came back and finished normally. */
  ok: boolean;
  input: number;
  cached: number;
  output: number;
  reasoning: number;
  /** `cached / input`, 0 with no input. */
  cacheReadShare: number;
  /** `output / words`, reasoning and the sentence included. */
  outputPerWord: number;
  /** The sentence's English words; 0 with none. */
  sentenceWords: number;
  /** `sentenceWords / words`. */
  sentenceRatio: number;
  /** S7's rule on the sentence. */
  rule: SentenceVerdict;
  /** What the call asked and the gateway reported. */
  routing?: ReplyRouting;
}

/** A run's A3s calls, measured, and pooled. */
export interface ReadingMeasures {
  run: string;
  calls: CallMeasure[];
  summary: ReadingSummary;
}

export interface ReadingSummary {
  calls: number;
  /** Calls whose reply came back and finished normally. */
  ok: number;
  cache: {
    /**
     * The first call's share read from the cache (the cold one, or not),
     * of the calls with input reported: one with no reply is left out.
     */
    first?: number;
    /** Every later such call's share, lowest and mean. */
    laterMin?: number;
    laterMean?: number;
    /** All the calls' input read from the cache, as a share of all input. */
    pooled: number;
  };
  output: {
    /** All output tokens over all the passages' words. */
    perWord: number;
    /**
     * The most any one call wrote a word: what S5's output cap must allow.
     * Taken over every call, a reply cut off at its output limit included,
     * since that is the call the cap stopped.
     */
    maxPerWord: number;
    /** The reasoning part, over all the words. */
    reasoningPerWord: number;
  };
  sentence: {
    /** Replies with a sentence, of `ok`. */
    given: number;
    /** Sentence words over input words, pooled. */
    ratio: number;
    /** The longest sentence against its input. */
    maxRatio: number;
  };
  /** S7's rule over the calls that came back: shown, and withheld by why. */
  rule: {
    shown: number;
    withheld: number;
    byReason: Record<string, number>;
  };
  /** The gateway's routing over the calls that came back. */
  routing: {
    asked: number;
    zeroRetention: number;
    providers: Record<string, number>;
    failures: string[];
  };
}

/** The translator the rule's glosses come from: the prompt's dictionary. */
export function readingTranslator(data: EvalData): Translator {
  return createTranslator(buildKeysTable(), tasks12Dictionary(data));
}

/** A passage as the page would take it: its words, a space between. */
export const passageText = (rows: readonly NewTextRow[]) =>
  rows.map((one) => one.enochian).join(" ");

const ratio = (a: number, b: number) => (b ? a / b : 0);

/** One A3s request of a run, measured from its saved reply. */
export function measureCall(
  dir: string,
  id: string,
  spec: NewSpec,
  data: EvalData,
  translator: Translator,
): CallMeasure | undefined {
  const raw = readRaw(dir, id);
  if (!raw || !data.newText) return undefined;
  const rows = partRows(data.newText, spec.sentences);
  const ok = !failedRaw(raw);
  const parsed = ok ? parseAnswer(raw.text) : undefined;
  const items = parsed?.ok ? parsed.value : [];
  const sentence = ok ? parseSentence(raw.text) : undefined;
  const sentenceWords = sentence ? englishLength(sentence) : 0;
  const t = raw.tokens;
  return {
    id,
    part: spec.part,
    at: raw.at,
    words: rows.length,
    ok,
    input: t.input,
    cached: t.cached,
    output: t.output,
    reasoning: t.reasoning,
    cacheReadShare: ratio(t.cached, t.input),
    outputPerWord: ratio(t.output, rows.length),
    sentenceWords,
    sentenceRatio: ratio(sentenceWords, rows.length),
    rule: sentenceRule(
      sentence,
      sentenceEvidence(items, lookupGlosses(translator, passageText(rows))),
    ),
    ...(raw.routing ? { routing: raw.routing } : {}),
  };
}

/** Pools a run's measured calls (`ReadingSummary`). */
export function summariseReading(calls: readonly CallMeasure[]) {
  const done = calls.filter((one) => one.ok);
  const sum = (list: readonly CallMeasure[], f: (one: CallMeasure) => number) =>
    list.reduce((total, one) => total + f(one), 0);
  // A failed call with no reply read nothing and says nothing of the cache.
  const replied = calls.filter((one) => one.input > 0);
  const later = replied.slice(1).map((one) => one.cacheReadShare);
  const byReason: Record<string, number> = {};
  for (const one of done)
    if (one.rule.withheld)
      byReason[one.rule.withheld] = (byReason[one.rule.withheld] ?? 0) + 1;
  const providers: Record<string, number> = {};
  const routed = calls.filter((one) => one.routing);
  for (const one of routed)
    if (one.routing?.provider)
      providers[one.routing.provider] =
        (providers[one.routing.provider] ?? 0) + 1;
  const words = sum(done, (one) => one.words);
  return {
    calls: calls.length,
    ok: done.length,
    cache: {
      ...(replied.length ? { first: replied[0].cacheReadShare } : {}),
      ...(later.length
        ? {
            laterMin: Math.min(...later),
            laterMean: later.reduce((a, b) => a + b, 0) / later.length,
          }
        : {}),
      pooled: ratio(
        sum(calls, (one) => one.cached),
        sum(calls, (one) => one.input),
      ),
    },
    output: {
      perWord: ratio(
        sum(done, (one) => one.output),
        words,
      ),
      maxPerWord: Math.max(0, ...calls.map((one) => one.outputPerWord)),
      reasoningPerWord: ratio(
        sum(done, (one) => one.reasoning),
        words,
      ),
    },
    sentence: {
      given: done.filter((one) => one.sentenceWords > 0).length,
      ratio: ratio(
        sum(done, (one) => one.sentenceWords),
        words,
      ),
      maxRatio: Math.max(0, ...done.map((one) => one.sentenceRatio)),
    },
    rule: {
      shown: done.filter((one) => one.rule.shown).length,
      withheld: done.filter((one) => !one.rule.shown).length,
      byReason,
    },
    routing: {
      asked: routed.length,
      zeroRetention: routed.filter(
        (one) => one.routing?.zeroDataRetention === true,
      ).length,
      providers,
      failures: routed.flatMap((one) =>
        one.routing?.failure ? [`${one.id}: ${one.routing.failure}`] : [],
      ),
    },
  } satisfies ReadingSummary;
}

/**
 * A run's A3s calls measured, in the order their replies came (so the
 * first is the one that ran alone, writing the cache), or undefined when it
 * has none. Writes
 * `reading-measures.json` beside its replies unless `write` is false.
 */
export function readingMeasures(
  dir: string,
  manifest: Manifest,
  data: EvalData,
  {
    write = true,
    translator,
  }: { write?: boolean; translator?: Translator } = {},
): ReadingMeasures | undefined {
  const wanted = manifest.requests.filter(
    (one) => one.newtext?.arm === "A3s" && one.newtext.task === 1,
  );
  if (!wanted.length) return undefined;
  const lookup = translator ?? readingTranslator(data);
  const calls = wanted.flatMap((one) => {
    const measured = measureCall(
      dir,
      one.id,
      one.newtext as NewSpec,
      data,
      lookup,
    );
    return measured ? [measured] : [];
  });
  calls.sort((a, b) => a.at.localeCompare(b.at));
  const out = {
    run: manifest.runId,
    calls,
    summary: summariseReading(calls),
  };
  if (write) writeJson(join(dir, "reading-measures.json"), out);
  return out;
}
